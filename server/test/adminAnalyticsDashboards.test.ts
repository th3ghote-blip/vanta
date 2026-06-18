/**
 * 21.6 — Platform & per-account analytics dashboards.
 *
 * Covers:
 *   GET /api/admin/analytics/overview  — daily time-series + lifetime totals
 *   GET /api/admin/analytics/accounts  — per-account leaderboard
 *
 * Asserts: 403 gating, totals reconcile with the dashboard's definitions,
 * daily buckets reflect today's activity, per-account realized P&L equals that
 * account's closed-trade sum, unrealized/current-equity uses the live mid,
 * and the sort param re-orders the leaderboard.
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
import { setQuote } from '../src/lib/quoteCache.js';

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

const now = () => new Date().toISOString();
const todayKey = new Date().toISOString().slice(0, 10);

describe('GET /api/admin/analytics/overview (21.6)', () => {
  beforeEach(() => resetDb());

  it('rejects unauthenticated callers (403)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/admin/analytics/overview' });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('rejects non-admin users (403)', async () => {
    const user = seed.user();
    seed.profile({ id: user.id, is_admin: false });
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET', url: '/api/admin/analytics/overview', headers: authHeaders(user.id),
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('reconciles lifetime totals + today bucket against the raw data', async () => {
    const admin = seed.user({ id: 'admin-ov' });
    seed.profile({ id: admin.id, is_admin: true, created_at: now() });
    const trader = seed.user({ id: 'trader-ov' });
    seed.profile({ id: trader.id, created_at: now() });
    const acct = seed.account({ id: 'acct-ov', user_id: trader.id, login: 80007777, balance: 10000 });

    // Transactions (pending one must be ignored).
    seed.transaction({ account_id: acct.id, type: 'deposit', amount: 5000, status: 'completed', created_at: now() });
    seed.transaction({ account_id: acct.id, type: 'withdrawal', amount: 2000, status: 'completed', created_at: now() });
    seed.transaction({ account_id: acct.id, type: 'deposit', amount: 1000, status: 'pending', created_at: now() });

    // Trades: one closed (house P&L), one open (exposure).
    seed.trade({ account_id: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.01, open_price: 70000,
      status: 'closed', profit: 50, open_time: now(), close_time: now() });
    seed.trade({ account_id: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.03, open_price: 72000,
      status: 'open', open_time: now() });

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET', url: '/api/admin/analytics/overview?days=30', headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;

    // 30 daily buckets, last one is today.
    expect(body.series).toHaveLength(30);
    const last = body.series[body.series.length - 1];
    expect(last.date).toBe(todayKey);
    expect(last.new_users).toBe(2);          // admin + trader created today
    expect(last.trade_count).toBe(2);
    expect(last.trade_volume).toBe(2860);    // 0.01*70000 + 0.03*72000 = 700 + 2160
    expect(last.deposits).toBe(5000);        // pending ignored
    expect(last.withdrawals).toBe(2000);
    expect(last.house_pnl).toBe(-50);        // -client profit

    // Lifetime totals mirror the dashboard definitions.
    expect(body.totals.total_users).toBe(2);
    expect(body.totals.total_deposits).toBe(5000);
    expect(body.totals.total_withdrawals).toBe(2000);
    expect(body.totals.net_deposits).toBe(3000);
    expect(body.totals.open_trades).toBe(1);
    expect(body.totals.total_exposure).toBe(2160); // volume*open_price (dashboard formula)

    // Window totals reconcile with the sole active day.
    expect(body.window_totals.new_users).toBe(2);
    expect(body.window_totals.trade_volume).toBe(2860);
    expect(body.window_totals.house_pnl).toBe(-50);

    await app.close();
  });

  it('clamps the days param into [1, 90]', async () => {
    const admin = seed.user({ id: 'admin-ov2' });
    seed.profile({ id: admin.id, is_admin: true });
    const app = await buildApp();
    const tooBig = await app.inject({
      method: 'GET', url: '/api/admin/analytics/overview?days=999', headers: authHeaders(admin.id),
    });
    expect((tooBig.json() as any).days).toBe(90);
    const clamped = await app.inject({
      method: 'GET', url: '/api/admin/analytics/overview?days=0', headers: authHeaders(admin.id),
    });
    expect((clamped.json() as any).days).toBe(1); // 0 clamps up to the minimum of 1
    const nan = await app.inject({
      method: 'GET', url: '/api/admin/analytics/overview?days=abc', headers: authHeaders(admin.id),
    });
    expect((nan.json() as any).days).toBe(30); // non-numeric → default
    await app.close();
  });
});

describe('GET /api/admin/analytics/accounts (21.6)', () => {
  beforeEach(() => resetDb());

  it('rejects unauthenticated callers (403)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/admin/analytics/accounts' });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('reconciles per-account realized P&L / deposits / equity and sorts', async () => {
    const admin = seed.user({ id: 'admin-ac' });
    seed.profile({ id: admin.id, is_admin: true });

    const t1 = seed.user({ id: 'trader-1' });
    const a = seed.account({ id: 'acct-A', user_id: t1.id, login: 80001111, balance: 10000, equity: 10000 });
    const t2 = seed.user({ id: 'trader-2' });
    const b = seed.account({ id: 'acct-B', user_id: t2.id, login: 80002222, balance: 5000, equity: 5000 });

    // Account A: deposits 8000 / withdrawal 1000 (+ pending ignored)
    seed.transaction({ account_id: a.id, type: 'deposit', amount: 8000, status: 'completed' });
    seed.transaction({ account_id: a.id, type: 'withdrawal', amount: 1000, status: 'completed' });
    seed.transaction({ account_id: a.id, type: 'deposit', amount: 500, status: 'pending' });
    // Account B: deposits 20000 (bigger, to flip the deposits sort)
    seed.transaction({ account_id: b.id, type: 'deposit', amount: 20000, status: 'completed' });

    // A trades: closed +100, closed -30 (realized 70, 1 win of 2), one open BTC for unrealized.
    seed.trade({ account_id: a.id, symbol: 'BTCUSD', side: 'buy', volume: 0.01, open_price: 60000, status: 'closed', profit: 100 });
    seed.trade({ account_id: a.id, symbol: 'BTCUSD', side: 'buy', volume: 0.01, open_price: 61000, status: 'closed', profit: -30 });
    seed.trade({ account_id: a.id, symbol: 'BTCUSD', side: 'buy', volume: 0.1, open_price: 50000, status: 'open' });
    // B trades: closed +20
    seed.trade({ account_id: b.id, symbol: 'ETHUSD', side: 'buy', volume: 0.1, open_price: 2000, status: 'closed', profit: 20 });

    setQuote({ symbol: 'BTCUSD', bid: 51000, ask: 51000, ts: Date.now() });

    const app = await buildApp();

    // Default sort = pnl → A (70) before B (20).
    const res = await app.inject({
      method: 'GET', url: '/api/admin/analytics/accounts', headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.accounts).toHaveLength(2);

    const rowA = body.accounts.find((x: any) => x.login === 80001111);
    expect(rowA.realized_pnl).toBe(70);           // 100 - 30
    expect(rowA.deposits).toBe(8000);
    expect(rowA.withdrawals).toBe(1000);
    expect(rowA.net_deposits).toBe(7000);
    expect(rowA.closed_count).toBe(2);
    expect(rowA.trade_count).toBe(3);
    expect(rowA.win_rate).toBe(0.5);
    // open 0.1 BTC @ 50000, mid 51000 → unrealized (51000-50000)*0.1 = 100
    expect(rowA.unrealized_pnl).toBe(100);
    expect(rowA.current_equity).toBe(10100);      // balance 10000 + 100

    const rowB = body.accounts.find((x: any) => x.login === 80002222);
    expect(rowB.realized_pnl).toBe(20);
    expect(rowB.net_deposits).toBe(20000);
    expect(rowB.current_equity).toBe(5000);

    // pnl sort order
    expect(body.accounts[0].login).toBe(80001111);

    // Totals reconcile.
    expect(body.totals.accounts).toBe(2);
    expect(body.totals.deposits).toBe(28000);
    expect(body.totals.withdrawals).toBe(1000);
    expect(body.totals.net_deposits).toBe(27000);
    expect(body.totals.realized_client_pnl).toBe(90);
    expect(body.totals.realized_house_pnl).toBe(-90);
    expect(body.totals.unrealized_pnl).toBe(100);
    expect(body.totals.trade_count).toBe(4);

    // sort=deposits flips the order (B has the bigger deposits).
    const resDep = await app.inject({
      method: 'GET', url: '/api/admin/analytics/accounts?sort=deposits', headers: authHeaders(admin.id),
    });
    const bodyDep = resDep.json() as any;
    expect(bodyDep.sort).toBe('deposits');
    expect(bodyDep.accounts[0].login).toBe(80002222);

    await app.close();
  });
});
