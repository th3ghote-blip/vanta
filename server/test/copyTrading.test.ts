/**
 * QA-2.4 — Copy trading mirror logic tests.
 *
 * Tests `mirrorTradeForFollowers` directly (exported via _copyTradeInternals)
 * so we don't need to deal with fire-and-forget timing from the route.
 *
 * Current coverage:
 *   ✓ 50% allocation mirrors at half volume
 *   ✓ 100% allocation mirrors at exactly same volume
 *   ✓ Follower with insufficient margin → mirror skipped, no error
 *   ✓ Leader with no followers → nothing happens
 *   ✗ Leader closes → follower mirror auto-closes: NOT YET IMPLEMENTED
 *     (the /close route has no mirror-close logic; SL/TP on the mirror row
 *      will fire through the risk worker at the same levels)
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import {
  resetDb,
  seed,
  supabaseAdmin as mockSupa,
  authUser as mockAuthUser,
  getTable,
} from './helpers/supabaseMock.js';
import { setQuote } from '../src/lib/quoteCache.js';

const LEADER_ACCT  = 'acct-leader-0000-0000-000000000001';
const FOLLOWER_ACCT = 'acct-follow-0000-0000-000000000002';

beforeAll(() => {
  process.env.SUPABASE_URL = 'http://localhost:0/fake';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-key';
  process.env.ANTHROPIC_API_KEY = 'fake-anthropic-key';
});

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: mockSupa,
  authUser: mockAuthUser,
}));
vi.mock('../src/lib/push.js', () => ({
  sendPush: vi.fn(async () => ({ ok: true })),
  sendPushChecked: vi.fn(async () => ({ ok: true })),
  sendPushBatch: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../src/lib/achievements.js', () => ({
  awardAchievement: vi.fn(async () => true),
  checkFirstTrade: vi.fn(async () => {}),
  checkFiveWins: vi.fn(async () => {}),
  checkRiskMaster: vi.fn(async () => {}),
  checkBalance1000: vi.fn(async () => {}),
  checkRobotEngineer: vi.fn(async () => {}),
}));

const { _copyTradeInternals } = await import('../src/routes/orders.js');

async function mkLog() {
  const app = Fastify({ logger: false });
  await app.ready();
  return { log: app.log, close: () => app.close() };
}

// ── Helper: build a synthetic leaderTrade record ──────────────────────────────

function mkLeaderTrade(overrides: Partial<{
  symbol: string;
  side: 'buy' | 'sell';
  volume: number;
  open_price: number;
  stop_loss: number | null;
  take_profit: number | null;
}> = {}) {
  return {
    symbol: overrides.symbol ?? 'BTCUSD',
    side: overrides.side ?? 'buy',
    volume: overrides.volume ?? 0.1,
    open_price: overrides.open_price ?? 76001,
    stop_loss: overrides.stop_loss ?? null,
    take_profit: overrides.take_profit ?? null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Copy trading — mirror on leader open', () => {
  beforeEach(() => {
    resetDb();
    setQuote({ symbol: 'BTCUSD', bid: 75999, ask: 76001, ts: Date.now() });
  });

  it('allocation_pct=50 → follower gets 0.05 BTC (half of leader 0.1)', async () => {
    const leader   = seed.user({ id: 'leader-1' });
    const follower = seed.user({ id: 'follower-1' });
    seed.account({ id: LEADER_ACCT,   user_id: leader.id,   free_margin: 10_000, leverage: 100 });
    seed.account({ id: FOLLOWER_ACCT, user_id: follower.id, free_margin: 10_000, leverage: 100 });
    seed.copyRelationship({
      leader_id: leader.id,
      follower_id: follower.id,
      follower_account_id: FOLLOWER_ACCT,
      allocation_pct: 50,
    });

    const leaderTrade = mkLeaderTrade({ volume: 0.1 });
    const { log, close } = await mkLog();
    await _copyTradeInternals.mirrorTradeForFollowers(leader.id, leaderTrade, log);
    await close();

    const mirrorTrades = getTable('trades').filter(
      (t) => t.account_id === FOLLOWER_ACCT && t.reason === 'copy',
    );
    expect(mirrorTrades).toHaveLength(1);
    expect(mirrorTrades[0].volume).toBeCloseTo(0.05, 8);
    expect(mirrorTrades[0].side).toBe('buy');
    expect(mirrorTrades[0].symbol).toBe('BTCUSD');
    expect(mirrorTrades[0].status).toBe('open');
  });

  it('allocation_pct=100 → follower mirrors at exactly same volume', async () => {
    const leader   = seed.user({ id: 'leader-2' });
    const follower = seed.user({ id: 'follower-2' });
    seed.account({ id: LEADER_ACCT,   user_id: leader.id,   free_margin: 10_000, leverage: 100 });
    seed.account({ id: FOLLOWER_ACCT, user_id: follower.id, free_margin: 10_000, leverage: 100 });
    seed.copyRelationship({
      leader_id: leader.id,
      follower_id: follower.id,
      follower_account_id: FOLLOWER_ACCT,
      allocation_pct: 100,
    });

    const leaderTrade = mkLeaderTrade({ volume: 0.1 });
    const { log, close } = await mkLog();
    await _copyTradeInternals.mirrorTradeForFollowers(leader.id, leaderTrade, log);
    await close();

    const mirrorTrades = getTable('trades').filter(
      (t) => t.account_id === FOLLOWER_ACCT && t.reason === 'copy',
    );
    expect(mirrorTrades).toHaveLength(1);
    expect(mirrorTrades[0].volume).toBeCloseTo(0.1, 8);
  });

  it('follower has insufficient margin → mirror is skipped, no error thrown', async () => {
    const leader   = seed.user({ id: 'leader-3' });
    const follower = seed.user({ id: 'follower-3' });
    seed.account({ id: LEADER_ACCT,   user_id: leader.id,   free_margin: 10_000, leverage: 100 });
    // Required margin for 0.05 BTC at 76001 with 100x leverage = 38.0005
    // Set free_margin well below that so the mirror is skipped.
    seed.account({ id: FOLLOWER_ACCT, user_id: follower.id, free_margin: 5, leverage: 100 });
    seed.copyRelationship({
      leader_id: leader.id,
      follower_id: follower.id,
      follower_account_id: FOLLOWER_ACCT,
      allocation_pct: 50,
    });

    const leaderTrade = mkLeaderTrade({ volume: 0.1 });
    const { log, close } = await mkLog();

    // Must NOT throw even when margin is insufficient.
    await expect(
      _copyTradeInternals.mirrorTradeForFollowers(leader.id, leaderTrade, log),
    ).resolves.toBeUndefined();

    await close();

    const mirrorTrades = getTable('trades').filter(
      (t) => t.account_id === FOLLOWER_ACCT && t.reason === 'copy',
    );
    expect(mirrorTrades).toHaveLength(0);
  });

  it('leader with no followers → no mirror trades inserted', async () => {
    const leader = seed.user({ id: 'leader-4' });
    seed.account({ id: LEADER_ACCT, user_id: leader.id, free_margin: 10_000, leverage: 100 });
    // No copy_relationships seeded.

    const leaderTrade = mkLeaderTrade({ volume: 0.1 });
    const { log, close } = await mkLog();
    await _copyTradeInternals.mirrorTradeForFollowers(leader.id, leaderTrade, log);
    await close();

    const allTrades = getTable('trades');
    expect(allTrades).toHaveLength(0);
  });

  it('mirror inherits stop_loss and take_profit from leader trade', async () => {
    const leader   = seed.user({ id: 'leader-5' });
    const follower = seed.user({ id: 'follower-5' });
    seed.account({ id: LEADER_ACCT,   user_id: leader.id,   free_margin: 10_000, leverage: 100 });
    seed.account({ id: FOLLOWER_ACCT, user_id: follower.id, free_margin: 10_000, leverage: 100 });
    seed.copyRelationship({
      leader_id: leader.id,
      follower_id: follower.id,
      follower_account_id: FOLLOWER_ACCT,
      allocation_pct: 50,
    });

    const leaderTrade = mkLeaderTrade({ stop_loss: 74000, take_profit: 80000 });
    const { log, close } = await mkLog();
    await _copyTradeInternals.mirrorTradeForFollowers(leader.id, leaderTrade, log);
    await close();

    const mirrorTrades = getTable('trades').filter(
      (t) => t.account_id === FOLLOWER_ACCT && t.reason === 'copy',
    );
    expect(mirrorTrades).toHaveLength(1);
    expect(mirrorTrades[0].stop_loss).toBe(74000);
    expect(mirrorTrades[0].take_profit).toBe(80000);
  });
});
