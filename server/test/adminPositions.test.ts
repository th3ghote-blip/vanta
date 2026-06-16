/**
 * 21.3 — Live Positions blotter (admin "Open Trades").
 *
 * Covers GET /api/admin/positions:
 *   - 403 for non-admin / unauthenticated callers
 *   - returns every OPEN trade across all accounts, stitched to its login,
 *     with a live mid price, computed unrealized P&L, and held margin
 *   - excludes closed trades
 *   - summary bar totals open count + buy/sell/net notional exposure
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

describe('GET /api/admin/positions (21.3)', () => {
  beforeEach(() => resetDb());

  it('rejects unauthenticated callers (403)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/admin/positions' });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('rejects non-admin users (403)', async () => {
    const user = seed.user();
    seed.profile({ id: user.id, is_admin: false });
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/positions',
      headers: authHeaders(user.id),
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('lists every open trade with login, live P&L and margin; excludes closed', async () => {
    const admin = seed.user({ id: 'admin-1' });
    seed.profile({ id: admin.id, is_admin: true });

    const trader = seed.user({ id: 'trader-1' });
    const acct = seed.account({ id: 'acct-pos-1', user_id: trader.id, login: 80001234, leverage: 100 });

    // Open BTC buy @ 75000, mid 76000 → +10 on 0.01 lot (cs=1)
    seed.trade({ account_id: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.01, open_price: 75000, status: 'open' });
    // Closed trade must NOT appear
    seed.trade({ account_id: acct.id, symbol: 'ETHUSD', side: 'buy', volume: 0.1, open_price: 2000, status: 'closed' });

    setQuote({ symbol: 'BTCUSD', bid: 75999, ask: 76001, ts: Date.now() });

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/positions',
      headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Awaited<any>;

    expect(body.positions).toHaveLength(1);
    const p = body.positions[0];
    expect(p.symbol).toBe('BTCUSD');
    expect(p.login).toBe(80001234);
    expect(p.current_price).toBe(76000);
    // P&L = (76000 - 75000) * 0.01 * 1 = 10
    expect(p.pnl).toBe(10);
    // margin = 0.01 * 75000 * 1 / 100 = 7.5
    expect(p.margin).toBe(7.5);
    // notional = 0.01 * 76000 * 1 = 760
    expect(p.notional).toBe(760);

    expect(body.summary.total_open).toBe(1);
    expect(body.summary.buy_notional).toBe(760);
    expect(body.summary.sell_notional).toBe(0);
    expect(body.summary.net_notional).toBe(760);

    await app.close();
  });

  it('computes net exposure from offsetting buy/sell notionals', async () => {
    const admin = seed.user({ id: 'admin-2' });
    seed.profile({ id: admin.id, is_admin: true });
    const trader = seed.user({ id: 'trader-2' });
    const acct = seed.account({ id: 'acct-pos-2', user_id: trader.id, login: 80005678, leverage: 100 });

    seed.trade({ account_id: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.02, open_price: 50000, status: 'open' });
    seed.trade({ account_id: acct.id, symbol: 'BTCUSD', side: 'sell', volume: 0.01, open_price: 50000, status: 'open' });

    setQuote({ symbol: 'BTCUSD', bid: 49999, ask: 50001, ts: Date.now() });

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/positions',
      headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Awaited<any>;

    expect(body.summary.total_open).toBe(2);
    // buy notional = 0.02 * 50000 = 1000; sell = 0.01 * 50000 = 500
    expect(body.summary.buy_notional).toBe(1000);
    expect(body.summary.sell_notional).toBe(500);
    expect(body.summary.net_notional).toBe(500);
    expect(body.summary.total_notional).toBe(1500);

    await app.close();
  });

  it('returns an empty blotter when no trades are open', async () => {
    const admin = seed.user({ id: 'admin-3' });
    seed.profile({ id: admin.id, is_admin: true });
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/positions',
      headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Awaited<any>;
    expect(body.positions).toHaveLength(0);
    expect(body.summary.total_open).toBe(0);
    expect(body.summary.net_notional).toBe(0);
    await app.close();
  });
});
