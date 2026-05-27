import type { FastifyInstance } from 'fastify';

import { supabaseAdmin } from '../lib/supabase.js';
import { getMid, getQuote } from '../lib/quoteCache.js';
import { calculatePnL } from '../lib/contracts.js';
import { requiredMargin, releaseMargin } from '../lib/margin.js';
import { sendPushChecked } from '../lib/push.js';
import { recordTick } from '../lib/workerHealth.js';

/**
 * Risk worker -- Phase 1.1
 *
 * Every 1s:
 *   1. Pull all open trades.
 *   2. T.4 -- For trades with trail_distance set: ratchet trail_high_water
 *      and update stop_loss so it trails the best price.
 *   3. For each, compare live mid against stop_loss / take_profit.
 *      - buy SL hit:  mid <= stop_loss   -> close at stop_loss
 *      - sell SL hit: mid >= stop_loss   -> close at stop_loss
 *      - buy TP hit:  mid >= take_profit -> close at take_profit
 *      - sell TP hit: mid <= take_profit -> close at take_profit
 *      Any auto-close marks reason='stopout'.
 *   4. After SL/TP sweep, for each account with remaining open exposure,
 *      compute total unrealized P&L. If account.equity + unrealized < 0,
 *      force-close that account's worst loser at current bid/ask.
 *
 * Closes call the same `apply_trade_pnl` RPC the manual close path uses, so
 * balance / equity / free_margin all stay consistent.
 */

type Side = 'buy' | 'sell';

interface OpenTrade {
  id: number;
  account_id: string;
  user_id: string;
  symbol: string;
  side: Side;
  volume: number;
  open_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  leverage: number;
  trail_distance: number | null;
  trail_high_water: number | null;
}

async function closeAtPrice(
  app: FastifyInstance,
  trade: OpenTrade,
  closePrice: number,
  tag: 'sl' | 'tp' | 'stopout',
): Promise<number | null> {
  const profit = +calculatePnL(
    trade.side,
    trade.volume,
    trade.open_price,
    closePrice,
    trade.symbol,
  ).toFixed(2);

  // CAS guard: only update if still open. Prevents double-close races with
  // a manual /api/orders/close happening at the same time.
  const { data: updated, error: closeErr } = await supabaseAdmin
    .from('trades')
    .update({
      status: 'closed',
      close_price: closePrice,
      close_time: new Date().toISOString(),
      current_price: closePrice,
      profit,
      reason: 'stopout',
    })
    .eq('id', trade.id)
    .eq('status', 'open')
    .select('id')
    .maybeSingle();

  if (closeErr) {
    app.log.warn({ err: closeErr, tradeId: trade.id, tag }, 'risk: trade update failed');
    return null;
  }
  if (!updated) {
    // Already closed by something else this tick -- skip P&L apply.
    return null;
  }

  try {
    await supabaseAdmin.rpc('apply_trade_pnl', {
      p_account_id: trade.account_id,
      p_amount: profit,
    });
  } catch (err) {
    app.log.error({ err, tradeId: trade.id }, 'risk: apply_trade_pnl failed');
  }

  // Phase 1.2 -- release reserved margin so margin_used doesn't grow forever.
  try {
    const release = +requiredMargin(
      trade.volume,
      trade.open_price,
      trade.symbol,
      trade.leverage,
    ).toFixed(2);
    await releaseMargin(trade.account_id, release, app.log);
  } catch (err) {
    app.log.warn({ err, tradeId: trade.id }, 'risk: release margin failed');
  }

  return profit;
}

/**
 * T.4 -- Update the trailing stop for a single trade.
 *
 * Ratchets trail_high_water to the new best price, then updates stop_loss so
 * it always trails `trail_distance` behind the high-water mark.
 * For a buy: SL = high_water - trail_distance  (ratchets UP only)
 * For a sell: SL = high_water + trail_distance (ratchets DOWN only)
 *
 * Returns the mutated trade object (with updated stop_loss / trail_high_water)
 * so the caller's SL-check sees the new values without re-fetching from the DB.
 */
async function updateTrailingStop(
  app: FastifyInstance,
  trade: OpenTrade,
  mid: number,
): Promise<OpenTrade> {
  const dist = trade.trail_distance as number; // caller ensures != null

  // Ratchet the high-water mark.
  const prevHW = trade.trail_high_water ?? trade.open_price;
  let newHW: number;
  let newSL: number;

  if (trade.side === 'buy') {
    newHW = Math.max(prevHW, mid);
    newSL = +(newHW - dist).toFixed(5);
    // Only ratchet up -- never lower an existing SL.
    if (trade.stop_loss != null && newSL <= trade.stop_loss) {
      // No improvement; still update high_water if it moved.
      if (newHW === prevHW) return trade;
      newSL = trade.stop_loss;
    }
  } else {
    newHW = Math.min(prevHW, mid);
    newSL = +(newHW + dist).toFixed(5);
    // Only ratchet down -- never raise an existing SL for a sell.
    if (trade.stop_loss != null && newSL >= trade.stop_loss) {
      if (newHW === prevHW) return trade;
      newSL = trade.stop_loss;
    }
  }

  const { error } = await supabaseAdmin
    .from('trades')
    .update({
      trail_high_water: newHW,
      stop_loss: newSL,
    })
    .eq('id', trade.id)
    .eq('status', 'open'); // don't update if race-closed

  if (error) {
    app.log.warn({ err: error, tradeId: trade.id }, 'risk: trailing stop update failed');
    return trade;
  }

  app.log.debug(
    { tradeId: trade.id, side: trade.side, mid, prevHW, newHW, newSL },
    'risk: trailing stop ratcheted',
  );

  return { ...trade, trail_high_water: newHW, stop_loss: newSL };
}

async function tick(app: FastifyInstance): Promise<void> {
  const { data: trades, error } = await supabaseAdmin
    .from('trades')
    .select(
      'id, account_id, symbol, side, volume, open_price, stop_loss, take_profit, trail_distance, trail_high_water, accounts!inner(leverage, user_id)',
    )
    .eq('status', 'open');

  if (error) {
    app.log.warn({ err: error }, 'risk: select open trades failed');
    return;
  }
  if (!trades || trades.length === 0) return;

  const remaining: OpenTrade[] = [];

  // Pass 1 -- trailing-stop ratchet + SL / TP triggers.
  for (const raw of trades as any[]) {
    let t: OpenTrade = {
      id: raw.id,
      account_id: raw.account_id,
      user_id: raw.accounts?.user_id ?? '',
      symbol: raw.symbol,
      side: raw.side,
      volume: Number(raw.volume),
      open_price: Number(raw.open_price),
      stop_loss: raw.stop_loss == null ? null : Number(raw.stop_loss),
      take_profit: raw.take_profit == null ? null : Number(raw.take_profit),
      leverage: Number(raw.accounts?.leverage) || 1,
      trail_distance: raw.trail_distance == null ? null : Number(raw.trail_distance),
      trail_high_water: raw.trail_high_water == null ? null : Number(raw.trail_high_water),
    };

    const mid = getMid(t.symbol);
    if (mid == null) {
      continue;
    }

    // T.4 -- ratchet trailing stop before SL check so we use the latest SL.
    if (t.trail_distance != null && t.trail_distance > 0) {
      try {
        t = await updateTrailingStop(app, t, mid);
      } catch (err) {
        app.log.warn({ err, tradeId: t.id }, 'risk: trailing stop update threw');
      }
    }

    const slHit =
      t.stop_loss != null &&
      ((t.side === 'buy' && mid <= t.stop_loss) ||
        (t.side === 'sell' && mid >= t.stop_loss));

    if (slHit) {
      const closed = await closeAtPrice(app, t, t.stop_loss as number, 'sl');
      if (closed != null) {
        app.log.info(
          { tradeId: t.id, accountId: t.account_id, symbol: t.symbol, profit: closed, trigger: 'sl', trailing: t.trail_distance != null },
          'risk: SL hit',
        );
        if (t.user_id) {
          const sign = closed >= 0 ? '+' : '';
          sendPushChecked(t.user_id, 'trade_results', {
            title: `${t.symbol} ${t.trail_distance != null ? 'trailing ' : ''}stop-loss hit`,
            body: `${sign}$${Math.abs(closed).toFixed(2)}`,
            data: { tradeId: t.id, symbol: t.symbol, profit: closed, kind: 'trade_closed', trigger: 'sl' },
          }).catch(() => {});
        }
      }
      continue;
    }

    const tpHit =
      t.take_profit != null &&
      ((t.side === 'buy' && mid >= t.take_profit) ||
        (t.side === 'sell' && mid <= t.take_profit));

    if (tpHit) {
      const closed = await closeAtPrice(app, t, t.take_profit as number, 'tp');
      if (closed != null) {
        app.log.info(
          { tradeId: t.id, accountId: t.account_id, symbol: t.symbol, profit: closed, trigger: 'tp' },
          'risk: TP hit',
        );
        if (t.user_id) {
          const sign = closed >= 0 ? '+' : '';
          sendPushChecked(t.user_id, 'trade_results', {
            title: `${t.symbol} take-profit hit`,
            body: `${sign}$${Math.abs(closed).toFixed(2)}`,
            data: { tradeId: t.id, symbol: t.symbol, profit: closed, kind: 'trade_closed', trigger: 'tp' },
          }).catch(() => {});
        }
      }
      continue;
    }

    remaining.push(t);
  }

  // Pass 2 -- aggregate stop-out check.
  if (remaining.length === 0) return;

  const byAccount = new Map<string, Array<OpenTrade & { unrealized: number }>>();
  for (const t of remaining) {
    const mid = getMid(t.symbol);
    if (mid == null) continue;
    const unrealized = +calculatePnL(t.side, t.volume, t.open_price, mid, t.symbol).toFixed(2);
    const list = byAccount.get(t.account_id) ?? [];
    list.push({ ...t, unrealized });
    byAccount.set(t.account_id, list);
  }
  if (byAccount.size === 0) return;

  const { data: accounts, error: accErr } = await supabaseAdmin
    .from('accounts')
    .select('id, equity')
    .in('id', Array.from(byAccount.keys()));

  if (accErr) {
    app.log.warn({ err: accErr }, 'risk: fetch accounts for stop-out failed');
    return;
  }

  for (const acc of accounts ?? []) {
    const list = byAccount.get(acc.id);
    if (!list || list.length === 0) continue;

    const totalUnrealized = list.reduce((s, t) => s + t.unrealized, 0);
    const equity = Number(acc.equity);

    if (equity + totalUnrealized >= 0) continue;

    // Pick the worst (most negative unrealized) trade and close it at market.
    const worst = list.reduce((w, t) => (t.unrealized < w.unrealized ? t : w), list[0]);
    const q = getQuote(worst.symbol);
    if (!q) continue;
    const closePrice = worst.side === 'buy' ? q.bid : q.ask;

    const closed = await closeAtPrice(app, worst, closePrice, 'stopout');
    if (closed != null) {
      app.log.warn(
        {
          accountId: acc.id,
          tradeId: worst.id,
          symbol: worst.symbol,
          profit: closed,
          equity,
          totalUnrealized,
          trigger: 'stopout',
        },
        'risk: stop-out closed worst loser',
      );
      if (worst.user_id) {
        const sign = closed >= 0 ? '+' : '';
        sendPushChecked(worst.user_id, 'trade_results', {
          title: `${worst.symbol} stopped out`,
          body: `${sign}$${Math.abs(closed).toFixed(2)}`,
          data: { tradeId: worst.id, symbol: worst.symbol, profit: closed, kind: 'trade_closed', trigger: 'stopout' },
        }).catch(() => {});
      }
    }
  }
}

// Exported for hermetic tests — drive a single tick without the setInterval.
export const _riskInternals = { tick };

export function startRiskWorker(app: FastifyInstance): NodeJS.Timeout {
  let running = false;

  const handle = setInterval(async () => {
    if (running) return; // overlap guard
    running = true;
    try {
      await tick(app);
      recordTick('risk');
    } catch (err) {
      app.log.error({ err }, 'risk: tick threw');
    } finally {
      running = false;
    }
  }, 1000);

  app.log.info('Risk worker started (1s tick).');
  return handle;
}
