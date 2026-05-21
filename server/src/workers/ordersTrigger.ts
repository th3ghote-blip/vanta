import type { FastifyInstance } from 'fastify';

import { supabaseAdmin } from '../lib/supabase.js';
import { getQuote } from '../lib/quoteCache.js';
import { recordTick } from '../lib/workerHealth.js';

/**
 * Orders-trigger worker — T.1 (limit orders) + T.2 (stop orders).
 *
 * Every 1s:
 *   1. Pull all pending orders (status='pending'). For now we only convert
 *      `order_type='limit'`; stop / stop_limit will be added by T.2 / T.3
 *      and can extend the trigger logic in `shouldFill()` below.
 *   2. For each pending row, look up the live quote in the in-memory cache.
 *      No quote yet → defer to next tick.
 *   3. Trigger conditions for `limit`:
 *      - buy-limit  fills when current ask <= trigger_price (buy the dip)
 *      - sell-limit fills when current bid >= trigger_price (sell the rip)
 *   4. On fill: CAS update (only if still pending) to status='open',
 *      open_price=trigger_price (B-book counterparty rule — we fill exactly
 *      at the user's limit price), open_time=now(). Margin was reserved at
 *      submit time, so no double reservation here.
 *
 * Self-heal pattern from R.6: every iteration wrapped in try/catch, errors
 * logged but never crash the worker. Single in-flight tick at a time.
 */

type Side = 'buy' | 'sell';

interface PendingOrder {
  id: number;
  account_id: string;
  symbol: string;
  side: Side;
  volume: number;
  order_type: 'limit' | 'stop' | 'stop_limit';
  trigger_price: number;
  stop_loss: number | null;
  take_profit: number | null;
}

function shouldFill(o: PendingOrder, bid: number, ask: number): boolean {
  if (o.order_type === 'limit') {
    // Limit: patient entry — fill when price comes to you.
    // buy-limit  fills when ask drops to/below trigger (buy the dip)
    // sell-limit fills when bid rises to/above trigger (sell the rip)
    if (o.side === 'buy') return ask <= o.trigger_price;
    return bid >= o.trigger_price;
  }
  if (o.order_type === 'stop') {
    // Stop: breakout/breakdown entry — fill when price moves through you.
    // buy-stop  fills when ask rises to/above trigger (upside breakout)
    // sell-stop fills when bid drops to/below trigger (downside breakdown)
    if (o.side === 'buy') return ask >= o.trigger_price;
    return bid <= o.trigger_price;
  }
  // T.3 stop_limit will extend this.
  return false;
}

async function tick(app: FastifyInstance): Promise<void> {
  const { data: rows, error } = await supabaseAdmin
    .from('trades')
    .select(
      'id, account_id, symbol, side, volume, order_type, trigger_price, stop_loss, take_profit',
    )
    .eq('status', 'pending')
    .in('order_type', ['limit', 'stop']);

  if (error) {
    app.log.warn({ err: error }, 'ordersTrigger: select pending failed');
    return;
  }
  if (!rows || rows.length === 0) return;

  for (const raw of rows as any[]) {
    try {
      if (raw.trigger_price == null) {
        // Malformed row (should have been blocked at insert). Skip — never
        // crash the worker over one bad row.
        app.log.warn(
          { tradeId: raw.id },
          'ordersTrigger: pending row missing trigger_price; skipping',
        );
        continue;
      }
      const order: PendingOrder = {
        id: raw.id,
        account_id: raw.account_id,
        symbol: raw.symbol,
        side: raw.side,
        volume: Number(raw.volume),
        order_type: raw.order_type,
        trigger_price: Number(raw.trigger_price),
        stop_loss: raw.stop_loss == null ? null : Number(raw.stop_loss),
        take_profit: raw.take_profit == null ? null : Number(raw.take_profit),
      };

      const q = getQuote(order.symbol);
      if (!q) continue; // no quote yet — defer

      if (!shouldFill(order, q.bid, q.ask)) continue;

      // CAS guard: only flip status if still pending. Prevents a race with a
      // simultaneous DELETE /api/orders/pending/:id cancel.
      const { data: updated, error: updErr } = await supabaseAdmin
        .from('trades')
        .update({
          status: 'open',
          open_price: order.trigger_price,
          current_price: order.trigger_price,
          open_time: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (updErr) {
        app.log.warn(
          { err: updErr, tradeId: order.id },
          'ordersTrigger: fill update failed',
        );
        continue;
      }
      if (!updated) {
        // Already canceled or filled by something else this tick — skip.
        continue;
      }

      app.log.info(
        {
          tradeId: order.id,
          accountId: order.account_id,
          symbol: order.symbol,
          side: order.side,
          fillPrice: order.trigger_price,
          orderType: order.order_type,
        },
        'ordersTrigger: pending order filled',
      );
    } catch (err) {
      app.log.error(
        { err, tradeId: raw.id },
        'ordersTrigger: iteration threw; continuing',
      );
    }
  }
}

export function startOrdersTriggerWorker(app: FastifyInstance): NodeJS.Timeout {
  let running = false;

  const handle = setInterval(async () => {
    if (running) return; // overlap guard
    running = true;
    try {
      await tick(app);
      recordTick('ordersTrigger');
    } catch (err) {
      app.log.error({ err }, 'ordersTrigger: tick threw');
    } finally {
      running = false;
    }
  }, 1000);

  app.log.info('Orders-trigger worker started (1s tick).');
  return handle;
}
