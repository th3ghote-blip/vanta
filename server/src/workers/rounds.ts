import type { FastifyInstance } from 'fastify';

import { supabaseAdmin } from '../lib/supabase.js';
import { getMid } from '../lib/quoteCache.js';
import { recordTick } from '../lib/workerHealth.js';

/**
 * Rounds settler — Phase 2.1 + 2.6
 *
 * Every 1s: query binary_rounds where outcome='pending' AND closes_at <= now().
 * For each:
 *   1. Read exit_price from quote cache (mid).
 *   2. Determine outcome:
 *      - win:  (direction='buy'  AND exit > entry) OR (direction='sell' AND exit < entry)
 *      - loss: (direction='buy'  AND exit < entry) OR (direction='sell' AND exit > entry)
 *      - tie:  exit == entry (exact)
 *   3. On win:  payout = stake * payout_multiplier. Credit via apply_trade_pnl.
 *      On loss/tie: balance unchanged — stake already deducted on open (Phase 2.2).
 *   4. CAS guard: update only where outcome='pending' to prevent double-settle.
 *   5. Update profiles.current_streak / best_streak (Phase 2.6):
 *      win -> streak++, update best if exceeded; loss/tie -> streak = 0.
 *
 * A single tick runs at a time (overlap guard); if a tick takes >1s it is just
 * delayed, never doubled.
 */

type Direction = 'buy' | 'sell';

interface PendingRound {
  id: string;
  account_id: string;
  symbol: string;
  direction: Direction;
  stake: number;
  payout_multiplier: number;
  entry_price: number;
}

/**
 * Update current_streak and best_streak on the user's profile after a round settles.
 * win  -> current_streak + 1; update best_streak if exceeded.
 * loss / tie -> current_streak = 0.
 *
 * Errors here are non-fatal -- we log and move on rather than blocking settle.
 */
async function updateStreak(
  app: FastifyInstance,
  accountId: string,
  outcome: 'win' | 'loss' | 'tie',
): Promise<void> {
  // 1. Look up user_id from the account row.
  const { data: account, error: acctErr } = await supabaseAdmin
    .from('accounts')
    .select('user_id')
    .eq('id', accountId)
    .maybeSingle();

  if (acctErr || !account) {
    app.log.warn({ err: acctErr, accountId }, 'rounds: streak -- could not fetch account');
    return;
  }

  const userId: string = (account as any).user_id;

  if (outcome === 'win') {
    // Fetch current values so we can compute new best_streak.
    const { data: profile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('current_streak, best_streak')
      .eq('id', userId)
      .maybeSingle();

    if (profErr || !profile) {
      app.log.warn({ err: profErr, userId }, 'rounds: streak -- could not fetch profile');
      return;
    }

    const newStreak = ((profile as any).current_streak as number) + 1;
    const newBest   = Math.max(((profile as any).best_streak as number), newStreak);

    const { error: upErr } = await supabaseAdmin
      .from('profiles')
      .update({ current_streak: newStreak, best_streak: newBest })
      .eq('id', userId);

    if (upErr) {
      app.log.warn({ err: upErr, userId, newStreak, newBest }, 'rounds: streak -- update failed (win)');
    } else {
      app.log.info({ userId, newStreak, newBest }, 'rounds: streak updated (win)');
    }
  } else {
    // loss or tie -- reset streak only if it is not already 0 (avoids pointless writes).
    const { error: upErr } = await supabaseAdmin
      .from('profiles')
      .update({ current_streak: 0 })
      .eq('id', userId)
      .neq('current_streak', 0);

    if (upErr) {
      app.log.warn({ err: upErr, userId }, 'rounds: streak -- reset failed (loss/tie)');
    }
  }
}

async function tick(app: FastifyInstance): Promise<void> {
  const now = new Date().toISOString();

  const { data: rounds, error } = await supabaseAdmin
    .from('binary_rounds')
    .select('id, account_id, symbol, direction, stake, payout_multiplier, entry_price')
    .eq('outcome', 'pending')
    .lte('closes_at', now);

  if (error) {
    app.log.warn({ err: error }, 'rounds: select pending rounds failed');
    return;
  }
  if (!rounds || rounds.length === 0) return;

  for (const raw of rounds as any[]) {
    const round: PendingRound = {
      id: raw.id,
      account_id: raw.account_id,
      symbol: raw.symbol,
      direction: raw.direction as Direction,
      stake: Number(raw.stake),
      payout_multiplier: Number(raw.payout_multiplier),
      entry_price: Number(raw.entry_price),
    };

    const exit = getMid(round.symbol);
    if (exit == null) {
      // No live quote -- defer until next tick (shouldn't happen in practice
      // because pricefeed only allows symbols it already has quotes for, but
      // be safe rather than leaving rounds in limbo forever).
      app.log.warn(
        { roundId: round.id, symbol: round.symbol },
        'rounds: no quote for symbol, deferring',
      );
      continue;
    }

    // Determine outcome.
    let outcome: 'win' | 'loss' | 'tie';
    if (exit === round.entry_price) {
      outcome = 'tie';
    } else if (
      (round.direction === 'buy' && exit > round.entry_price) ||
      (round.direction === 'sell' && exit < round.entry_price)
    ) {
      outcome = 'win';
    } else {
      outcome = 'loss';
    }

    const payout = outcome === 'win'
      ? +( round.stake * round.payout_multiplier ).toFixed(2)
      : 0;

    // CAS guard: only settle if still pending (prevents double-credit if
    // another process -- future UI cancel, DB cleanup job -- touches the row).
    const { data: settled, error: settleErr } = await supabaseAdmin
      .from('binary_rounds')
      .update({
        outcome,
        exit_price: +exit.toFixed(5),
        payout,
      })
      .eq('id', round.id)
      .eq('outcome', 'pending')    // CAS: only if still pending
      .select('id')
      .maybeSingle();

    if (settleErr) {
      app.log.warn({ err: settleErr, roundId: round.id }, 'rounds: settle update failed');
      continue;
    }
    if (!settled) {
      // Already settled by something else -- skip.
      continue;
    }

    // Credit on settle:
    //  - win: the full payout (stake * multiplier)
    //  - tie: refund the stake (a tie is a push — the UI shows ±$0.00, so the
    //         deducted stake must come back or the user silently loses on a tie)
    //  - loss: nothing (stake stays deducted)
    const credit = outcome === 'win' ? payout : outcome === 'tie' ? round.stake : 0;
    if (credit > 0) {
      try {
        await supabaseAdmin.rpc('apply_trade_pnl', {
          p_account_id: round.account_id,
          p_amount: credit,
        });
      } catch (err) {
        app.log.error({ err, roundId: round.id, outcome }, 'rounds: apply_trade_pnl failed');
      }
    }

    // Update streak (Phase 2.6). Non-fatal -- errors are logged inside.
    await updateStreak(app, round.account_id, outcome);

    app.log.info(
      {
        roundId: round.id,
        accountId: round.account_id,
        symbol: round.symbol,
        direction: round.direction,
        entry: round.entry_price,
        exit: +exit.toFixed(5),
        outcome,
        payout,
      },
      'rounds: round settled',
    );
  }
}

export function startRoundsWorker(app: FastifyInstance): NodeJS.Timeout {
  let running = false;

  const handle = setInterval(async () => {
    if (running) return; // overlap guard
    running = true;
    try {
      await tick(app);
      recordTick('rounds');
    } catch (err) {
      app.log.error({ err }, 'rounds: tick threw');
    } finally {
      running = false;
    }
  }, 1000);

  app.log.info('Rounds worker started (1s tick).');
  return handle;
}
