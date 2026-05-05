/**
 * Margin reservation / release helpers — Phase 1.2
 *
 * Margin model (B-book MT4-style):
 *   required = volume × open_price × contractSize(symbol) / account.leverage
 *
 * On open we move `required` from `accounts.free_margin` into
 * `accounts.margin_used`. On close we move it back. P&L is applied
 * separately by the existing `apply_trade_pnl` RPC (it adjusts balance,
 * equity, and free_margin together) — margin reservation is independent.
 *
 * Atomicity caveat: supabase-js can't do arithmetic in updates without an
 * RPC, so we read-then-write. To keep the obvious race (two simultaneous
 * opens drawing the same free_margin) tight, `reserveMargin` does a CAS
 * on the prior `margin_used` value — if a concurrent change moved it,
 * the update is rejected and we surface 'race' to the caller. The release
 * path is intentionally lenient (clamps to current `margin_used`, no CAS):
 * a race there can only leave a few cents temporarily stuck, which is
 * recoverable by the next close.
 *
 * If/when this becomes a real problem, replace both helpers with a
 * `reserve_margin` / `release_margin` Postgres RPC pair (mirroring the
 * existing `apply_trade_pnl`) — see STATE.md for note.
 */

import type { FastifyBaseLogger } from 'fastify';

import { supabaseAdmin } from './supabase.js';
import { contractSize } from './contracts.js';

export interface AccountForMargin {
  id: string;
  free_margin: number;
  margin_used: number;
}

/**
 * Margin a position would require, in account currency.
 * Leverage of 100 means 1% margin requirement.
 */
export function requiredMargin(
  volume: number,
  price: number,
  symbol: string,
  leverage: number,
): number {
  const lev = leverage && leverage > 0 ? leverage : 1;
  return (volume * price * contractSize(symbol)) / lev;
}

export type ReserveResult =
  | { ok: true; newFreeMargin: number; newMarginUsed: number }
  | { ok: false; reason: 'insufficient' | 'race' | 'db_error' };

/**
 * Reserve `amount` of margin on an account.
 * Caller passes the freshly-read account state. CAS on `margin_used` catches
 * concurrent updates so we don't double-spend.
 */
export async function reserveMargin(
  account: AccountForMargin,
  amount: number,
  log?: FastifyBaseLogger,
): Promise<ReserveResult> {
  if (amount <= 0) {
    return {
      ok: true,
      newFreeMargin: account.free_margin,
      newMarginUsed: account.margin_used,
    };
  }
  if (account.free_margin < amount) {
    return { ok: false, reason: 'insufficient' };
  }

  const newFreeMargin = +(account.free_margin - amount).toFixed(2);
  const newMarginUsed = +(account.margin_used + amount).toFixed(2);

  const { data, error } = await supabaseAdmin
    .from('accounts')
    .update({ free_margin: newFreeMargin, margin_used: newMarginUsed })
    .eq('id', account.id)
    .eq('margin_used', account.margin_used)
    .gte('free_margin', amount)
    .select('id')
    .maybeSingle();

  if (error) {
    log?.warn({ err: error, accountId: account.id, amount }, 'margin: reserve failed');
    return { ok: false, reason: 'db_error' };
  }
  if (!data) {
    return { ok: false, reason: 'race' };
  }
  return { ok: true, newFreeMargin, newMarginUsed };
}

/**
 * Release `amount` of reserved margin (from `margin_used` back into
 * `free_margin`). Read-then-write; clamps to current `margin_used` so we
 * never go negative even under benign race.
 */
export async function releaseMargin(
  accountId: string,
  amount: number,
  log?: FastifyBaseLogger,
): Promise<void> {
  if (amount <= 0) return;

  const { data: acc, error: readErr } = await supabaseAdmin
    .from('accounts')
    .select('id, free_margin, margin_used')
    .eq('id', accountId)
    .single();

  if (readErr || !acc) {
    log?.warn({ err: readErr, accountId, amount }, 'margin: release failed (read)');
    return;
  }

  const release = Math.min(amount, Number(acc.margin_used) || 0);
  if (release <= 0) return;

  const newMarginUsed = +((Number(acc.margin_used) || 0) - release).toFixed(2);
  const newFreeMargin = +((Number(acc.free_margin) || 0) + release).toFixed(2);

  const { error: updErr } = await supabaseAdmin
    .from('accounts')
    .update({ margin_used: newMarginUsed, free_margin: newFreeMargin })
    .eq('id', accountId);

  if (updErr) {
    log?.warn({ err: updErr, accountId, amount }, 'margin: release failed (update)');
  }
}
