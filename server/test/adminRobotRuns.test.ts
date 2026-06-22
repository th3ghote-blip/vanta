/**
 * 18.8a — Operator robot-run log (admin "Robot Runs" page).
 *
 * Covers GET /api/admin/robot-runs:
 *   - 403 for unauthenticated / non-admin callers
 *   - lists robot_runs stitched to robot name + owning account login/user_id
 *   - totals (count, trades_opened, by_action) reconcile against raw runs
 *   - filtering by action / robot / account(login) / date narrows the set and
 *     the totals follow the filtered set
 *   - unknown login -> empty result (not an error)
 *   - limit/offset paginate while totals stay over the full filtered set
 *   - default sort is triggered_at desc; dir=asc flips it
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { vi } from 'vitest';
import {
  resetDb,
  seed,
  supabaseAdmin as mockSupa,
  authUser as mockAuthUser,
  issueToken,
} from './helpers/supabaseMock.js';

beforeAll(() => {
  process.env.SUPABASE_URL = 'http://localhost:0/fake';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-key';
  process.env.ANTHROPIC_API_KEY = 'fake-anthropic-key';
});

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: mockSupa,
  authUser: mockAuthUser,
}));

const { buildApp } = await import('./helpers/app.js');

function authHeaders(userId: string) {
  return { authorization: `Bearer ${issueToken(userId)}` };
}

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/**
 * Deterministic fixture:
 *   acct A (login 80001234, trader-a): robot "Alpha"
 *     - open_trade (trade 501), 60m ago
 *     - noop, 90m ago
 *   acct B (login 80005678, trader-b): robot "Beta"
 *     - tip, 30m ago
 *     - open_trade (trade 777), 10m ago
 * Total runs = 4: 2 open_trade (both with a trade_id), 1 noop, 1 tip.
 */
function seedFixture() {
  const admin = seed.user({ id: 'admin-x' });
  seed.profile({ id: admin.id, is_admin: true });
  const tA = seed.user({ id: 'trader-a' });
  const tB = seed.user({ id: 'trader-b' });
  const acctA = seed.account({ id: 'acct-A', user_id: tA.id, login: 80001234 });
  const acctB = seed.account({ id: 'acct-B', user_id: tB.id, login: 80005678 });
  const alpha = seed.robot({ id: 'robot-A', account_id: acctA.id, name: 'Alpha' });
  const beta = seed.robot({ id: 'robot-B', account_id: acctB.id, name: 'Beta' });

  seed.robotRun({ id: 1, robot_id: alpha.id, action: 'open_trade', trade_id: 501, triggered_at: iso(60 * MIN) });
  seed.robotRun({ id: 2, robot_id: alpha.id, action: 'noop', trade_id: null, triggered_at: iso(90 * MIN) });
  seed.robotRun({ id: 3, robot_id: beta.id, action: 'tip', trade_id: null, triggered_at: iso(30 * MIN) });
  seed.robotRun({ id: 4, robot_id: beta.id, action: 'open_trade', trade_id: 777, triggered_at: iso(10 * MIN) });

  return { admin, acctA, acctB, alpha, beta };
}

describe('GET /api/admin/robot-runs (18.8a)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(() => {
    resetDb();
  });

  it('403s for an unauthenticated caller', async () => {
    seedFixture();
    const res = await app.inject({ method: 'GET', url: '/api/admin/robot-runs' });
    expect(res.statusCode).toBe(403);
  });

  it('403s for a non-admin caller', async () => {
    const u = seed.user({ id: 'plain' });
    seed.profile({ id: u.id, is_admin: false });
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/robot-runs',
      headers: authHeaders(u.id),
    });
    expect(res.statusCode).toBe(403);
  });

  it('lists all runs stitched to robot name + login, with reconciling totals', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/robot-runs',
      headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBe(4);
    expect(body.runs).toHaveLength(4);
    // default sort = triggered_at desc -> newest (10m ago, id 4) first
    expect(body.runs[0].id).toBe(4);
    expect(body.runs[0].robot_name).toBe('Beta');
    expect(body.runs[0].login).toBe(80005678);
    expect(body.runs[0].user_id).toBe('trader-b');
    expect(body.runs[0].action).toBe('open_trade');
    expect(body.runs[0].trade_id).toBe(777);
    // an Alpha run stitches to acct A
    const alphaRun = body.runs.find((r: any) => r.id === 1);
    expect(alphaRun.robot_name).toBe('Alpha');
    expect(alphaRun.login).toBe(80001234);
    // totals
    expect(body.totals.count).toBe(4);
    expect(body.totals.trades_opened).toBe(2);
    expect(body.totals.by_action).toEqual({ open_trade: 2, noop: 1, tip: 1 });
  });

  it('filters by action', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/robot-runs?action=open_trade',
      headers: authHeaders(admin.id),
    });
    const body = res.json();
    expect(body.count).toBe(2);
    expect(body.runs.every((r: any) => r.action === 'open_trade')).toBe(true);
    expect(body.totals.by_action).toEqual({ open_trade: 2 });
    expect(body.totals.trades_opened).toBe(2);
  });

  it('filters by robot id', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/robot-runs?robot=robot-A',
      headers: authHeaders(admin.id),
    });
    const body = res.json();
    expect(body.count).toBe(2);
    expect(body.runs.every((r: any) => r.robot_id === 'robot-A')).toBe(true);
    expect(body.runs.every((r: any) => r.robot_name === 'Alpha')).toBe(true);
  });

  it('filters by account login', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/robot-runs?account=80005678',
      headers: authHeaders(admin.id),
    });
    const body = res.json();
    expect(body.count).toBe(2);
    expect(body.runs.every((r: any) => r.login === 80005678)).toBe(true);
    expect(body.totals.by_action).toEqual({ tip: 1, open_trade: 1 });
  });

  it('returns an empty set (not an error) for an unknown login', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/robot-runs?account=99999999',
      headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBe(0);
    expect(body.runs).toHaveLength(0);
    expect(body.totals).toEqual({ count: 0, trades_opened: 0, by_action: {} });
  });

  it('filters by triggered_at date range', async () => {
    const { admin } = seedFixture();
    // window: between 75m and 20m ago -> excludes the 90m (noop) and 10m runs
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/robot-runs?from=${encodeURIComponent(iso(75 * MIN))}&to=${encodeURIComponent(iso(20 * MIN))}`,
      headers: authHeaders(admin.id),
    });
    const body = res.json();
    expect(body.count).toBe(2);
    const ids = body.runs.map((r: any) => r.id).sort();
    expect(ids).toEqual([1, 3]);
  });

  it('paginates with limit/offset while totals stay over the full set', async () => {
    const { admin } = seedFixture();
    const p1 = (
      await app.inject({
        method: 'GET',
        url: '/api/admin/robot-runs?limit=2&offset=0',
        headers: authHeaders(admin.id),
      })
    ).json();
    const p2 = (
      await app.inject({
        method: 'GET',
        url: '/api/admin/robot-runs?limit=2&offset=2',
        headers: authHeaders(admin.id),
      })
    ).json();
    expect(p1.runs).toHaveLength(2);
    expect(p2.runs).toHaveLength(2);
    // totals are the full filtered set on every page
    expect(p1.totals.count).toBe(4);
    expect(p2.totals.count).toBe(4);
    // no overlap between pages
    const ids1 = new Set(p1.runs.map((r: any) => r.id));
    expect(p2.runs.some((r: any) => ids1.has(r.id))).toBe(false);
    // desc order: page 1 newest-first
    expect(p1.runs[0].id).toBe(4);
  });

  it('dir=asc flips the order to oldest-first', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/robot-runs?dir=asc',
      headers: authHeaders(admin.id),
    });
    const body = res.json();
    // oldest = 90m ago (id 2)
    expect(body.runs[0].id).toBe(2);
    expect(body.runs[body.runs.length - 1].id).toBe(4);
  });
});
