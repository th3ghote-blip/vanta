/**
 * Price-alert worker — Phase 6.4
 *
 * Every 5 seconds:
 *   1. Load all un-triggered alerts from Supabase (price_alerts where triggered_at IS NULL).
 *   2. For each alert, check the in-process quote cache:
 *      - direction='above'  fires when mid >= threshold
 *      - direction='below'  fires when mid <= threshold
 *   3. For triggered alerts: mark triggered_at = now(), send push notification.
 *
 * We do a single bulk-select each tick (cheap), then process in-memory.
 * Network I/O only happens for triggered alerts (rare).
 *
 * Errors per-alert are caught individually so one bad row can't block others.
 */

import type { FastifyInstance } from 'fastify';
import { supabaseAdmin } from '../lib/supabase.js';
import { getMid } from '../lib/quoteCache.js';
import { sendPush } from '../lib/push.js';

const TICK_MS = 5_000;

interface PriceAlert {
  id: string;
  user_id: string;
  symbol: string;
  threshold: number;
  direction: 'above' | 'below';
}

/** Format a price for the push notification body. */
function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 1)    return n.toFixed(4);
  return n.toFixed(6);
}

async function tick(app: FastifyInstance): Promise<void> {
  // Fetch all active (un-triggered) alerts.
  const { data: alerts, error } = await supabaseAdmin
    .from('price_alerts')
    .select('id, user_id, symbol, threshold, direction')
    .is('triggered_at', null);

  if (error) {
    app.log.warn({ err: error }, 'priceAlerts: fetch failed');
    return;
  }
  if (!alerts || alerts.length === 0) return;

  const now = new Date().toISOString();
  const toFire: PriceAlert[] = [];

  for (const row of alerts as PriceAlert[]) {
    const mid = getMid(row.symbol);
    if (mid === null) continue; // symbol not yet in cache, skip

    const triggered =
      (row.direction === 'above' && mid >= row.threshold) ||
      (row.direction === 'below' && mid <= row.threshold);

    if (triggered) toFire.push(row);
  }

  if (toFire.length === 0) return;

  // Fire each triggered alert concurrently but isolated.
  await Promise.all(
    toFire.map(async (alert) => {
      try {
        // Mark triggered first (idempotent — re-triggers are harmless but noisy).
        const { error: updateErr } = await supabaseAdmin
          .from('price_alerts')
          .update({ triggered_at: now })
          .eq('id', alert.id)
          .is('triggered_at', null); // CAS guard

        if (updateErr) {
          app.log.warn({ err: updateErr, alertId: alert.id }, 'priceAlerts: mark triggered failed');
          return;
        }

        // Send push notification.
        const dirLabel = alert.direction === 'above' ? 'above' : 'below';
        const midNow   = getMid(alert.symbol) ?? alert.threshold;

        await sendPush(alert.user_id, {
          title: `🔔 ${alert.symbol} price alert`,
          body:  `${alert.symbol} is ${dirLabel} ${fmtPrice(alert.threshold)} — now ${fmtPrice(midNow)}`,
          data:  { type: 'price_alert', symbol: alert.symbol, alertId: alert.id },
        });

        app.log.info(
          { alertId: alert.id, symbol: alert.symbol, direction: alert.direction, threshold: alert.threshold },
          'priceAlerts: fired',
        );
      } catch (err) {
        app.log.warn({ err, alertId: alert.id }, 'priceAlerts: error firing alert');
      }
    }),
  );
}

export function startPriceAlertsWorker(app: FastifyInstance): void {
  let running = false;

  setInterval(async () => {
    if (running) return; // skip tick if previous one is still in-flight
    running = true;
    try {
      await tick(app);
    } catch (err) {
      app.log.warn({ err }, 'priceAlerts: tick error');
    } finally {
      running = false;
    }
  }, TICK_MS);

  app.log.info('priceAlerts worker started (5s interval)');
}
