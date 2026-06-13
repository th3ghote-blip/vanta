/**
 * 18.6 — "Share my trades" privacy toggle.
 *
 * Covers:
 *   - PATCH /api/account/privacy persists profiles.share_trades (401 / 400 / 200)
 *   - GET /api/traders/:leaderId/trades returns a leader's closed trades when
 *     sharing is ON, and 403 when the leader has turned sharing OFF (or has no
 *     profile). This is the route that "returns another user's trades".
 *   - The copy-trading leaderboard excludes leaders with share_trades=false.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { vi } from 'vitest';
import {
  resetDb,
  seed,
  supabaseAdmin as mockSupa,
  authUser as mockAuthUser,
  issueToken,
  getTable,
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

describe('PATCH /api/account/privacy (18.6)', () => {
  beforeEach(() => resetDb());

  it('rejects unauthenticated requests (401)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'PATCH', url: '/api/account/privacy', payload: { share_trades: false } });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rejects a non-boolean share_trades (400)', async () => {
    const user = seed.user();
    seed.profile({ id: user.id });
    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/account/privacy',
      headers: authHeaders(user.id),
      payload: { share_trades: 'nope' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('persists share_trades=false then back to true', async () => {
    const user = seed.user();
    seed.profile({ id: user.id }); // default share_trades=true
    const app = await buildApp();

    const off = await app.inject({
      method: 'PATCH',
      url: '/api/account/privacy',
      headers: authHeaders(user.id),
      payload: { share_trades: false },
    });
    expect(off.statusCode).toBe(200);
    expect((off.json() as { share_trades: boolean }).share_trades).toBe(false);
    expect(getTable('profiles').find((p) => p.id === user.id)?.share_trades).toBe(false);

    const on = await app.inject({
      method: 'PATCH',
      url: '/api/account/privacy',
      headers: authHeaders(user.id),
      payload: { share_trades: true },
    });
    expect(on.statusCode).toBe(200);
    expect(getTable('profiles').find((p) => p.id === user.id)?.share_trades).toBe(true);

    await app.close();
  });
});

describe('GET /api/traders/:leaderId/trades (18.6 gating)', () => {
  beforeEach(() => resetDb());

  it('returns the leader closed trades when sharing is ON', async () => {
    const viewer = seed.user({ id: 'viewer-1' });
    const leader = seed.user({ id: 'leader-1' });
    seed.profile({ id: leader.id, share_trades: true });
    seed.trade({ user_id: leader.id, status: 'closed', symbol: 'BTCUSD', profit: 120 });
    seed.trade({ user_id: leader.id, status: 'open', symbol: 'ETHUSD' }); // excluded (open)

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/traders/${leader.id}/trades`,
      headers: authHeaders(viewer.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { leaderId: string; trades: any[] };
    expect(body.trades).toHaveLength(1);
    expect(body.trades[0].symbol).toBe('BTCUSD');
    await app.close();
  });

  it('returns 403 when the leader has sharing OFF', async () => {
    const viewer = seed.user({ id: 'viewer-2' });
    const leader = seed.user({ id: 'leader-2' });
    seed.profile({ id: leader.id, share_trades: false });
    seed.trade({ user_id: leader.id, status: 'closed', symbol: 'BTCUSD', profit: 50 });

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/traders/${leader.id}/trades`,
      headers: authHeaders(viewer.id),
    });
    expect(res.statusCode).toBe(403);
    expect((res.json() as { error: string }).error).toBe('trades_private');
    await app.close();
  });

  it('returns 403 when the leader has no profile', async () => {
    const viewer = seed.user({ id: 'viewer-3' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/traders/00000000-0000-0000-0000-000000000000/trades',
      headers: authHeaders(viewer.id),
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('requires auth (401)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/traders/leader-x/trades' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe('GET /api/traders/leaderboard excludes private leaders (18.6)', () => {
  beforeEach(() => resetDb());

  it('omits a leader whose share_trades is false', async () => {
    const viewer = seed.user({ id: 'viewer-lb' });
    const shared = seed.user({ id: 'leader-shared' });
    const hidden = seed.user({ id: 'leader-hidden' });
    seed.profile({ id: shared.id, copy_leader_enabled: true, share_trades: true });
    seed.profile({ id: hidden.id, copy_leader_enabled: true, share_trades: false });
    seed.trade({ user_id: shared.id, status: 'closed', profit: 200 });
    seed.trade({ user_id: hidden.id, status: 'closed', profit: 500 });

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/traders/leaderboard?period=all',
      headers: authHeaders(viewer.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { leaderboard: { leaderId: string }[] };
    const ids = body.leaderboard.map((r) => r.leaderId);
    expect(ids).toContain(shared.id);
    expect(ids).not.toContain(hidden.id);
    await app.close();
  });
});
