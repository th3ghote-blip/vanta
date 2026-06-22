/**
 * 18.8c — Operator price-alerts log (admin "Price Alerts" page).
 *
 * Covers GET /api/admin/alerts:
 *   - 403 for unauthenticated / non-admin callers
 *   - lists price_alerts stitched to the owning user's account login +
 *     profile display_name, with a derived active|triggered status
 *   - totals (count, active, triggered, by_direction) reconcile against raw
 *   - filtering by status / symbol / direction / account(login) / date narrows
 *     the set and the totals follow the filtered set
 *   - unknown login -> empty result (not an error)
 *   - limit/offset paginate while totals stay over the full filtered set
 *   - default sort is created_at desc; dir=asc flips it
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

/**
 * Deterministic fixture (created_at in parens):
 *   user A (login 80001234, "Alice")
 *     al1  BTCUSD above  active     (created 60m ago)
 *     al2  ETHUSD below  triggered  (created 90m ago, fired 20m ago)
 *   user B (login 80005678, "Bob")
 *     al3  SOLUSD below  active     (created 30m ago)
 *     al4  BTCUSD above  triggered  (created 10m ago, fired  5m ago)
 * Totals: 4 alerts, 2 active, 2 triggered, by_direction {above:2, below:2}.
 */
function seedFixture() {
  const admin = seed.user({ id: 'admin-x' });
  seed.profile({ id: admin.id, is_admin: true });
  const tA = seed.user({ id: 'trader-a' });
  const tB = seed.user({ id: 'trader-b' });
  seed.account({ id: 'acct-A', user_id: tA.id, login: 80001234 });
  seed.account({ id: 'acct-B', user_id: tB.id, login: 80005678 });
  seed.profile({ id: tA.id, display_name: 'Alice' });
  seed.profile({ id: tB.id, display_name: 'Bob' });

  seed.priceAlert({ id: 'al1', user_id: tA.id, symbol: 'BTCUSD', direction: 'above', threshold: 60000, triggered_at: null, created_at: iso(60 * MIN) });
  seed.priceAlert({ id: 'al2', user_id: tA.id, symbol: 'ETHUSD', direction: 'below', threshold: 2000, triggered_at: iso(20 * MIN), created_at: iso(90 * MIN) });
  seed.priceAlert({ id: 'al3', user_id: tB.id, symbol: 'SOLUSD', direction: 'below', threshold: 120, triggered_at: null, created_at: iso(30 * MIN) });
  seed.priceAlert({ id: 'al4', user_id: tB.id, symbol: 'BTCUSD', direction: 'above', threshold: 65000, triggered_at: iso(5 * MIN), created_at: iso(10 * MIN) });

  return { admin, tA, tB };
}

describe('GET /api/admin/alerts (18.8c)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(() => {
    resetDb();
  });

  it('403s for an unauthenticated caller', async () => {
    seedFixture();
    const res = await app.inject({ method: 'GET', url: '/api/admin/alerts' });
    expect(res.statusCode).toBe(403);
  });

  it('403s for a non-admin caller', async () => {
    const u = seed.user({ id: 'plain' });
    seed.profile({ id: u.id, is_admin: false });
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/alerts',
      headers: authHeaders(u.id),
    });
    expect(res.statusCode).toBe(403);
  });

  it('lists all alerts stitched to login + display_name, with reconciling totals', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/alerts',
      headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBe(4);
    expect(body.alerts).toHaveLength(4);
    // default sort = created_at desc -> newest (10m ago, al4) first
    expect(body.alerts[0].id).toBe('al4');
    expect(body.alerts[0].symbol).toBe('BTCUSD');
    expect(body.alerts[0].login).toBe(80005678);
    expect(body.alerts[0].display_name).toBe('Bob');
    expect(body.alerts[0].direction).toBe('above');
    expect(body.alerts[0].status).toBe('triggered');
    expect(body.alerts[0].threshold).toBe(65000);
    // an Alice alert stitches to acct A
    const al1 = body.alerts.find((a: any) => a.id === 'al1');
    expect(al1.login).toBe(80001234);
    expect(al1.display_name).toBe('Alice');
    expect(al1.status).toBe('active');
    // totals
    expect(body.totals).toEqual({ count: 4, active: 2, triggered: 2, by_direction: { above: 2, below: 2 } });
  });

  it('filters by status=active', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/alerts?status=active',
      headers: authHeaders(admin.id),
    });
    const body = res.json();
    expect(body.count).toBe(2);
    expect(body.alerts.every((a: any) => a.status === 'active')).toBe(true);
    expect(body.totals).toEqual({ count: 2, active: 2, triggered: 0, by_direction: { above: 1, below: 1 } });
  });

  it('filters by status=triggered', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/alerts?status=triggered',
      headers: authHeaders(admin.id),
    });
    const body = res.json();
    expect(body.count).toBe(2);
    expect(body.alerts.every((a: any) => a.status === 'triggered' && a.triggered_at != null)).toBe(true);
  });

  it('filters by symbol', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/alerts?symbol=BTCUSD',
      headers: authHeaders(admin.id),
    });
    const body = res.json();
    expect(body.count).toBe(2);
    expect(body.alerts.every((a: any) => a.symbol === 'BTCUSD')).toBe(true);
    expect(body.totals).toEqual({ count: 2, active: 1, triggered: 1, by_direction: { above: 2 } });
  });

  it('filters by direction', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/alerts?direction=below',
      headers: authHeaders(admin.id),
    });
    const body = res.json();
    expect(body.count).toBe(2);
    expect(body.alerts.every((a: any) => a.direction === 'below')).toBe(true);
  });

  it('filters by account login', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/alerts?account=80005678',
      headers: authHeaders(admin.id),
    });
    const body = res.json();
    expect(body.count).toBe(2);
    expect(body.alerts.every((a: any) => a.login === 80005678)).toBe(true);
    const ids = body.alerts.map((a: any) => a.id).sort();
    expect(ids).toEqual(['al3', 'al4']);
  });

  it('returns an empty set (not an error) for an unknown login', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/alerts?account=99999999',
      headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBe(0);
    expect(body.alerts).toHaveLength(0);
    expect(body.totals).toEqual({ count: 0, active: 0, triggered: 0, by_direction: {} });
  });

  it('filters by created_at date range', async () => {
    const { admin } = seedFixture();
    // window: between 75m and 15m ago -> excludes the 90m (al2) and 10m (al4) alerts
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/alerts?from=${encodeURIComponent(iso(75 * MIN))}&to=${encodeURIComponent(iso(15 * MIN))}`,
      headers: authHeaders(admin.id),
    });
    const body = res.json();
    expect(body.count).toBe(2);
    const ids = body.alerts.map((a: any) => a.id).sort();
    expect(ids).toEqual(['al1', 'al3']);
  });

  it('paginates with limit/offset while totals stay over the full set', async () => {
    const { admin } = seedFixture();
    const p1 = (
      await app.inject({
        method: 'GET',
        url: '/api/admin/alerts?limit=2&offset=0',
        headers: authHeaders(admin.id),
      })
    ).json();
    const p2 = (
      await app.inject({
        method: 'GET',
        url: '/api/admin/alerts?limit=2&offset=2',
        headers: authHeaders(admin.id),
      })
    ).json();
    expect(p1.alerts).toHaveLength(2);
    expect(p2.alerts).toHaveLength(2);
    expect(p1.totals.count).toBe(4);
    expect(p2.totals.count).toBe(4);
    const ids1 = new Set(p1.alerts.map((a: any) => a.id));
    expect(p2.alerts.some((a: any) => ids1.has(a.id))).toBe(false);
    // desc order: page 1 newest-first
    expect(p1.alerts[0].id).toBe('al4');
  });

  it('dir=asc flips the order to oldest-first', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/alerts?dir=asc',
      headers: authHeaders(admin.id),
    });
    const body = res.json();
    // oldest = 90m ago (al2)
    expect(body.alerts[0].id).toBe('al2');
    expect(body.alerts[body.alerts.length - 1].id).toBe('al4');
  });
});
