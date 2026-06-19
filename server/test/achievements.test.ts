/**
 * 22.1 — Expanded achievements catalogue.
 *
 * Exercises the new Phase 22.1 check helpers directly against the in-memory
 * supabase mock (mirrors the adminOnline presence-helper test style):
 *   - volume tiers (1 / 10 / 100 lots)
 *   - trade-count tiers (10 / 50 / 100 placed)
 *   - realized profit (first_green, profit_100, profit_1000)
 *   - gain_10pct (balance >= $11,000)
 *   - tp_planner (10 closed trades with a take-profit)
 *   - diversified (5 distinct symbols)
 *   - robot_master (10 robots)
 *   - awardAchievement idempotency + ACHIEVEMENT_META completeness
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { vi } from 'vitest';
import {
  resetDb,
  seed,
  getTable,
  supabaseAdmin as mockSupa,
  authUser as mockAuthUser,
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

const ach = await import('../src/lib/achievements.js');

/** All achievement codes held by a user, as a Set. */
function held(userId: string): Set<string> {
  return new Set(
    getTable('achievements')
      .filter((a: any) => a.user_id === userId)
      .map((a: any) => a.code),
  );
}

describe('Achievements — Phase 22.1 catalogue', () => {
  beforeEach(() => {
    resetDb();
  });

  it('ACHIEVEMENT_META has an entry for every AchievementCode and the original 7 survive', () => {
    const meta = ach.ACHIEVEMENT_META as Record<string, { label: string; emoji: string; description: string }>;
    // 7 original + 15 new = 22 badges
    expect(Object.keys(meta).length).toBe(22);
    for (const code of Object.keys(meta)) {
      expect(meta[code].label.length).toBeGreaterThan(0);
      expect(meta[code].emoji.length).toBeGreaterThan(0);
      expect(meta[code].description.length).toBeGreaterThan(0);
    }
    for (const code of ['first_trade', 'five_wins', 'risk_master', 'robot_engineer', 'seven_day_streak', 'first_deposit', 'balance_1000']) {
      expect(meta[code]).toBeDefined();
    }
  });

  it('awardAchievement is idempotent (second call is a no-op)', async () => {
    seed.account({ id: 'a1', user_id: 'u1' });
    expect(await ach.awardAchievement('u1', 'first_green')).toBe(true);
    expect(await ach.awardAchievement('u1', 'first_green')).toBe(false);
    expect(getTable('achievements').filter((a: any) => a.code === 'first_green').length).toBe(1);
  });

  it('checkVolumeMilestones awards tiers crossed and skips those not reached', async () => {
    seed.account({ id: 'a1', user_id: 'u1' });
    // 5 + 6 = 11 lots total → volume_1 + volume_10, not volume_100
    seed.trade({ account_id: 'a1', volume: 5, status: 'closed' });
    seed.trade({ account_id: 'a1', volume: 6, status: 'open' });
    await ach.checkVolumeMilestones('u1');
    const h = held('u1');
    expect(h.has('volume_1')).toBe(true);
    expect(h.has('volume_10')).toBe(true);
    expect(h.has('volume_100')).toBe(false);
  });

  it('checkVolumeMilestones awards all three at 100+ lots and is idempotent', async () => {
    seed.account({ id: 'a1', user_id: 'u1' });
    seed.trade({ account_id: 'a1', volume: 120, status: 'closed' });
    await ach.checkVolumeMilestones('u1');
    await ach.checkVolumeMilestones('u1'); // re-run: no duplicates
    const rows = getTable('achievements').filter((a: any) => a.user_id === 'u1');
    expect(new Set(rows.map((r: any) => r.code))).toEqual(new Set(['volume_1', 'volume_10', 'volume_100']));
    expect(rows.length).toBe(3);
  });

  it('checkTradeCountMilestones awards 10 and 50 at 60 trades, not 100', async () => {
    seed.account({ id: 'a1', user_id: 'u1' });
    for (let i = 0; i < 60; i++) seed.trade({ account_id: 'a1' });
    await ach.checkTradeCountMilestones('u1');
    const h = held('u1');
    expect(h.has('trades_10')).toBe(true);
    expect(h.has('trades_50')).toBe(true);
    expect(h.has('trades_100')).toBe(false);
  });

  it('checkProfitMilestones: first_green on any winner, profit_100 on cumulative, even with a net under 1000', async () => {
    seed.account({ id: 'a1', user_id: 'u1' });
    // closed: +150, +20, -30  → realized = 140 → first_green + profit_100, not profit_1000
    seed.trade({ account_id: 'a1', status: 'closed', profit: 150 });
    seed.trade({ account_id: 'a1', status: 'closed', profit: 20 });
    seed.trade({ account_id: 'a1', status: 'closed', profit: -30 });
    // an open trade must not count toward realized
    seed.trade({ account_id: 'a1', status: 'open', profit: 5000 });
    await ach.checkProfitMilestones('u1');
    const h = held('u1');
    expect(h.has('first_green')).toBe(true);
    expect(h.has('profit_100')).toBe(true);
    expect(h.has('profit_1000')).toBe(false);
  });

  it('checkProfitMilestones awards profit_1000 once realized >= 1000', async () => {
    seed.account({ id: 'a1', user_id: 'u1' });
    seed.trade({ account_id: 'a1', status: 'closed', profit: 600 });
    seed.trade({ account_id: 'a1', status: 'closed', profit: 450 });
    await ach.checkProfitMilestones('u1');
    expect(held('u1').has('profit_1000')).toBe(true);
  });

  it('checkProfitMilestones gives no badges when there are only losses', async () => {
    seed.account({ id: 'a1', user_id: 'u1' });
    seed.trade({ account_id: 'a1', status: 'closed', profit: -10 });
    seed.trade({ account_id: 'a1', status: 'closed', profit: -5 });
    await ach.checkProfitMilestones('u1');
    expect(held('u1').size).toBe(0);
  });

  it('checkGain10pct awards at $11,000 balance, not below', async () => {
    seed.account({ id: 'a1', user_id: 'u1', balance: 10_500 });
    await ach.checkGain10pct('u1');
    expect(held('u1').has('gain_10pct')).toBe(false);
    getTable('accounts')[0].balance = 11_000;
    await ach.checkGain10pct('u1');
    expect(held('u1').has('gain_10pct')).toBe(true);
  });

  it('checkTakeProfitPlanner needs 10 closed trades with a take-profit set', async () => {
    seed.account({ id: 'a1', user_id: 'u1' });
    for (let i = 0; i < 9; i++) seed.trade({ account_id: 'a1', status: 'closed', take_profit: 1.5 });
    await ach.checkTakeProfitPlanner('u1');
    expect(held('u1').has('tp_planner')).toBe(false);
    seed.trade({ account_id: 'a1', status: 'closed', take_profit: 1.5 }); // 10th
    // a closed trade without TP and an open one with TP must not help
    seed.trade({ account_id: 'a1', status: 'closed', take_profit: null });
    seed.trade({ account_id: 'a1', status: 'open', take_profit: 1.5 });
    await ach.checkTakeProfitPlanner('u1');
    expect(held('u1').has('tp_planner')).toBe(true);
  });

  it('checkDiversified awards on 5 distinct symbols (duplicates do not count)', async () => {
    seed.account({ id: 'a1', user_id: 'u1' });
    for (const s of ['BTCUSD', 'ETHUSD', 'EURUSD', 'BTCUSD', 'ETHUSD']) seed.trade({ account_id: 'a1', symbol: s });
    await ach.checkDiversified('u1');
    expect(held('u1').has('diversified')).toBe(false); // only 3 distinct
    for (const s of ['XAUUSD', 'GBPUSD']) seed.trade({ account_id: 'a1', symbol: s });
    await ach.checkDiversified('u1');
    expect(held('u1').has('diversified')).toBe(true); // now 5 distinct
  });

  it('checkRobotMaster needs 10 robots built', async () => {
    seed.account({ id: 'a1', user_id: 'u1' });
    for (let i = 0; i < 9; i++) getTable('robots').push({ id: `r${i}`, account_id: 'a1' });
    await ach.checkRobotMaster('u1');
    expect(held('u1').has('robot_master')).toBe(false);
    getTable('robots').push({ id: 'r9', account_id: 'a1' });
    await ach.checkRobotMaster('u1');
    expect(held('u1').has('robot_master')).toBe(true);
  });

  it('checks are a no-op for a user with no accounts', async () => {
    await ach.checkVolumeMilestones('ghost');
    await ach.checkTradeCountMilestones('ghost');
    await ach.checkProfitMilestones('ghost');
    await ach.checkTakeProfitPlanner('ghost');
    await ach.checkDiversified('ghost');
    await ach.checkRobotMaster('ghost');
    expect(held('ghost').size).toBe(0);
  });
});
