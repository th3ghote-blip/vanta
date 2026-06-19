/**
 * Achievements / badges helper — Phase 11.3
 *
 * awardAchievement(userId, code) is idempotent — safe to call on every qualifying event.
 * If the user already holds the badge nothing happens and false is returned.
 * If this is the first qualification the row is inserted and true is returned.
 *
 * All "check and maybe award" helpers are exported so route handlers can call
 * exactly the checks they need without pulling in unrelated tables.
 */
import { supabaseAdmin } from './supabase.js';

export type AchievementCode =
  // Original 7 (Phase 11.3)
  | 'first_trade'
  | 'five_wins'
  | 'risk_master'
  | 'robot_engineer'
  | 'seven_day_streak'
  | 'first_deposit'
  | 'balance_1000'
  // Phase 22.1 - expanded catalogue
  | 'volume_1'
  | 'volume_10'
  | 'volume_100'
  | 'trades_10'
  | 'trades_50'
  | 'trades_100'
  | 'first_green'
  | 'profit_100'
  | 'profit_1000'
  | 'gain_10pct'
  | 'tp_planner'
  | 'diversified'
  | 'three_day_streak'
  | 'thirty_day_streak'
  | 'robot_master';

/** Human-readable metadata served to the client Achievements UI */
export const ACHIEVEMENT_META: Record<
  AchievementCode,
  { label: string; emoji: string; description: string }
> = {
  first_trade:      { emoji: '🚀', label: 'First Trade',      description: 'Place your first trade' },
  five_wins:        { emoji: '⭐', label: 'Five Wins',         description: 'Close 5 profitable trades' },
  risk_master:      { emoji: '🛡️', label: 'Risk Master',       description: 'Complete 10 trades with a stop-loss set' },
  robot_engineer:   { emoji: '🤖', label: 'Robot Engineer',    description: 'Build 3 AI robots' },
  seven_day_streak: { emoji: '🔥', label: '7-Day Streak',      description: 'Log in 7 days in a row' },
  first_deposit:    { emoji: '💰', label: 'First Deposit',     description: 'Make your first deposit' },
  balance_1000:     { emoji: '💎', label: '$1,000 Balance',    description: 'Reach a $1,000 account balance' },
  // Phase 22.1
  volume_1:         { emoji: '🌱', label: 'Getting Started',   description: 'Trade 1 lot in total' },
  volume_10:        { emoji: '📈', label: 'Active Trader',     description: 'Trade 10 lots in total' },
  volume_100:       { emoji: '🐳', label: 'High Roller',       description: 'Trade 100 lots in total' },
  trades_10:        { emoji: '🎯', label: 'Dedicated',         description: 'Place 10 trades' },
  trades_50:        { emoji: '🎖️', label: 'Seasoned Trader',   description: 'Place 50 trades' },
  trades_100:       { emoji: '💯', label: 'Centurion',         description: 'Place 100 trades' },
  first_green:      { emoji: '🍀', label: 'In the Green',      description: 'Close your first profitable trade' },
  profit_100:       { emoji: '💵', label: 'Century Profit',    description: 'Earn $100 in realized profit' },
  profit_1000:      { emoji: '🤑', label: 'Profit Machine',    description: 'Earn $1,000 in realized profit' },
  gain_10pct:       { emoji: '📊', label: 'Up 10%',            description: 'Grow your balance to $11,000' },
  tp_planner:       { emoji: '🏹', label: 'Target Setter',     description: 'Close 10 trades with a take-profit set' },
  diversified:      { emoji: '🌍', label: 'Diversified',       description: 'Trade 5 different symbols' },
  three_day_streak: { emoji: '📅', label: 'Consistent',        description: 'Log in 3 days in a row' },
  thirty_day_streak:{ emoji: '🗓️', label: 'Devoted',           description: 'Log in 30 days in a row' },
  robot_master:     { emoji: '🦾', label: 'Robot Master',      description: 'Build 10 AI robots' },
};

/**
 * Award an achievement badge (idempotent).
 * Returns true if this was a new unlock, false if the user already had it.
 */
export async function awardAchievement(
  userId: string,
  code: AchievementCode,
): Promise<boolean> {
  const { data: existing } = await supabaseAdmin
    .from('achievements')
    .select('id')
    .eq('user_id', userId)
    .eq('code', code)
    .maybeSingle();

  if (existing) return false;

  const { error } = await supabaseAdmin
    .from('achievements')
    .insert({ user_id: userId, code });

  if (error) {
    // 23505 = unique_violation — race condition, already inserted concurrently
    if ((error as any).code === '23505') return false;
    throw error;
  }
  return true;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Return all account IDs belonging to a user. */
async function getUserAccountIds(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('accounts')
    .select('id')
    .eq('user_id', userId);
  return (data ?? []).map((a: any) => a.id as string);
}

// ─── Per-event check functions ────────────────────────────────────────────────

/** Award first_trade if this user now has exactly 1 trade total. */
export async function checkFirstTrade(userId: string): Promise<void> {
  const accountIds = await getUserAccountIds(userId);
  if (accountIds.length === 0) return;
  const { count } = await supabaseAdmin
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .in('account_id', accountIds);
  if ((count ?? 0) === 1) await awardAchievement(userId, 'first_trade');
}

/** Award five_wins if user has >= 5 closed trades with profit > 0. */
export async function checkFiveWins(userId: string): Promise<void> {
  const accountIds = await getUserAccountIds(userId);
  if (accountIds.length === 0) return;
  const { count } = await supabaseAdmin
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .in('account_id', accountIds)
    .eq('status', 'closed')
    .gt('profit', 0);
  if ((count ?? 0) >= 5) await awardAchievement(userId, 'five_wins');
}

/** Award risk_master if user has >= 10 closed trades that had a stop-loss. */
export async function checkRiskMaster(userId: string): Promise<void> {
  const accountIds = await getUserAccountIds(userId);
  if (accountIds.length === 0) return;
  const { count } = await supabaseAdmin
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .in('account_id', accountIds)
    .eq('status', 'closed')
    .not('stop_loss', 'is', null);
  if ((count ?? 0) >= 10) await awardAchievement(userId, 'risk_master');
}

/** Award robot_engineer if user has built >= 3 robots. */
export async function checkRobotEngineer(userId: string): Promise<void> {
  const accountIds = await getUserAccountIds(userId);
  if (accountIds.length === 0) return;
  const { count } = await supabaseAdmin
    .from('robots')
    .select('id', { count: 'exact', head: true })
    .in('account_id', accountIds);
  if ((count ?? 0) >= 3) await awardAchievement(userId, 'robot_engineer');
}

/** Award balance_1000 if any account belonging to the user has balance >= 1000. */
export async function checkBalance1000(userId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from('accounts')
    .select('balance')
    .eq('user_id', userId);
  const max = Math.max(0, ...((data ?? []).map((a: any) => Number(a.balance) || 0)));
  if (max >= 1000) await awardAchievement(userId, 'balance_1000');
}

// --- Phase 22.1 - expanded catalogue checks ---------------------------------
// Each helper mirrors the originals: cheap, idempotent, fire-and-forget. They
// fetch the raw rows and reduce in JS (rather than relying on aggregate SQL) so
// the same code path is exercised by the in-memory test mock.

/** Award the volume tiers (1 / 10 / 100 lots) based on total lots traded. */
export async function checkVolumeMilestones(userId: string): Promise<void> {
  const accountIds = await getUserAccountIds(userId);
  if (accountIds.length === 0) return;
  const { data } = await supabaseAdmin
    .from('trades')
    .select('volume')
    .in('account_id', accountIds);
  const totalLots = (data ?? []).reduce((s: number, t: any) => s + (Number(t.volume) || 0), 0);
  if (totalLots >= 1)   await awardAchievement(userId, 'volume_1');
  if (totalLots >= 10)  await awardAchievement(userId, 'volume_10');
  if (totalLots >= 100) await awardAchievement(userId, 'volume_100');
}

/** Award the trade-count tiers (10 / 50 / 100 trades placed, any status). */
export async function checkTradeCountMilestones(userId: string): Promise<void> {
  const accountIds = await getUserAccountIds(userId);
  if (accountIds.length === 0) return;
  const { count } = await supabaseAdmin
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .in('account_id', accountIds);
  const n = count ?? 0;
  if (n >= 10)  await awardAchievement(userId, 'trades_10');
  if (n >= 50)  await awardAchievement(userId, 'trades_50');
  if (n >= 100) await awardAchievement(userId, 'trades_100');
}

/**
 * Award the realized-profit badges from the user's closed trades:
 *  - first_green: at least one closed trade with profit > 0
 *  - profit_100 / profit_1000: cumulative realized profit thresholds
 */
export async function checkProfitMilestones(userId: string): Promise<void> {
  const accountIds = await getUserAccountIds(userId);
  if (accountIds.length === 0) return;
  const { data } = await supabaseAdmin
    .from('trades')
    .select('profit')
    .in('account_id', accountIds)
    .eq('status', 'closed');
  const profits = (data ?? []).map((t: any) => Number(t.profit) || 0);
  if (profits.some((p) => p > 0)) await awardAchievement(userId, 'first_green');
  const realized = profits.reduce((s, p) => s + p, 0);
  if (realized >= 100)  await awardAchievement(userId, 'profit_100');
  if (realized >= 1000) await awardAchievement(userId, 'profit_1000');
}

/** Award gain_10pct once any account reaches $11,000 (10% over the $10k demo start). */
export async function checkGain10pct(userId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from('accounts')
    .select('balance')
    .eq('user_id', userId);
  const max = Math.max(0, ...((data ?? []).map((a: any) => Number(a.balance) || 0)));
  if (max >= 11000) await awardAchievement(userId, 'gain_10pct');
}

/** Award tp_planner once the user has >= 10 closed trades that had a take-profit set. */
export async function checkTakeProfitPlanner(userId: string): Promise<void> {
  const accountIds = await getUserAccountIds(userId);
  if (accountIds.length === 0) return;
  const { count } = await supabaseAdmin
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .in('account_id', accountIds)
    .eq('status', 'closed')
    .not('take_profit', 'is', null);
  if ((count ?? 0) >= 10) await awardAchievement(userId, 'tp_planner');
}

/** Award diversified once the user has traded >= 5 distinct symbols. */
export async function checkDiversified(userId: string): Promise<void> {
  const accountIds = await getUserAccountIds(userId);
  if (accountIds.length === 0) return;
  const { data } = await supabaseAdmin
    .from('trades')
    .select('symbol')
    .in('account_id', accountIds);
  const distinct = new Set((data ?? []).map((t: any) => t.symbol));
  if (distinct.size >= 5) await awardAchievement(userId, 'diversified');
}

/** Award robot_master once the user has built >= 10 robots. */
export async function checkRobotMaster(userId: string): Promise<void> {
  const accountIds = await getUserAccountIds(userId);
  if (accountIds.length === 0) return;
  const { count } = await supabaseAdmin
    .from('robots')
    .select('id', { count: 'exact', head: true })
    .in('account_id', accountIds);
  if ((count ?? 0) >= 10) await awardAchievement(userId, 'robot_master');
}
