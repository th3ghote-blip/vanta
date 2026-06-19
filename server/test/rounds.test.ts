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
  // Phase 22.1
  checkVolumeMilestones: vi.fn(async () => {}),
  checkTradeCountMilestones: vi.fn(async () => {}),
  checkDiversified: vi.fn(async () => {}),
  checkProfitMilestones: vi.fn(async () => {}),
  checkGain10pct: vi.fn(async () => {}),
  checkTakeProfitPlanner: vi.fn(async () => {}),
  checkRobotMaster: vi.fn(async () => {}),
}));
vi.mock('../src/lib/push.js', () => ({
  sendPush: vi.fn(async () => ({ ok: true })),
  sendPushChecked: vi.fn(async () => ({ ok: true })),
  sendPushBatch: vi.fn(async () => ({ ok: true })),
}));

const { buildApp } = await import('./helpers/app.js');

const ACCT = '33333333-3333-3333-3333-333333333333';

function authHeaders(userId: string) {
  return { authorization: `Bearer ${issueToken(userId)}` };
}

describe('POST /api/rounds/open', () => {
  beforeEach(() => {
    resetDb();
    setQuote({ symbol: 'EURUSD', bid: 1.0999, ask: 1.1001, ts: Date.now() });
  });

  it('opens a binary round and deducts the stake from balance', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, balance: 500, free_margin: 500 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/rounds/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        direction: 'buy',
        stake: 10,
        durationSeconds: 60,
      },
    });
    expect(res.statusCode).toBe(200);
    const { round } = res.json();
    expect(round.stake).toBe(10);
    expect(round.payout_multiplier).toBe(1.85);
    expect(round.entry_price).toBeCloseTo(1.1, 3);
    expect(getTable('accounts')[0].balance).toBe(490);
    expect(getTable('binary_rounds').length).toBe(1);
    await app.close();
  });

  it('returns 400 insufficient_balance when stake > balance', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, balance: 5 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/rounds/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        direction: 'buy',
        stake: 10,
        durationSeconds: 60,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('insufficient_balance');
    expect(getTable('binary_rounds').length).toBe(0);
    await app.close();
  });

  it('returns 401 unauthorized without auth', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/rounds/open',
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        direction: 'buy',
        stake: 10,
        durationSeconds: 60,
      },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('returns 403 forbidden when account belongs to another user', async () => {
    const owner = seed.user({ id: 'user-1' });
    const intruder = seed.user({ id: 'user-2' });
    seed.account({ id: ACCT, user_id: owner.id, balance: 500 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/rounds/open',
      headers: authHeaders(intruder.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD',
        direction: 'buy',
        stake: 10,
        durationSeconds: 60,
      },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('rejects a 5s round on a non-realtime (Yahoo) symbol with 400 duration_requires_realtime', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, balance: 500 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/rounds/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'EURUSD', // Yahoo-backed, ~5s poll → not eligible for 5s rounds
        direction: 'buy',
        stake: 10,
        durationSeconds: 5,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('duration_requires_realtime');
    // gate runs before any stake deduction
    expect(getTable('accounts')[0].balance).toBe(500);
    expect(getTable('binary_rounds').length).toBe(0);
    await app.close();
  });

  it('allows a 5s round on a real-time crypto symbol', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, balance: 500 });
    setQuote({ symbol: 'BTCUSD', bid: 71239, ask: 71241, ts: Date.now() });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/rounds/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'BTCUSD',
        direction: 'buy',
        stake: 10,
        durationSeconds: 5,
      },
    });
    expect(res.statusCode).toBe(200);
    const { round } = res.json();
    expect(round.payout_multiplier).toBe(2.0);
    expect(getTable('accounts')[0].balance).toBe(490);
    await app.close();
  });

  it('refunds stake and returns 400 no_quote when symbol has no price', async () => {
    const u = seed.user({ id: 'user-1' });
    seed.account({ id: ACCT, user_id: u.id, balance: 500 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/rounds/open',
      headers: authHeaders(u.id),
      payload: {
        accountId: ACCT,
        symbol: 'NOPRICEUSD',
        direction: 'buy',
        stake: 10,
        durationSeconds: 60,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('no_quote');
    // stake fully refunded
    expect(getTable('accounts')[0].balance).toBe(500);
    await app.close();
  });
});
