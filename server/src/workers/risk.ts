import type { FastifyInstance } from 'fastify';

import { supabaseAdmin } from '../lib/supabase.js';
import { getMid, getQuote } from '../lib/quoteCache.js';
import { calculatePnL } from '../lib/contracts.js';

/**
 * Risk worker — Phase 1.1
 *
 * Every 1s:
 *   1. Pull all open trades.
 *   2. For each, compare live mid against stop_loss / take_profit.
 *      - buy SL hit:  mid <= stop_loss   → close at stop_loss
 *      - sell SL hit: mid >= stop_loss   → close at stop_loss
 *      - buy TP hit:  mid >= take_profit → close at take_profit
 *      - sell TP hit: mid <= take_profit → close at take_profit
 *      Any auto-close marks reason='stopout'.
 *   3. After SL/TP sweep, for each account with remaining open exposure,
 *      compute total unrealized P&L. If account.equity + unrealized < 0,
 *      force-close that account's worst loser at current bid/ask.
 *
 * Closes call the same `apply_trade_pnl` RPC the manual close path uses, so
 * balance / equity / free_margin all stay consistent.
 *
 * Concurrency: a single in-flight tick at a time. If a tick runs long, the
 * next setInterval fire is skipped (no overlapping reads/writes).
 */

type Side = 'buy' | 'sell';

interface OpenTrade {
  id: number;
  account_id: string;
  symbol: string;
  side: Side;
  volume: number;
  open_price: number;
  stop_loss: number | null;
  take_profit: number | null;
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
    // Already closed by something else this tick — skip P&L apply.
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

  return profit;
}

async function tick(app: FastifyInstance): Promise<void> {
  const { data: trades, error } = await supabaseAdmin
    .from('trades')
    .select('id, account_id, symbol, side, volume, open_price, stop_loss, take_profit')
    .eq('status', 'open');

  if (error) {
    app.log.warn({ err: error }, 'risk: select open trades failed');
    return;
  }
  if (!trades || trades.length === 0) return;

  const remaining: OpenTrade[] = [];

  // Pass 1 — SL / TP triggers.
  for (const raw of trades as OpenTrade[]) {
    const t: OpenTrade = {
      ...raw,
      volume: Number(raw.volume),
      open_price: Number(raw.open_price),
      stop_loss: raw.stop_loss == null ? null : Number(raw.stop_loss),
      take_profit: raw.take_profit == null ? null : Number(raw.take_profit),
    };

    const mid = getMid(t.symbol);
    if (mid == null) {
      // No quote yet — defer. Don't include in stop-out math (no mid means we
      // can't compute unrealized P&L for it anyway).
      continue;
    }

    const slHit =
      t.stop_loss != null &&
      ((t.side === 'buy' && mid <= t.stop_loss) ||
        (t.side === 'sell' && mid >= t.stop_loss));

    if (slHit) {
      const closed = await closeAtPrice(app, t, t.stop_loss as number, 'sl');
      if (closed != null) {
        app.log.info(
          { tradeId: t.id, accountId: t.account_id, symbol: t.symbol, profit: closed, trigger: 'sl' },
          'risk: SL hit',
        );
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
      }
      continue;
    }

    remaining.push(t);
  }

  // Pass 2 — aggregate stop-out check.
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
    }
  }
}

export function startRiskWorker(app: FastifyInstance): NodeJS.Timeout {
  let running = false;

  const handle = setInterval(async () => {
    if (running) return; // overlap guard
    running = true;
    try {
      await tick(app);
    } catch (err) {
      app.log.error({ err }, 'risk: tick threw');
    } finally {
      running = false;
    }
  }, 1000);

  app.log.info('Risk worker started (1s tick).');
  return handle;
}
