/**
 * 21.5 — Per-asset analytics (admin "metrics by symbol").
 *
 * Covers GET /api/admin/analytics/by-symbol:
 *   - 403 for non-admin / unauthenticated callers
 *   - per-symbol aggregation reconciles against the raw trades
 *     (counts, volume, notional, open interest, realized P&L, win rate, hold)
 *   - the window param filters by open_time (inception) and changes the result
 *   - over_exposure flag respects the threshold param
 *   - empty window returns no symbols
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

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('GET /api/admin/analytics/by-symbol (21.5)', () => {
  beforeEach(() => resetDb());

  it('rejects unauthenticated callers (403)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/admin/analytics/by-symbol' });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('rejects non-admin users (403)', async () => {
    const user = seed.user();
    seed.profile({ id: user.id, is_admin: false });
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/analytics/by-symbol',
      headers: authHeaders(user.id),
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('reconciles per-symbol metrics against the raw trades', async () => {
    const admin = seed.user({ id: 'admin-a' });
    seed.profile({ id: admin.id, is_admin: true });
    const trader = seed.user({ id: 'trader-a' });
    const acct = seed.account({ id: 'acct-an-1', user_id: trader.id, login: 80001234, leverage: 100 });

    // BTCUSD (contractSize 1).
    // closed WIN: 0.01 lot @ 70000, +50, held 30m
    seed.trade({ account_id: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.01, open_price: 70000,
      status: 'closed', profit: 50, open_time: iso(HOUR), close_time: iso(30 * MIN) });
    // closed LOSS: 0.02 lot @ 71000, -20, held 60m
    seed.trade({ account_id: acct.id, symbol: 'BTCUSD', side: 'sell', volume: 0.02, open_price: 71000,
      status: 'closed', profit: -20, open_time: iso(2 * HOUR), close_time: iso(HOUR) });
    // OPEN buy: 0.03 lot @ 72000
    seed.trade({ account_id: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.03, open_price: 72000,
      status: 'open', open_time: iso(10 * MIN) });

    setQuote({ symbol: 'BTCUSD', bid: 72999, ask: 73001, ts: Date.now() });

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/analytics/by-symbol?window=all',
      headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;

    expect(body.symbols).toHaveLength(1);
    const s = body.symbols[0];
    expect(s.symbol).toBe('BTCUSD');
    expect(s.trade_count).toBe(3);
    expect(s.open_count).toBe(1);
    expect(s.closed_count).toBe(2);
    // volume lots = 0.01 + 0.02 + 0.03
    expect(s.volume_lots).toBeCloseTo(0.06, 6);
    // notional at open_price: 0.01*70000 + 0.02*71000 + 0.03*72000 = 700 + 1420 + 2160
    expect(s.volume_notional).toBe(4280);
    // open interest: only the 0.03 open buy → net long 0.03 lots @ mid 73000 = 2190
    expect(s.open_buy_lots).toBeCloseTo(0.03, 6);
    expect(s.open_sell_lots).toBe(0);
    expect(s.net_open_lots).toBeCloseTo(0.03, 6);
    expect(s.net_open_notional).toBe(2190);
    // realized client P&L = +50 - 20 = 30 ; house = -30
    expect(s.realized_client_pnl).toBe(30);
    expect(s.realized_house_pnl).toBe(-30);
    // win rate: 1 win / 2 closed
    expect(s.win_rate).toBe(0.5);
    // avg hold: (1800 + 3600) / 2 = 2700s
    expect(s.avg_hold_seconds).toBe(2700);
    // most-active account
    expect(s.top_accounts[0].login).toBe(80001234);
    expect(s.top_accounts[0].trade_count).toBe(3);
    // default threshold 100k → not over-exposed
    expect(s.over_exposure).toBe(false);

    // totals reconcile
    expect(body.totals.symbols).toBe(1);
    expect(body.totals.trade_count).toBe(3);
    expect(body.totals.volume_notional).toBe(4280);
    expect(body.totals.realized_house_pnl).toBe(-30);

    await app.close();
  });

  it('window param filters by inception (open_time) and changes the result', async () => {
    const admin = seed.user({ id: 'admin-b' });
    seed.profile({ id: admin.id, is_admin: true });
    const trader = seed.user({ id: 'trader-b' });
    const acct = seed.account({ id: 'acct-an-2', user_id: trader.id, login: 80005678, leverage: 100 });

    // Recent BTC trade (within 24h)
    seed.trade({ account_id: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.01, open_price: 50000,
      status: 'open', open_time: iso(2 * HOUR) });
    // Old ETH trade (3 days ago — outside 24h, inside 30d)
    seed.trade({ account_id: acct.id, symbol: 'ETHUSD', side: 'buy', volume: 0.1, open_price: 2000,
      status: 'open', open_time: iso(3 * DAY) });

    setQuote({ symbol: 'BTCUSD', bid: 50000, ask: 50000, ts: Date.now() });
    setQuote({ symbol: 'ETHUSD', bid: 2000, ask: 2000, ts: Date.now() });

    const app = await buildApp();

    const res24h = await app.inject({
      method: 'GET', url: '/api/admin/analytics/by-symbol?window=24h', headers: authHeaders(admin.id),
    });
    const b24 = res24h.json() as any;
    expect(b24.window).toBe('24h');
    expect(b24.symbols.map((x: any) => x.symbol)).toEqual(['BTCUSD']);

    const resAll = await app.inject({
      method: 'GET', url: '/api/admin/analytics/by-symbol?window=30d', headers: authHeaders(admin.id),
    });
    const ball = resAll.json() as any;
    expect(ball.symbols.map((x: any) => x.symbol).sort()).toEqual(['BTCUSD', 'ETHUSD']);

    await app.close();
  });

  it('over_exposure flag respects the threshold param', async () => {
    const admin = seed.user({ id: 'admin-c' });
    seed.profile({ id: admin.id, is_admin: true });
    const trader = seed.user({ id: 'trader-c' });
    const acct = seed.account({ id: 'acct-an-3', user_id: trader.id, login: 80009999, leverage: 100 });

    // open 0.1 lot BTC @ 50000, mid 50000 → net notional 5000
    seed.trade({ account_id: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.1, open_price: 50000,
      status: 'open', open_time: iso(MIN) });
    setQuote({ symbol: 'BTCUSD', bid: 50000, ask: 50000, ts: Date.now() });

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET', url: '/api/admin/analytics/by-symbol?window=all&threshold=1000', headers: authHeaders(admin.id),
    });
    const body = res.json() as any;
    expect(body.exposure_threshold).toBe(1000);
    expect(body.symbols[0].net_open_notional).toBe(5000);
    expect(body.symbols[0].over_exposure).toBe(true);
    await app.close();
  });

  it('returns no symbols when the window is empty', async () => {
    const admin = seed.user({ id: 'admin-d' });
    seed.profile({ id: admin.id, is_admin: true });
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET', url: '/api/admin/analytics/by-symbol?window=24h', headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.symbols).toHaveLength(0);
    expect(body.totals.trade_count).toBe(0);
    await app.close();
  });
});
