import type { FastifyInstance } from 'fastify';

import { supabaseAdmin } from '../lib/supabase.js';
import { getQuote } from '../lib/quoteCache.js';
import { recordTick } from '../lib/workerHealth.js';

/**
 * Orders-trigger worker — T.1 (limit), T.2 (stop), T.3 (stop_limit).
 *
 * Every 1s:
 *   1. Pull all pending orders for limit, stop, and stop_limit order types.
 *   2. For each row, look up the live quote. No quote yet -> defer.
 *   3. Determine action via shouldFill():
 *      - 'fill'             -> flip status='open' at trigger_price (limit/stop)
 *                             or at limit_price (stop_limit stage-2 immediate)
 *      - 'convert_to_limit' -> stop part has fired but limit not yet hit;
 *                             rewrite the row as order_type='limit' at limit_price
 *                             so next tick the plain-limit path handles the fill
 *      - 'none'             -> price not there yet, skip
 *
 * Fill prices:
 *   limit     -> trigger_price  (B-book: fill exactly at user's limit)
 *   stop      -> trigger_price  (fill at breakout/breakdown trigger)
 *   stop_limit -> limit_price   (fill at user's limit after stop fires)
 *
 * Self-heal from R.6: each iteration wrapped in try/catch; errors logged but
 * the worker never crashes over a single bad row.
 */

type Side = 'buy' | 'sell';
type OrderType = 'limit' | 'stop' | 'stop_limit';
type FillAction = 'fill' | 'convert_to_limit' | 'none';

interface PendingOrder {
  id: number;
  account_id: string;
  symbol: string;
  side: Side;
  volume: number;
  order_type: OrderType;
  trigger_price: number;
  limit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
}

function shouldFill(o: PendingOrder, bid: number, ask: number): FillAction {
  if (o.order_type === 'limit') {
    // Patient entry: fill when price comes to you.
    // buy-limit  fills when ask drops to/below trigger (buy the dip)
    // sell-limit fills when bid rises to/above trigger (sell the rip)
    if (o.side === 'buy') return ask <= o.trigger_price ? 'fill' : 'none';
    return bid >= o.trigger_price ? 'fill' : 'none';
  }

  if (o.order_type === 'stop') {
    // Breakout/breakdown entry: fill when price moves through trigger.
    // buy-stop  fills when ask rises to/above trigger (upside breakout)
    // sell-stop fills when bid drops to/below trigger (downside breakdown)
    if (o.side === 'buy') return ask >= o.trigger_price ? 'fill' : 'none';
    return bid <= o.trigger_price ? 'fill' : 'none';
  }

  if (o.order_type === 'stop_limit') {
    // Two-stage: stop fires first, then limit must be hit.
    // Stage 1 (stop): same direction logic as plain stop.
    const stopFired =
      o.side === 'buy' ? ask >= o.trigger_price : bid <= o.trigger_price;

    if (!stopFired) return 'none';

    // Stop has fired. If limit_price is missing (malformed row), skip safely.
    if (o.limit_price == null) return 'none';

    // Stage 2 (limit fill): after stop fires, now act as a limit order.
    // buy  stop_limit: fill when ask <= limit_price (accept up to limit)
    // sell stop_limit: fill when bid >= limit_price (accept down to limit)
    const limitHit =
      o.side === 'buy' ? ask <= o.limit_price : bid >= o.limit_price;

    if (limitHit) return 'fill';

    // Stop fired but limit not yet met — convert row to a plain limit order
    // (trigger_price <- limit_price, order_type <- 'limit') so the standard
    // limit path handles the fill on the next tick(s).
    return 'convert_to_limit';
  }

  return 'none';
}

/** Fill price to record when action === 'fill'. */
function fillPrice(o: PendingOrder): number {
  if (o.order_type === 'stop_limit' && o.limit_price != null) {
    // Fill at the limit price (that is what the user agreed to pay/receive).
    return o.limit_price;
  }
  // Limit and stop orders fill at their trigger price.
  return o.trigger_price;
}

async function tick(app: FastifyInstance): Promise<void> {
  const { data: rows, error } = await supabaseAdmin
    .from('trades')
    .select(
      'id, account_id, symbol, side, volume, order_type, trigger_price, limit_price, stop_loss, take_profit',
    )
    .eq('status', 'pending')
    .in('order_type', ['limit', 'stop', 'stop_limit']);

  if (error) {
    app.log.warn({ err: error }, 'ordersTrigger: select pending failed');
    return;
  }
  if (!rows || rows.length === 0) return;

  for (const raw of rows as any[]) {
    try {
      if (raw.trigger_price == null) {
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
        limit_price: raw.limit_price == null ? null : Number(raw.limit_price),
        stop_loss: raw.stop_loss == null ? null : Number(raw.stop_loss),
        take_profit: raw.take_profit == null ? null : Number(raw.take_profit),
      };

      const q = getQuote(order.symbol);
      if (!q) continue; // no quote yet — defer

      const action = shouldFill(order, q.bid, q.ask);
      if (action === 'none') continue;

      if (action === 'convert_to_limit') {
        // Stop has fired but limit not hit. Convert the row into a plain limit
        // order (trigger_price = limit_price, order_type = 'limit') so the
        // standard limit path fills it on a subsequent tick.
        const { error: convErr } = await supabaseAdmin
          .from('trades')
          .update({
            order_type: 'limit',
            trigger_price: order.limit_price,
          })
          .eq('id', order.id)
          .eq('status', 'pending'); // CAS: only if not yet filled/cancelled

        if (convErr) {
          app.log.warn(
            { err: convErr, tradeId: order.id },
            'ordersTrigger: stop_limit convert_to_limit failed',
          );
        } else {
          app.log.info(
            { tradeId: order.id, limitPrice: order.limit_price },
            'ordersTrigger: stop_limit stop fired, converted to limit order',
          );
        }
        continue;
      }

      // action === 'fill' — flip to open.
      const price = fillPrice(order);

      // CAS guard: only flip status if still pending.
      const { data: updated, error: updErr } = await supabaseAdmin
        .from('trades')
        .update({
          status: 'open',
          open_price: price,
          current_price: price,
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
        // Already cancelled or filled — skip.
        continue;
      }

      app.log.info(
        {
          tradeId: order.id,
          accountId: order.account_id,
          symbol: order.symbol,
          side: order.side,
          fillPrice: price,
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
