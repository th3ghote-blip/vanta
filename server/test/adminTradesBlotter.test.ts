/**
 * 21.10 — Global closed-trades blotter (admin "Trade History").
 *
 * Covers GET /api/admin/trades:
 *   - 403 for unauthenticated / non-admin callers
 *   - returns CLOSED trades only (open excluded), correct shape + duration
 *   - totals reconcile against the raw closed trades (volume, gross/net, win rate)
 *   - filtering by symbol / account(login) / reason / date narrows the set
 *     and the totals follow the filtered set
 *   - unknown login → empty result (not an error)
 *   - limit/offset paginate while totals stay over the full filtered set
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
 * Seed a deterministic fixture used by most tests:
 *   acct A (login 80001234): BTCUSD buy closed +50 (held 1h), BTCUSD sell closed -20 (held 90m)
 *   acct B (login 80005678): ETHUSD buy closed +30, reason=admin_close (closed 30m ago)
 *   acct A: BTCUSD buy OPEN (must be excluded)
 */
function seedFixture() {
  const admin = seed.user({ id: 'admin-x' });
  seed.profile({ id: admin.id, is_admin: true });
  const tA = seed.user({ id: 'trader-a' });
  const tB = seed.user({ id: 'trader-b' });
  const acctA = seed.account({ id: 'acct-A', user_id: tA.id, login: 80001234 });
  const acctB = seed.account({ id: 'acct-B', user_id: tB.id, login: 80005678 });

  // closed WIN on A: held 1h, closed 60m ago
  seed.trade({ account_id: acctA.id, symbol: 'BTCUSD', side: 'buy', volume: 0.01,
    open_price: 70000, close_price: 70500, status: 'closed', profit: 50,
    open_time: iso(2 * HOUR), close_time: iso(60 * MIN) });
  // closed LOSS on A: held 90m, closed 90m ago
  seed.trade({ account_id: acctA.id, symbol: 'BTCUSD', side: 'sell', volume: 0.02,
    open_price: 71000, close_price: 71200, status: 'closed', profit: -20,
    open_time: iso(3 * HOUR), close_time: iso(90 * MIN) });
  // closed WIN on B: ETH, admin_close, closed 30m ago
  seed.trade({ account_id: acctB.id, symbol: 'ETHUSD', side: 'buy', volume: 0.1,
    open_price: 2000, close_price: 2100, status: 'closed', profit: 30, reason: 'admin_close',
    open_time: iso(5 * HOUR), close_time: iso(30 * MIN) });
  // OPEN on A — must NOT appear in the blotter
  seed.trade({ account_id: acctA.id, symbol: 'BTCUSD', side: 'buy', volume: 0.03,
    open_price: 72000, status: 'open', open_time: iso(10 * MIN) });

  return { admin };
}

describe('GET /api/admin/trades (21.10)', () => {
  beforeEach(() => resetDb());

  it('rejects unauthenticated callers (403)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/admin/trades' });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('rejects non-admin users (403)', async () => {
    const user = seed.user();
    seed.profile({ id: user.id, is_admin: false });
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET', url: '/api/admin/trades', headers: authHeaders(user.id),
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('returns closed trades only, with totals reconciling against raw trades', async () => {
    const { admin } = seedFixture();
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET', url: '/api/admin/trades', headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;

    // 3 closed, the open one excluded
    expect(body.count).toBe(3);
    expect(body.trades).toHaveLength(3);
    expect(body.trades.every((t: any) => t.id != null)).toBe(true);

    // default sort = close_time desc → ETH (30m) first, then BTC win (60m), then BTC loss (90m)
    expect(body.trades.map((t: any) => t.symbol)).toEqual(['ETHUSD', 'BTCUSD', 'BTCUSD']);
    expect(body.sort).toBe('close_time');
    expect(body.dir).toBe('desc');

    // a row carries login + duration
    const eth = body.trades[0];
    expect(eth.login).toBe(80005678);
    expect(eth.reason).toBe('admin_close');
    expect(eth.close_price).toBe(2100);
    expect(eth.duration_seconds).toBe(Math.round((5 * HOUR - 30 * MIN) / 1000));

    // totals: volume = 0.01+0.02+0.1 ; gross +80 / -20 ; net 60 ; house -60 ; 2 wins of 3
    expect(body.totals.count).toBe(3);
    expect(body.totals.volume_lots).toBeCloseTo(0.13, 6);
    expect(body.totals.gross_profit).toBe(80);
    expect(body.totals.gross_loss).toBe(-20);
    expect(body.totals.net_profit).toBe(60);
    expect(body.totals.realized_client_pnl).toBe(60);
    expect(body.totals.realized_house_pnl).toBe(-60);
    expect(body.totals.wins).toBe(2);
    expect(body.totals.win_rate).toBeCloseTo(0.6667, 4);

    await app.close();
  });

  it('filters by symbol and the totals follow the filtered set', async () => {
    const { admin } = seedFixture();
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET', url: '/api/admin/trades?symbol=BTCUSD', headers: authHeaders(admin.id),
    });
    const body = res.json() as any;
    expect(body.count).toBe(2);
    expect(body.trades.every((t: any) => t.symbol === 'BTCUSD')).toBe(true);
    // net over BTC = +50 - 20 = 30
    expect(body.totals.net_profit).toBe(30);
    expect(body.totals.volume_lots).toBeCloseTo(0.03, 6);
    await app.close();
  });

  it('filters by account login (resolved to account_id)', async () => {
    const { admin } = seedFixture();
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET', url: '/api/admin/trades?account=80005678', headers: authHeaders(admin.id),
    });
    const body = res.json() as any;
    expect(body.count).toBe(1);
    expect(body.trades[0].login).toBe(80005678);
    expect(body.trades[0].symbol).toBe('ETHUSD');
    await app.close();
  });

  it('returns an empty set (not an error) for an unknown login', async () => {
    const { admin } = seedFixture();
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET', url: '/api/admin/trades?account=99999999', headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.count).toBe(0);
    expect(body.trades).toHaveLength(0);
    expect(body.totals.count).toBe(0);
    await app.close();
  });

  it('filters by reason', async () => {
    const { admin } = seedFixture();
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET', url: '/api/admin/trades?reason=admin_close', headers: authHeaders(admin.id),
    });
    const body = res.json() as any;
    expect(body.count).toBe(1);
    expect(body.trades[0].reason).toBe('admin_close');
    await app.close();
  });

  it('filters by close_time range (from gte / to lte)', async () => {
    const { admin } = seedFixture();
    const app = await buildApp();

    // from = 45m ago → only trades CLOSED within the last 45m (the ETH @30m)
    const fromRes = await app.inject({
      method: 'GET',
      url: `/api/admin/trades?from=${encodeURIComponent(iso(45 * MIN))}`,
      headers: authHeaders(admin.id),
    });
    const fromBody = fromRes.json() as any;
    expect(fromBody.count).toBe(1);
    expect(fromBody.trades[0].symbol).toBe('ETHUSD');

    // to = 45m ago → only trades CLOSED at/earlier than 45m ago (the two BTC @60m/90m)
    const toRes = await app.inject({
      method: 'GET',
      url: `/api/admin/trades?to=${encodeURIComponent(iso(45 * MIN))}`,
      headers: authHeaders(admin.id),
    });
    const toBody = toRes.json() as any;
    expect(toBody.count).toBe(2);
    expect(toBody.trades.every((t: any) => t.symbol === 'BTCUSD')).toBe(true);

    await app.close();
  });

  it('paginates with limit/offset while totals stay over the full set', async () => {
    const { admin } = seedFixture();
    const app = await buildApp();

    const page1 = await app.inject({
      method: 'GET', url: '/api/admin/trades?limit=2&offset=0&sort=close_time&dir=desc',
      headers: authHeaders(admin.id),
    });
    const b1 = page1.json() as any;
    expect(b1.trades).toHaveLength(2);
    expect(b1.count).toBe(3);          // full filtered count
    expect(b1.totals.count).toBe(3);   // totals over the whole set, not the page
    expect(b1.limit).toBe(2);
    expect(b1.offset).toBe(0);

    const page2 = await app.inject({
      method: 'GET', url: '/api/admin/trades?limit=2&offset=2&sort=close_time&dir=desc',
      headers: authHeaders(admin.id),
    });
    const b2 = page2.json() as any;
    expect(b2.trades).toHaveLength(1); // remainder
    expect(b2.count).toBe(3);

    // no id appears on both pages
    const ids1 = b1.trades.map((t: any) => t.id);
    const ids2 = b2.trades.map((t: any) => t.id);
    expect(ids1.filter((id: number) => ids2.includes(id))).toHaveLength(0);

    await app.close();
  });

  it('sorts by profit ascending when requested', async () => {
    const { admin } = seedFixture();
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET', url: '/api/admin/trades?sort=profit&dir=asc', headers: authHeaders(admin.id),
    });
    const body = res.json() as any;
    const profits = body.trades.map((t: any) => t.profit);
    expect(profits).toEqual([-20, 30, 50]);
    await app.close();
  });
});
