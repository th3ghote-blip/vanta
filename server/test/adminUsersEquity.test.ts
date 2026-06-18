/**
 * 21.9 — Admin account list: live equity + margin-level columns.
 *
 * GET /api/admin/users now returns, per account, `equity` (balance + unrealized
 * P&L at the live mid) and `margin_level_pct` (= equity / margin_used * 100, or
 * null when margin_used is 0).
 *
 * Asserts: 403 gating; the values match /api/admin/analytics/accounts for the
 * same account (the acceptance criterion); null margin → null margin level; and
 * the login-number search path is enriched the same way.
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

describe('GET /api/admin/users — equity + margin-level (21.9)', () => {
  beforeEach(() => resetDb());

  it('rejects unauthenticated callers (403)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/admin/users' });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('rejects non-admin users (403)', async () => {
    const user = seed.user();
    seed.profile({ id: user.id, is_admin: false });
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET', url: '/api/admin/users', headers: authHeaders(user.id),
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('returns equity + margin_level_pct matching the analytics leaderboard', async () => {
    const admin = seed.user({ id: 'admin-eq' });
    seed.profile({ id: admin.id, is_admin: true });
    const trader = seed.user({ id: 'trader-eq' });
    seed.profile({ id: trader.id, display_name: 'Trader Eq' });
    const acct = seed.account({
      id: 'acct-eq', user_id: trader.id, login: 80009001,
      balance: 10000, margin_used: 500,
    });
    // One open trade → unrealized P&L drives equity (live mid 71000 vs open 70000).
    seed.trade({
      account_id: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.01,
      open_price: 70000, status: 'open',
    });
    setQuote({ symbol: 'BTCUSD', bid: 71000, ask: 71000, ts: Date.now() });

    const app = await buildApp();
    const usersRes = await app.inject({
      method: 'GET', url: '/api/admin/users', headers: authHeaders(admin.id),
    });
    const acctsRes = await app.inject({
      method: 'GET', url: '/api/admin/analytics/accounts', headers: authHeaders(admin.id),
    });
    expect(usersRes.statusCode).toBe(200);
    expect(acctsRes.statusCode).toBe(200);

    const u = (usersRes.json() as any).users.find((x: any) => x.id === trader.id);
    const accountRow = u.accounts.find((a: any) => a.id === acct.id);
    const lb = (acctsRes.json() as any).accounts.find((a: any) => a.account_id === acct.id);

    // equity from /users equals current_equity from the leaderboard.
    expect(accountRow.equity).toBeCloseTo(lb.current_equity, 2);
    // equity moved off the raw balance (the open trade has unrealized P&L).
    expect(accountRow.equity).not.toBe(10000);
    // margin level = equity / margin_used * 100, rounded to 1dp.
    const expectedML = +((lb.current_equity / 500) * 100).toFixed(1);
    expect(accountRow.margin_level_pct).toBeCloseTo(expectedML, 1);
  });

  it('reports null margin_level_pct when the account holds no margin', async () => {
    const admin = seed.user({ id: 'admin-nm' });
    seed.profile({ id: admin.id, is_admin: true });
    const trader = seed.user({ id: 'trader-nm' });
    seed.profile({ id: trader.id });
    const acct = seed.account({
      id: 'acct-nm', user_id: trader.id, login: 80009002,
      balance: 8000, margin_used: 0,
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET', url: '/api/admin/users', headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const u = (res.json() as any).users.find((x: any) => x.id === trader.id);
    const row = u.accounts.find((a: any) => a.id === acct.id);
    // No open trades → equity equals balance; no margin → null level.
    expect(row.equity).toBe(8000);
    expect(row.margin_level_pct).toBeNull();
  });

  it('enriches the login-number search path too', async () => {
    const admin = seed.user({ id: 'admin-ls' });
    seed.profile({ id: admin.id, is_admin: true });
    const trader = seed.user({ id: 'trader-ls' });
    seed.profile({ id: trader.id });
    const acct = seed.account({
      id: 'acct-ls', user_id: trader.id, login: 80009003,
      balance: 5000, margin_used: 250,
    });
    seed.trade({
      account_id: acct.id, symbol: 'BTCUSD', side: 'sell', volume: 0.02,
      open_price: 70000, status: 'open',
    });
    setQuote({ symbol: 'BTCUSD', bid: 69000, ask: 69000, ts: Date.now() });

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET', url: '/api/admin/users?q=80009003', headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const users = (res.json() as any).users;
    expect(users.length).toBe(1);
    const row = users[0].accounts[0];
    expect(typeof row.equity).toBe('number');
    expect(row.margin_level_pct).not.toBeNull();
    // Short BTC with price falling 70000→69000 is profitable → equity > balance.
    expect(row.equity).toBeGreaterThan(5000);
  });
});
