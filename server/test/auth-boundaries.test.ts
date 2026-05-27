import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
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

const ACCT_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ACCT_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

// ── Auth boundaries ───────────────────────────────────────────────────────────

describe('Auth boundaries', () => {
  beforeEach(() => {
    resetDb();
    setQuote({ symbol: 'BTCUSD', bid: 75999, ask: 76001, ts: Date.now() });
  });

  it('unauthenticated /api/orders/open -> 401', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      payload: { accountId: ACCT_A, symbol: 'BTCUSD', side: 'buy', volume: 0.01 },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('unauthenticated /api/account/all -> 401', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/account/all' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('unauthenticated /api/account/profile -> 401', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/account/profile' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('user A cannot open trade on user B account -> 403', async () => {
    const userA = seed.user({ id: 'user-a' });
    const userB = seed.user({ id: 'user-b' });
    seed.account({ id: ACCT_A, user_id: userA.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    seed.account({ id: ACCT_B, user_id: userB.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: { authorization: `Bearer ${issueToken(userA.id)}` },
      payload: { accountId: ACCT_B, symbol: 'BTCUSD', side: 'buy', volume: 0.01 },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('user A cannot close user B trade -> 403', async () => {
    const userA = seed.user({ id: 'user-a' });
    const userB = seed.user({ id: 'user-b' });
    seed.account({ id: ACCT_A, user_id: userA.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    seed.account({ id: ACCT_B, user_id: userB.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const trade = seed.trade({
      account_id: ACCT_B, symbol: 'BTCUSD', side: 'buy', volume: 0.01,
      open_price: 76001, status: 'open', margin_used: 10,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/close',
      headers: { authorization: `Bearer ${issueToken(userA.id)}` },
      payload: { tradeId: trade.id, accountId: ACCT_B },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('malformed JWT -> 401 not 500', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/account/profile',
      headers: { authorization: 'Bearer not.a.real.jwt' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.statusCode).not.toBe(500);
    await app.close();
  });
});

// ── Input validation ──────────────────────────────────────────────────────────

describe('Input validation', () => {
  beforeEach(() => {
    resetDb();
    setQuote({ symbol: 'BTCUSD', bid: 75999, ask: 76001, ts: Date.now() });
  });

  async function openOrder(u: ReturnType<typeof seed.user>, payload: object) {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/open',
      headers: { authorization: `Bearer ${issueToken(u.id)}` },
      payload,
    });
    await app.close();
    return res;
  }

  it('volume = 0 -> 400', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT_A, user_id: u.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const res = await openOrder(u, { accountId: ACCT_A, symbol: 'BTCUSD', side: 'buy', volume: 0 });
    expect(res.statusCode).toBe(400);
  });

  it('volume negative -> 400', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT_A, user_id: u.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const res = await openOrder(u, { accountId: ACCT_A, symbol: 'BTCUSD', side: 'buy', volume: -1 });
    expect(res.statusCode).toBe(400);
  });

  it('invalid side -> 400', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT_A, user_id: u.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const res = await openOrder(u, { accountId: ACCT_A, symbol: 'BTCUSD', side: 'sideways', volume: 0.01 });
    expect(res.statusCode).toBe(400);
  });

  it('missing symbol -> 400', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT_A, user_id: u.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const res = await openOrder(u, { accountId: ACCT_A, side: 'buy', volume: 0.01 });
    expect(res.statusCode).toBe(400);
  });

  it('missing accountId -> 400', async () => {
    const u = seed.user({ id: 'user-1' });
    const res = await openOrder(u, { symbol: 'BTCUSD', side: 'buy', volume: 0.01 });
    expect(res.statusCode).toBe(400);
  });

  it('authenticated /api/account/all -> 200 with accounts array', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT_A, user_id: u.id, free_margin: 10_000, margin_used: 0, leverage: 100 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/account/all',
      headers: { authorization: `Bearer ${issueToken(u.id)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().accounts)).toBe(true);
    await app.close();
  });
});
