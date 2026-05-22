import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  resetDb,
  seed,
  supabaseAdmin as mockSupa,
  authUser as mockAuthUser,
  issueToken,
  getTable,
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
vi.mock('../src/lib/achievements.js', () => ({
  awardAchievement: vi.fn(async () => true),
  checkFirstTrade: vi.fn(async () => {}),
  checkFiveWins: vi.fn(async () => {}),
  checkRiskMaster: vi.fn(async () => {}),
  checkBalance1000: vi.fn(async () => {}),
  checkRobotEngineer: vi.fn(async () => {}),
}));
vi.mock('../src/lib/push.js', () => ({
  sendPush: vi.fn(async () => ({ ok: true })),
  sendPushChecked: vi.fn(async () => ({ ok: true })),
  sendPushBatch: vi.fn(async () => ({ ok: true })),
}));

const { buildApp } = await import('./helpers/app.js');

const ACCT = '11111111-1111-1111-1111-111111111111';

function authHeaders(userId: string) {
  return { authorization: `Bearer ${issueToken(userId)}` };
}

describe('POST /api/orders/open', () => {
  beforeEach(() => {
    resetDb();
    setQuote({ symbol: 'EURUSD', bid: 1.0999, ask: 1.1001, ts: Date.now() });
  });

  it('rejects unauthenticated requests (401)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      payload: { accountId: ACCT, symbol: 'EURUSD', side: 'buy', volume: 0.01 },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('opens a market buy and reserves margin', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: { accountId: ACCT, symbol: 'EURUSD', side: 'buy', volume: 0.01 },
    });
    expect(res.statusCode).toBe(200);
    const { trade } = res.json();
    expect(trade.symbol).toBe('EURUSD');
    expect(trade.side).toBe('buy');
    expect(trade.open_price).toBe(1.1001); // ask side for buy
    expect(trade.status).toBe('open');

    // 0.01 * 1.1001 * 100_000 / 100 = 11.001 → rounded 11
    const acct = getTable('accounts')[0];
    expect(acct.margin_used).toBeGreaterThan(10);
    expect(acct.free_margin).toBeLessThan(10_000);
    await app.close();
  });

  it('returns 400 with no_quote when the symbol has no price', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: { accountId: ACCT, symbol: 'XYZUSD', side: 'buy', volume: 0.01 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('no_quote');
    await app.close();
  });

  it('returns 400 insufficient_margin when free_margin < required', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 5, margin_used: 0, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: { accountId: ACCT, symbol: 'EURUSD', side: 'buy', volume: 0.1 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('insufficient_margin');
    await app.close();
  });

  it('rejects malformed payload with 400 invalid_input', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: { accountId: ACCT, symbol: 'EURUSD', side: 'sideways', volume: 0.01 },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 403 when the account belongs to a different user', async () => {
    const owner = seed.user({ id: 'user-1' });
    const intruder = seed.user({ id: 'user-2' });
    seed.account({ id: ACCT, user_id: owner.id });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(intruder.id),
      payload: { accountId: ACCT, symbol: 'EURUSD', side: 'buy', volume: 0.01 },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  // ── T.1 — pending limit orders ────────────────────────────────────────
  it('opens a buy-limit at status=pending with margin reserved at trigger price', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.1,
        orderType: 'limit',
        triggerPrice: 1.05, // below current ask (1.1001)
      },
    });
    expect(res.statusCode).toBe(200);
    const { trade } = res.json();
    expect(trade.status).toBe('pending');
    expect(trade.order_type).toBe('limit');
    expect(Number(trade.trigger_price)).toBe(1.05);
    expect(trade.open_price).toBeNull();
    const acct = getTable('accounts')[0];
    // Margin reserved against trigger price.
    expect(acct.margin_used).toBeGreaterThan(0);
    expect(acct.free_margin).toBeLessThan(10_000);
    await app.close();
  });

  it('rejects buy-limit with trigger above current ask (400 invalid_trigger_price)', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.01,
        orderType: 'limit',
        triggerPrice: 1.5, // ABOVE current ask 1.1001
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_trigger_price');
    await app.close();
  });

  it('T.2: opens buy-stop pending order (trigger above current ask)', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.01,
        orderType: 'stop',
        triggerPrice: 1.3, // above current ask 1.1001 — valid breakout entry
      },
    });
    expect(res.statusCode).toBe(200);
    const { trade } = res.json();
    expect(trade.status).toBe('pending');
    expect(trade.order_type).toBe('stop');
    expect(Number(trade.trigger_price)).toBe(1.3);
    expect(trade.open_price).toBeNull();
    await app.close();
  });

  it('T.2: rejects buy-stop with trigger below current ask (400 invalid_trigger_price)', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.01,
        orderType: 'stop',
        triggerPrice: 1.05, // BELOW current ask 1.1001 — wrong direction for stop
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_trigger_price');
    await app.close();
  });

  it('T.2: opens sell-stop pending order (trigger below current bid)', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'sell',
        volume: 0.01,
        orderType: 'stop',
        triggerPrice: 0.95, // below current bid 1.1000 — valid breakdown entry
      },
    });
    expect(res.statusCode).toBe(200);
    const { trade } = res.json();
    expect(trade.status).toBe('pending');
    expect(trade.order_type).toBe('stop');
    expect(Number(trade.trigger_price)).toBe(0.95);
    await app.close();
  });

  // T.3 — stop_limit orders
  // Quote mock: EURUSD ask=1.10 bid=1.09 (from supabaseMock setQuote in beforeEach)

  it('T.3: buy stop_limit happy path — pending row with trigger + limit_price', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.1,
        orderType: 'stop_limit',
        triggerPrice: 1.30, // above current ask 1.10 — breakout stop
        limitPrice: 1.32,   // limit >= trigger for buy
      },
    });
    expect(res.statusCode).toBe(200);
    const { trade } = res.json();
    expect(trade.status).toBe('pending');
    expect(trade.order_type).toBe('stop_limit');
    expect(Number(trade.trigger_price)).toBe(1.30);
    expect(Number(trade.limit_price)).toBe(1.32);
    await app.close();
  });

  it('T.3: sell stop_limit happy path — pending row with trigger + limit_price', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'sell',
        volume: 0.1,
        orderType: 'stop_limit',
        triggerPrice: 0.95, // below current bid 1.09 — breakdown stop
        limitPrice: 0.93,   // limit <= trigger for sell
      },
    });
    expect(res.statusCode).toBe(200);
    const { trade } = res.json();
    expect(trade.status).toBe('pending');
    expect(trade.order_type).toBe('stop_limit');
    expect(Number(trade.trigger_price)).toBe(0.95);
    expect(Number(trade.limit_price)).toBe(0.93);
    await app.close();
  });

  it('T.3: buy stop_limit — bad trigger (at or below ask) → 400 invalid_trigger_price', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.1,
        orderType: 'stop_limit',
        triggerPrice: 1.05, // below ask — wrong direction for buy-stop
        limitPrice: 1.10,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_trigger_price');
    await app.close();
  });

  it('T.3: buy stop_limit — limit below trigger → 400 invalid_limit_price', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.1,
        orderType: 'stop_limit',
        triggerPrice: 1.30,
        limitPrice: 1.20, // limit < trigger for buy — invalid
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_limit_price');
    await app.close();
  });

  it('T.3: stop_limit missing limitPrice → 400 invalid_limit_price', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.1,
        orderType: 'stop_limit',
        triggerPrice: 1.30,
        // no limitPrice
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_limit_price');
    await app.close();
  });

  it('is idempotent: same clientRequestId returns the same trade row, only one position opens', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, leverage: 100 });
    const reqId = '22222222-2222-2222-2222-222222222222';
    const app = await buildApp();
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.01,
        clientRequestId: reqId,
      },
    });
    expect(r1.statusCode).toBe(200);
    const r2 = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.01,
        clientRequestId: reqId,
      },
    });
    expect(r2.statusCode).toBe(200);
    expect(r2.json().trade.id).toBe(r1.json().trade.id);
    expect(getTable('trades').length).toBe(1);
    await app.close();
  });
});

describe('POST /api/orders/close', () => {
  beforeEach(() => {
    resetDb();
    setQuote({ symbol: 'EURUSD', bid: 1.1099, ask: 1.1101, ts: Date.now() });
  });

  it('closes an open trade and releases margin', async () => {
    const u = seed.user({ id: 'user-1' });
    const acct = seed.account({
      id: ACCT,
      user_id: u.id,
      free_margin: 9_889,
      margin_used: 111,
      leverage: 100,
    });
    const t = seed.trade({
      id: 42,
      account_id: acct.id,
      symbol: 'EURUSD',
      side: 'buy',
      volume: 0.1,
      open_price: 1.1001,
      status: 'open',
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/close',
      headers: authHeaders(u.id),
      payload: { tradeId: t.id },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tradeId).toBe(42);
    expect(body.profit).toBeGreaterThan(0); // bought at 1.1001, closed at bid 1.1099
    const closedTrade = getTable('trades').find((x) => x.id === 42)!;
    expect(closedTrade.status).toBe('closed');
    // margin_used should be reduced
    const acctAfter = getTable('accounts')[0];
    expect(acctAfter.margin_used).toBeLessThan(111);
    await app.close();
  });

  it('returns 403 (filtered) when closing an already-closed trade', async () => {
    const u = seed.user({ id: 'user-1' });
    const acct = seed.account({ id: ACCT, user_id: u.id });
    seed.trade({ id: 7, account_id: acct.id, status: 'closed' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/close',
      headers: authHeaders(u.id),
      payload: { tradeId: 7 },
    });
    // Route filters .eq('status','open'), then 403 since not found / not owned by user
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('returns 401 without auth header', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/close',
      payload: { tradeId: 1 },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('returns 400 invalid_input on missing tradeId', async () => {
    const u = seed.user({ id: 'user-1' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/close',
      headers: authHeaders(u.id),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('POST /api/orders/close — T.6 partial close', () => {
  beforeEach(() => {
    resetDb();
    setQuote({ symbol: 'EURUSD', bid: 1.1099, ask: 1.1101, ts: Date.now() });
  });

  it('partial close: reduces parent volume and inserts a closed child row', async () => {
    const u = seed.user({ id: 'user-1' });
    const acct = seed.account({
      id: ACCT,
      user_id: u.id,
      free_margin: 9_778,
      margin_used: 222,
      leverage: 100,
    });
    const t = seed.trade({
      id: 55,
      account_id: acct.id,
      symbol: 'EURUSD',
      side: 'buy',
      volume: 0.2,
      open_price: 1.1001,
      status: 'open',
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/close',
      headers: authHeaders(u.id),
      payload: { tradeId: t.id, closeVolume: 0.1 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.closedVolume).toBeCloseTo(0.1);
    expect(body.remainingVolume).toBeCloseTo(0.1);
    expect(body.profit).toBeGreaterThan(0);
    // Parent row should still be open with reduced volume
    const parentRow = getTable('trades').find((x) => x.id === 55)!;
    expect(parentRow.status).toBe('open');
    expect(Number(parentRow.volume)).toBeCloseTo(0.1);
    // A child row should exist as 'closed'
    const childRow = getTable('trades').find((x) => x.id !== 55 && (x as any).status === 'closed');
    expect(childRow).toBeTruthy();
    expect(Number((childRow as any).volume)).toBeCloseTo(0.1);
    expect((childRow as any).reason).toBe('partial_close');
    await app.close();
  });

  it('partial close with volume >= full volume performs a full close', async () => {
    const u = seed.user({ id: 'user-1' });
    const acct = seed.account({ id: ACCT, user_id: u.id, free_margin: 9_889, margin_used: 111, leverage: 100 });
    const t = seed.trade({
      id: 66,
      account_id: acct.id,
      symbol: 'EURUSD',
      side: 'buy',
      volume: 0.1,
      open_price: 1.1001,
      status: 'open',
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/close',
      headers: authHeaders(u.id),
      payload: { tradeId: t.id, closeVolume: 0.1 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Full close path — no closedVolume in response
    expect(body.tradeId).toBe(66);
    const row = getTable('trades').find((x) => x.id === 66)!;
    expect(row.status).toBe('closed');
    await app.close();
  });

  it('partial close returns 400 on invalid (zero) closeVolume', async () => {
    const u = seed.user({ id: 'user-1' });
    const acct = seed.account({ id: ACCT, user_id: u.id });
    seed.trade({ id: 77, account_id: acct.id, symbol: 'EURUSD', side: 'buy', volume: 0.1, open_price: 1.1001, status: 'open' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/close',
      headers: authHeaders(u.id),
      payload: { tradeId: 77, closeVolume: 0 },
    });
    // closeVolume: 0 fails z.number().positive() — schema rejects it
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('DELETE /api/orders/pending/:id', () => {
  beforeEach(() => {
    resetDb();
    setQuote({ symbol: 'EURUSD', bid: 1.0999, ask: 1.1001, ts: Date.now() });
  });

  it('cancels a pending order: status -> cancelled, margin released', async () => {
    const u = seed.user({ id: 'user-1' });
    const acct = seed.account({
      id: ACCT,
      user_id: u.id,
      free_margin: 9_895,
      margin_used: 105,
      leverage: 100,
    });
    const t = seed.trade({
      id: 99,
      account_id: acct.id,
      symbol: 'EURUSD',
      side: 'buy',
      volume: 0.1,
      open_price: 0 as any,
      status: 'pending' as any,
    });
    // Mock trade insert doesn't carry trigger_price by default; set it for the
    // release-margin math.
    (t as any).trigger_price = 1.05;
    (t as any).order_type = 'limit';

    const app = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/orders/pending/${t.id}`,
      headers: authHeaders(u.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tradeId).toBe(99);
    expect(body.released).toBeGreaterThan(0);
    const updated = getTable('trades').find((x) => x.id === 99)! as any;
    expect(updated.status).toBe('cancelled');
    const acctAfter = getTable('accounts')[0];
    expect(acctAfter.margin_used).toBeLessThan(105);
    await app.close();
  });

  it('returns 400 not_pending when called on an open trade', async () => {
    const u = seed.user({ id: 'user-1' });
    const acct = seed.account({ id: ACCT, user_id: u.id });
    const t = seed.trade({ id: 12, account_id: acct.id, status: 'open' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/orders/pending/${t.id}`,
      headers: authHeaders(u.id),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('not_pending');
    await app.close();
  });

  it('returns 403 when cancelling another user\'s pending order', async () => {
    const owner = seed.user({ id: 'user-1' });
    const intruder = seed.user({ id: 'user-2' });
    const acct = seed.account({ id: ACCT, user_id: owner.id });
    const t = seed.trade({ id: 13, account_id: acct.id, status: 'pending' as any });
    const app = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/orders/pending/${t.id}`,
      headers: authHeaders(intruder.id),
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('returns 401 without auth', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/orders/pending/1',
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe('PATCH /api/orders/modify/:id', () => {
  beforeEach(() => {
    resetDb();
    setQuote({ symbol: 'EURUSD', bid: 1.0999, ask: 1.1001, ts: Date.now() });
  });

  it('T.5: sets SL and TP on an open buy trade', async () => {
    const u = seed.user({ id: 'user-1' });
    const acct = seed.account({ id: ACCT, user_id: u.id, leverage: 100 });
    const t = seed.trade({
      id: 55,
      account_id: acct.id,
      symbol: 'EURUSD',
      side: 'buy',
      volume: 0.1,
      open_price: 1.1001,
      status: 'open',
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/orders/modify/${t.id}`,
      headers: authHeaders(u.id),
      payload: { stopLoss: 1.08, takeProfit: 1.13 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tradeId).toBe(55);
    // Verify DB row was updated
    const updated = getTable('trades').find((x) => x.id === 55)!;
    expect((updated as any).stop_loss).toBe(1.08);
    expect((updated as any).take_profit).toBe(1.13);
    await app.close();
  });

  it('T.5: clears SL/TP when null is passed', async () => {
    const u = seed.user({ id: 'user-1' });
    const acct = seed.account({ id: ACCT, user_id: u.id, leverage: 100 });
    const t = seed.trade({
      id: 56,
      account_id: acct.id,
      symbol: 'EURUSD',
      side: 'buy',
      status: 'open',
      stop_loss: 1.05,
      take_profit: 1.15,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/orders/modify/${t.id}`,
      headers: authHeaders(u.id),
      payload: { stopLoss: null, takeProfit: null },
    });
    expect(res.statusCode).toBe(200);
    const updated = getTable('trades').find((x) => x.id === 56)!;
    expect((updated as any).stop_loss).toBeNull();
    expect((updated as any).take_profit).toBeNull();
    await app.close();
  });

  it('T.5: returns 400 invalid_sl when buy SL is above current ask', async () => {
    const u = seed.user({ id: 'user-1' });
    const acct = seed.account({ id: ACCT, user_id: u.id, leverage: 100 });
    const t = seed.trade({ id: 57, account_id: acct.id, symbol: 'EURUSD', side: 'buy', status: 'open' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/orders/modify/${t.id}`,
      headers: authHeaders(u.id),
      payload: { stopLoss: 1.2 }, // above ask 1.1001 — invalid for a buy SL
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_sl');
    await app.close();
  });

  it('T.5: returns 400 invalid_tp when buy TP is below current ask', async () => {
    const u = seed.user({ id: 'user-1' });
    const acct = seed.account({ id: ACCT, user_id: u.id, leverage: 100 });
    const t = seed.trade({ id: 58, account_id: acct.id, symbol: 'EURUSD', side: 'buy', status: 'open' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/orders/modify/${t.id}`,
      headers: authHeaders(u.id),
      payload: { takeProfit: 1.05 }, // below ask 1.1001 — invalid TP for buy
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_tp');
    await app.close();
  });

  it('T.5: returns 403 when modifying another user\'s trade', async () => {
    const owner = seed.user({ id: 'user-1' });
    const intruder = seed.user({ id: 'user-2' });
    const acct = seed.account({ id: ACCT, user_id: owner.id, leverage: 100 });
    const t = seed.trade({ id: 59, account_id: acct.id, symbol: 'EURUSD', side: 'buy', status: 'open' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/orders/modify/${t.id}`,
      headers: authHeaders(intruder.id),
      payload: { stopLoss: 1.0 },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('T.5: returns 403 when modifying a closed trade', async () => {
    const u = seed.user({ id: 'user-1' });
    const acct = seed.account({ id: ACCT, user_id: u.id, leverage: 100 });
    const t = seed.trade({ id: 60, account_id: acct.id, symbol: 'EURUSD', side: 'buy', status: 'closed' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/orders/modify/${t.id}`,
      headers: authHeaders(u.id),
      payload: { stopLoss: 1.0 },
    });
    // The route filters .eq('status','open') so closed trade won't be found → 403
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('T.5: returns 401 without auth', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/orders/modify/1',
      payload: { stopLoss: 1.0 },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe('T.4 Trailing stop orders', () => {
  beforeEach(() => {
    resetDb();
  });

  it('T.4: buy market order with trailDistance stored on trade row', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.1,
        trailDistance: 0.005, // $0.005 trail for EURUSD
      },
    });
    expect(res.statusCode).toBe(200);
    const { trade } = res.json();
    expect(trade.status).toBe('open');
    expect(Number(trade.trail_distance)).toBeCloseTo(0.005);
    // trail_high_water starts null/undefined -- risk worker sets it on first tick
    expect(trade.trail_high_water ?? null).toBeNull();
    await app.close();
  });

  it('T.4: pending (limit) order ignores trailDistance', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.1,
        orderType: 'limit',
        triggerPrice: 1.08,       // below ask 1.1001 -- valid buy-limit
        trailDistance: 0.005,     // should be ignored for pending orders
      },
    });
    expect(res.statusCode).toBe(200);
    const { trade } = res.json();
    expect(trade.status).toBe('pending');
    expect(trade.trail_distance).toBeNull();
    await app.close();
  });

  it('T.4: trailDistance is optional -- omitting it leaves column null', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: { accountId: ACCT, symbol: 'EURUSD', side: 'buy', volume: 0.1 },
    });
    expect(res.statusCode).toBe(200);
    const { trade } = res.json();
    expect(trade.trail_distance).toBeNull();
    await app.close();
  });

  it('T.4: trailDistance must be positive -- zero rejected', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: { accountId: ACCT, symbol: 'EURUSD', side: 'buy', volume: 0.1, trailDistance: 0 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_input');
    await app.close();
  });

  // ── T.7 Bracket orders (entry + SL + TP validation on open) ─────────────────

  it('T.7: market buy with valid SL and TP stores both on the trade row', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.1,
        stopLoss: 1.0800,    // below ask 1.1001 — valid
        takeProfit: 1.1300,  // above ask 1.1001 — valid
      },
    });
    expect(res.statusCode).toBe(200);
    const { trade } = res.json();
    expect(trade.status).toBe('open');
    expect(Number(trade.stop_loss)).toBeCloseTo(1.08);
    expect(Number(trade.take_profit)).toBeCloseTo(1.13);
    await app.close();
  });

  it('T.7: buy SL above ask → 400 invalid_sl', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.1,
        stopLoss: 1.1100,  // above ask 1.1001 — invalid
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_sl');
    await app.close();
  });

  it('T.7: buy TP below ask → 400 invalid_tp', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.1,
        takeProfit: 1.0500,  // below ask 1.1001 — invalid
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_tp');
    await app.close();
  });

  it('T.7: sell SL below bid → 400 invalid_sl', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'sell',
        volume: 0.1,
        stopLoss: 1.0800,  // below bid 1.0999 — invalid for sell
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_sl');
    await app.close();
  });
});

// ── T.8 OCO orders (one-cancels-other) ─────────────────────────────────────
describe('T.8 OCO orders', () => {
  beforeEach(() => {
    resetDb();
    setQuote({ symbol: 'EURUSD', bid: 1.0999, ask: 1.1001, ts: Date.now() });
  });

  const OCO_ID = '7b3aaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

  it('T.8: pending buy-limit accepts ocoGroupId and stores it on the row', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.1,
        orderType: 'limit',
        triggerPrice: 1.05, // below ask -- valid buy-limit
        ocoGroupId: OCO_ID,
      },
    });
    expect(res.statusCode).toBe(200);
    const { trade } = res.json();
    expect(trade.status).toBe('pending');
    expect(trade.oco_group_id).toBe(OCO_ID);
    await app.close();
  });

  it('T.8: market order with ocoGroupId is rejected (400 invalid_input)', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.1,
        // orderType omitted -> market default
        ocoGroupId: OCO_ID,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_input');
    await app.close();
  });

  it('T.8: malformed ocoGroupId rejected at schema (400 invalid_input)', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.1,
        orderType: 'limit',
        triggerPrice: 1.05,
        ocoGroupId: 'not-a-uuid',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_input');
    await app.close();
  });

  // The sibling-cancellation behaviour lives in the orders-trigger worker,
  // so we drive a single tick() directly here against the in-memory DB to
  // verify: leg A fills -> leg B flips to 'cancelled' and margin is released.
  it('T.8: when one leg fills, the OCO sibling is cancelled and margin released', async () => {
    const u = seed.user({ id: 'user-1' });
    const accountId = ACCT;
    seed.account({ id: accountId, user_id: u.id, free_margin: 10_000, margin_used: 200, leverage: 100 });

    // Two pending legs sharing the OCO group:
    //   leg A: buy-stop above the current ask (will fill when ask >= trigger)
    //   leg B: buy-limit below the current ask (sibling -- should be cancelled)
    const legA = seed.trade({
      account_id: accountId,
      symbol: 'EURUSD',
      side: 'buy',
      volume: 0.1,
      open_price: 0 as any,
      current_price: 0 as any,
      status: 'pending',
      order_type: 'stop',
      trigger_price: 1.20, // will fill when ask jumps to 1.21
      oco_group_id: OCO_ID,
    });
    const legB = seed.trade({
      account_id: accountId,
      symbol: 'EURUSD',
      side: 'buy',
      volume: 0.1,
      open_price: 0 as any,
      current_price: 0 as any,
      status: 'pending',
      order_type: 'limit',
      trigger_price: 1.05, // below ask -- valid buy-limit, won't fill at 1.21
      oco_group_id: OCO_ID,
    });

    // Move the quote so leg A's stop fires (ask above its trigger).
    setQuote({ symbol: 'EURUSD', bid: 1.2099, ask: 1.2101, ts: Date.now() });

    // Drive one worker tick.
    const { _ordersTriggerInternals } = await import('../src/workers/ordersTrigger.js');
    const fakeApp: any = {
      log: {
        info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, fatal: () => {}, trace: () => {},
      },
    };
    await _ordersTriggerInternals.tick(fakeApp);

    const trades = getTable('trades');
    const a = trades.find((t) => t.id === legA.id)!;
    const b = trades.find((t) => t.id === legB.id)!;

    // Leg A filled (status open, fill price = its trigger).
    expect(a.status).toBe('open');
    expect(Number(a.open_price)).toBe(1.20);
    // Leg B cancelled by the OCO logic.
    expect(b.status).toBe('cancelled');

    // Margin reservation for leg B (0.1 * 1.05 * 100_000 / 100 = 105) was released.
    const acct = getTable('accounts').find((x) => x.id === accountId)!;
    // We started at margin_used=200, no reservation on fill (leg A was already
    // pending so no extra margin was reserved here), and leg B's 105 was
    // released by the OCO cancel. So margin_used should drop by ~105.
    expect(acct.margin_used).toBeLessThan(200);
    expect(acct.margin_used).toBeGreaterThanOrEqual(0);
    await app_close_noop();
  });
});

// ── T.9 Hedging mode ────────────────────────────────────────────────────────
describe('T.9 Hedging mode', () => {
  let app: any;
  beforeEach(async () => {
    resetDb();
    app = await buildApp();
  });

  it('T.9: hedging ON — buy + sell on same symbol both remain open', async () => {
    const userId = 'user-hedging-1';
    const T9_ACCT_1 = 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa';
    seed.user({ id: userId });
    const acct = seed.account({ id: T9_ACCT_1, user_id: userId, free_margin: 10_000, margin_used: 0, hedging_enabled: true });
    const token = issueToken(userId);
    setQuote({ symbol: 'BTCUSD', bid: 75_000, ask: 75_010, ts: Date.now() });

    // Open buy.
    const r1 = await app.inject({
      method: 'POST', url: '/api/orders/open',
      headers: { authorization: `Bearer ${token}` },
      payload: { accountId: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.1 },
    });
    expect(r1.statusCode).toBe(200);
    const buyId = JSON.parse(r1.body).trade.id;

    // Open opposing sell.
    const r2 = await app.inject({
      method: 'POST', url: '/api/orders/open',
      headers: { authorization: `Bearer ${token}` },
      payload: { accountId: acct.id, symbol: 'BTCUSD', side: 'sell', volume: 0.1 },
    });
    expect(r2.statusCode).toBe(200);
    const sellId = JSON.parse(r2.body).trade.id;

    const trades = getTable('trades');
    const buy = trades.find((t: any) => t.id === buyId)!;
    const sell = trades.find((t: any) => t.id === sellId)!;
    // Both should be open.
    expect(buy.status).toBe('open');
    expect(sell.status).toBe('open');
    await app.close();
  });

  it('T.9: hedging OFF — equal opposing position is netted out (no new trade)', async () => {
    const userId = 'user-netting-1';
    const T9_ACCT_2 = 'aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa';
    seed.user({ id: userId });
    const acct = seed.account({ id: T9_ACCT_2, user_id: userId, free_margin: 10_000, margin_used: 0, hedging_enabled: false });
    const token = issueToken(userId);
    setQuote({ symbol: 'BTCUSD', bid: 75_000, ask: 75_010, ts: Date.now() });

    // Open a sell position first.
    const r1 = await app.inject({
      method: 'POST', url: '/api/orders/open',
      headers: { authorization: `Bearer ${token}` },
      payload: { accountId: acct.id, symbol: 'BTCUSD', side: 'sell', volume: 0.1 },
    });
    expect(r1.statusCode).toBe(200);
    const sellId = JSON.parse(r1.body).trade.id;

    // Open equal buy — should net out the sell, not open a new trade.
    const r2 = await app.inject({
      method: 'POST', url: '/api/orders/open',
      headers: { authorization: `Bearer ${token}` },
      payload: { accountId: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.1 },
    });
    expect(r2.statusCode).toBe(200);
    const body2 = JSON.parse(r2.body);
    // netted flag present, no new 'trade' key
    expect(body2.netted).toBe(true);
    expect(body2.closedTradeId).toBe(sellId);

    const trades = getTable('trades');
    const sellTrade = trades.find((t: any) => t.id === sellId)!;
    // The sell should now be closed.
    expect(sellTrade.status).toBe('closed');
    expect(sellTrade.reason).toBe('netting');
    // No new open buy trade should exist.
    const openBuys = trades.filter((t: any) => t.account_id === acct.id && t.side === 'buy' && t.status === 'open');
    expect(openBuys).toHaveLength(0);
    await app.close();
  });

  it('T.9: hedging OFF — smaller opposing buy partially nets the sell, sell volume reduced', async () => {
    const userId = 'user-netting-2';
    const T9_ACCT_3 = 'aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa';
    seed.user({ id: userId });
    const acct = seed.account({ id: T9_ACCT_3, user_id: userId, free_margin: 10_000, margin_used: 0, hedging_enabled: false });
    const token = issueToken(userId);
    setQuote({ symbol: 'BTCUSD', bid: 75_000, ask: 75_010, ts: Date.now() });

    // Open a sell 0.2 lots.
    const r1 = await app.inject({
      method: 'POST', url: '/api/orders/open',
      headers: { authorization: `Bearer ${token}` },
      payload: { accountId: acct.id, symbol: 'BTCUSD', side: 'sell', volume: 0.2 },
    });
    expect(r1.statusCode).toBe(200);
    const sellId = JSON.parse(r1.body).trade.id;

    // Open buy 0.1 — should partially close the sell (reduce to 0.1).
    const r2 = await app.inject({
      method: 'POST', url: '/api/orders/open',
      headers: { authorization: `Bearer ${token}` },
      payload: { accountId: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.1 },
    });
    expect(r2.statusCode).toBe(200);
    const body2 = JSON.parse(r2.body);
    expect(body2.netted).toBe(true);

    const trades = getTable('trades');
    const sellTrade = trades.find((t: any) => t.id === sellId)!;
    // Sell should still be open but volume reduced.
    expect(sellTrade.status).toBe('open');
    expect(Number(sellTrade.volume)).toBeCloseTo(0.1, 5);
    await app.close();
  });
});

// Some tests above used `app.close()`; the worker test doesn't construct a
// Fastify app, so this is a tiny no-op shim to keep the symmetry.
async function app_close_noop() {}
