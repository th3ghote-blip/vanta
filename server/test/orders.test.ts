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

  it('returns 501 not_implemented for stop orders (T.2 placeholder)', async () => {
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
        triggerPrice: 1.2,
      },
    });
    expect(res.statusCode).toBe(501);
    expect(res.json().error).toBe('not_implemented');
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
