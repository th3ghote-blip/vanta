/**
 * 21.4 — Force-close / modify any position (MT4 manager intervention).
 *
 * Covers:
 *   POST  /api/admin/positions/:id/close
 *     - 403 for non-admin / unauthenticated callers
 *     - closes at the live mid, settles realized P&L to the account balance,
 *       releases the held margin, stamps reason='admin_close'
 *     - 404 when the trade isn't an open position
 *   PATCH /api/admin/positions/:id
 *     - 403 for non-admin callers
 *     - sets SL/TP, clears a level via null, rejects a wrong-side level,
 *       400 when neither field is supplied
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { vi } from 'vitest';
import {
  resetDb,
  seed,
  getTable,
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

describe('POST /api/admin/positions/:id/close (21.4)', () => {
  beforeEach(() => resetDb());

  it('rejects unauthenticated callers (403)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/admin/positions/1/close' });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('rejects non-admin users (403)', async () => {
    const user = seed.user();
    seed.profile({ id: user.id, is_admin: false });
    const trade = seed.trade({ status: 'open' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/positions/${trade.id}/close`,
      headers: authHeaders(user.id),
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('force-closes at live mid: settles P&L, releases margin, logs admin_close', async () => {
    const admin = seed.user({ id: 'admin-fc' });
    seed.profile({ id: admin.id, is_admin: true });

    const trader = seed.user({ id: 'trader-fc' });
    // margin_used seeded to the position's reserved margin (7.5) so release nets it out.
    const acct = seed.account({
      id: 'acct-fc', user_id: trader.id, login: 80009001, leverage: 100,
      balance: 10_000, margin_used: 7.5, free_margin: 9_992.5,
    });

    // BTC buy 0.01 @ 75000, mid 76000 → +10 (cs=1); margin = 0.01*75000/100 = 7.5
    const trade = seed.trade({ account_id: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.01, open_price: 75000, status: 'open' });
    setQuote({ symbol: 'BTCUSD', bid: 75999, ask: 76001, ts: Date.now() });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/positions/${trade.id}/close`,
      headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;

    expect(body.status).toBe('closed');
    expect(body.reason).toBe('admin_close');
    expect(body.close_price).toBe(76000);
    expect(body.profit).toBe(10);
    expect(body.margin_released).toBe(7.5);

    // Trade row transitioned to closed with the admin reason.
    const row = getTable('trades').find((t) => t.id === trade.id)!;
    expect(row.status).toBe('closed');
    expect(row.reason).toBe('admin_close');
    expect(row.close_price).toBe(76000);
    expect(row.profit).toBe(10);

    // Account settled: balance += profit, margin released.
    const a = getTable('accounts').find((x) => x.id === acct.id)!;
    expect(a.balance).toBe(10_010);
    expect(a.margin_used).toBe(0);

    await app.close();
  });

  it('404 when the trade is not an open position', async () => {
    const admin = seed.user({ id: 'admin-fc2' });
    seed.profile({ id: admin.id, is_admin: true });
    const acct = seed.account({ id: 'acct-fc2', user_id: 'whoever', login: 80009002 });
    const closed = seed.trade({ account_id: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.01, open_price: 75000, status: 'closed' });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/positions/${closed.id}/close`,
      headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('PATCH /api/admin/positions/:id (21.4)', () => {
  beforeEach(() => resetDb());

  it('rejects non-admin users (403)', async () => {
    const user = seed.user();
    seed.profile({ id: user.id, is_admin: false });
    const trade = seed.trade({ status: 'open' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/positions/${trade.id}`,
      headers: authHeaders(user.id),
      payload: { stopLoss: 1 },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('sets SL/TP on a client position', async () => {
    const admin = seed.user({ id: 'admin-mod' });
    seed.profile({ id: admin.id, is_admin: true });
    const acct = seed.account({ id: 'acct-mod', user_id: 'trader-mod', login: 80009100, leverage: 100 });
    const trade = seed.trade({ account_id: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.01, open_price: 75000, status: 'open' });
    setQuote({ symbol: 'BTCUSD', bid: 75999, ask: 76001, ts: Date.now() }); // mid 76000

    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/positions/${trade.id}`,
      headers: authHeaders(admin.id),
      payload: { stopLoss: 74000, takeProfit: 80000 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.stopLoss).toBe(74000);
    expect(body.takeProfit).toBe(80000);

    const row = getTable('trades').find((t) => t.id === trade.id)!;
    expect(row.stop_loss).toBe(74000);
    expect(row.take_profit).toBe(80000);
    await app.close();
  });

  it('rejects a wrong-side stop loss (400 invalid_sl)', async () => {
    const admin = seed.user({ id: 'admin-mod2' });
    seed.profile({ id: admin.id, is_admin: true });
    const acct = seed.account({ id: 'acct-mod2', user_id: 'trader-mod2', login: 80009101, leverage: 100 });
    const trade = seed.trade({ account_id: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.01, open_price: 75000, status: 'open' });
    setQuote({ symbol: 'BTCUSD', bid: 75999, ask: 76001, ts: Date.now() }); // mid 76000

    const app = await buildApp();
    // buy SL above current price is invalid
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/positions/${trade.id}`,
      headers: authHeaders(admin.id),
      payload: { stopLoss: 77000 },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as any).error).toBe('invalid_sl');
    await app.close();
  });

  it('clears a level when passed null', async () => {
    const admin = seed.user({ id: 'admin-mod3' });
    seed.profile({ id: admin.id, is_admin: true });
    const acct = seed.account({ id: 'acct-mod3', user_id: 'trader-mod3', login: 80009102, leverage: 100 });
    const trade = seed.trade({ account_id: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.01, open_price: 75000, status: 'open', stop_loss: 74000 });
    setQuote({ symbol: 'BTCUSD', bid: 75999, ask: 76001, ts: Date.now() });

    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/positions/${trade.id}`,
      headers: authHeaders(admin.id),
      payload: { stopLoss: null },
    });
    expect(res.statusCode).toBe(200);
    const row = getTable('trades').find((t) => t.id === trade.id)!;
    expect(row.stop_loss).toBe(null);
    await app.close();
  });

  it('400 when neither stopLoss nor takeProfit is supplied', async () => {
    const admin = seed.user({ id: 'admin-mod4' });
    seed.profile({ id: admin.id, is_admin: true });
    const acct = seed.account({ id: 'acct-mod4', user_id: 'trader-mod4', login: 80009103 });
    const trade = seed.trade({ account_id: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.01, open_price: 75000, status: 'open' });

    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/positions/${trade.id}`,
      headers: authHeaders(admin.id),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
