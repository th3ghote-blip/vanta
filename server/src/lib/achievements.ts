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
  | 'first_trade'
  | 'five_wins'
  | 'risk_master'
  | 'robot_engineer'
  | 'seven_day_streak'
  | 'first_deposit'
  | 'balance_1000';

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
