import type { FastifyInstance } from 'fastify';
import { supabaseAdmin } from '../lib/supabase.js';
import { getQuote } from '../lib/quoteCache.js';
import { requiredMargin, reserveMargin } from '../lib/margin.js';

/**
 * Robot execution engine — Phase 3.3 (full implementation)
 *
 * Every 60 s:
 *   1. Fetch all `status='active'` robots joined with their account.
 *   2. For each robot, check whether its schedule says "fire now":
 *      - interval : fire when (now − last_run_at) >= interval_ms
 *      - cron     : fire when current UTC minute matches the cron expression
 *      - event    : fire once per day when UTC clock hits a named market event
 *   3. Evaluate conditions array (`always` implemented; others pass-through for now).
 *   4. Act:
 *      - kind='trade' : open a trade via internal OMS (replicates /api/orders/open logic)
 *      - kind='tip'   : log the tip (Phase 3.4 will add push notification)
 *   5. Insert a `robot_runs` row. Update `robots.last_run_at` + `total_trades`.
 *
 * Concurrency guard: a boolean flag prevents overlapping ticks.
 */

// ---------------------------------------------------------------------------
// Market event schedule (UTC). For NY events we use summer (EDT) offsets;
// close enough for a demo platform — production should use a proper DST lib.
// ---------------------------------------------------------------------------
const MARKET_EVENTS: Record<string, { utcHour: number; utcMinute: number }> = {
  nyse_open:   { utcHour: 14, utcMinute: 30 }, // 9:30 AM ET (summer / EDT)
  nyse_close:  { utcHour: 21, utcMinute: 0  }, // 4:00 PM ET (summer / EDT)
  london_open: { utcHour: 8,  utcMinute: 0  }, // 8:00 AM GMT
  asia_open:   { utcHour: 0,  utcMinute: 0  }, // midnight UTC
  daily_9am:   { utcHour: 9,  utcMinute: 0  }, // 9:00 AM UTC
};

// In-memory state — resets on server restart, which is fine.
const lastFiredMs  = new Map<string, number>();       // robotId → epoch ms
const firedToday   = new Map<string, string>();       // `${robotId}:${event}` → YYYY-MM-DD

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export function startRobotEngine(app: FastifyInstance) {
  let running = false;

  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await tick(app);
    } catch (err) {
      app.log.error({ err }, 'robot_engine: tick failed');
    } finally {
      running = false;
    }
  }, 60_000); // one tick per minute

  app.log.info('Robot engine started (full implementation).');
}

// ---------------------------------------------------------------------------
// Main tick
// ---------------------------------------------------------------------------
async function tick(app: FastifyInstance) {
  const now = new Date();

  const { data: robots, error } = await supabaseAdmin
    .from('robots')
    .select('*, accounts!inner(id, balance, free_margin, margin_used, leverage)')
    .eq('status', 'active');

  if (error) {
    app.log.warn({ error }, 'robot_engine: failed to fetch robots');
    return;
  }

  for (const robot of robots ?? []) {
    try {
      await processRobot(app, robot, now);
    } catch (err) {
      app.log.warn({ err, robotId: robot.id }, 'robot_engine: processRobot threw');
    }
  }
}

// ---------------------------------------------------------------------------
// Per-robot processing
// ---------------------------------------------------------------------------
async function processRobot(app: FastifyInstance, robot: any, now: Date) {
  const schedule = robot.config?.schedule;
  if (!schedule) return;

  if (!shouldFire(robot.id, schedule, robot.last_run_at, now)) return;

  // Evaluate conditions (only 'always' is fully implemented; unknown types pass)
  const conditions: any[] = robot.config?.conditions ?? [{ type: 'always' }];
  const condsMet = conditions.every((c: any) => {
    if (!c?.type || c.type === 'always') return true;
    // rsi / ma_cross / price_drop — TODO per-condition in future phases
    return true;
  });

  // Record last-fired even if conditions not met, so we don't spin on cron/event.
  lastFiredMs.set(robot.id, now.getTime());

  if (!condsMet) {
    await logRun(robot.id, 'conditions_not_met', null, 'Conditions not satisfied', now);
    return;
  }

  const kind: string = robot.config?.kind ?? 'trade';

  if (kind === 'trade') {
    const result = await openRobotTrade(app, robot);
    if (result.ok) {
      await logRun(robot.id, 'trade_opened', result.tradeId ?? null,
        `Opened ${robot.config?.side ?? 'buy'} ${robot.config?.volume ?? 0.01} ` +
        `${robot.config?.symbols?.[0] ?? '?'} @ ${result.price}`, now);
      await updateRobotStats(robot.id, robot.total_trades ?? 0, now);
    } else {
      await logRun(robot.id, 'trade_failed', null, result.error ?? 'unknown', now);
      await touchRobotLastRun(robot.id, now);
    }
  } else if (kind === 'tip') {
    // Phase 3.4 will add push notification here
    const tipText = robot.config?.description ?? robot.name ?? 'Tip from robot';
    await logRun(robot.id, 'tip_sent', null, tipText, now);
    await touchRobotLastRun(robot.id, now);
  } else {
    await logRun(robot.id, 'noop', null, `Unknown kind: ${kind}`, now);
    await touchRobotLastRun(robot.id, now);
  }
}

// ---------------------------------------------------------------------------
// Schedule check
// ---------------------------------------------------------------------------
function shouldFire(
  robotId: string,
  schedule: any,
  lastRunAt: string | null,
  now: Date,
): boolean {
  const { type, value } = schedule ?? {};
  if (!type) return false;

  if (type === 'interval') {
    const ms = Number(value);
    if (!ms || ms <= 0) return false;
    const lastMs = lastFiredMs.get(robotId)
      ?? (lastRunAt ? new Date(lastRunAt).getTime() : 0);
    return now.getTime() - lastMs >= ms;
  }

  if (type === 'cron') {
    if (!value) return false;
    return matchesCron(String(value), now);
  }

  if (type === 'event') {
    if (!value) return false;
    return matchesMarketEvent(robotId, String(value), now);
  }

  return false;
}

// ---------------------------------------------------------------------------
// Cron matching — supports: * */N N N-M N,M,K
// All fields compared against UTC time.
// ---------------------------------------------------------------------------
function matchesCron(expr: string, now: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return false;
  const [minE, hrE, domE, monE, dowE] = parts;
  return (
    matchField(minE,  now.getUTCMinutes())     &&
    matchField(hrE,   now.getUTCHours())       &&
    matchField(domE,  now.getUTCDate())        &&
    matchField(monE,  now.getUTCMonth() + 1)  &&
    matchField(dowE,  now.getUTCDay())
  );
}

function matchField(expr: string, val: number): boolean {
  if (expr === '*') return true;
  if (expr.startsWith('*/')) {
    const step = parseInt(expr.slice(2), 10);
    return Number.isFinite(step) && step > 0 && val % step === 0;
  }
  if (expr.includes(',')) {
    return expr.split(',').map(Number).includes(val);
  }
  if (expr.includes('-')) {
    const [lo, hi] = expr.split('-').map(Number);
    return Number.isFinite(lo) && Number.isFinite(hi) && val >= lo && val <= hi;
  }
  const n = parseInt(expr, 10);
  return Number.isFinite(n) && n === val;
}

// ---------------------------------------------------------------------------
// Market-event matching — fires once per UTC calendar day per robot
// ---------------------------------------------------------------------------
function matchesMarketEvent(robotId: string, eventName: string, now: Date): boolean {
  const ev = MARKET_EVENTS[eventName];
  if (!ev) return false;

  if (now.getUTCHours() !== ev.utcHour || now.getUTCMinutes() !== ev.utcMinute) return false;

  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const key   = `${robotId}:${eventName}`;
  if (firedToday.get(key) === today) return false; // already fired today

  firedToday.set(key, today);

  // Prune stale entries (anything not from today)
  for (const [k, v] of firedToday.entries()) {
    if (v !== today) firedToday.delete(k);
  }

  return true;
}

// ---------------------------------------------------------------------------
// Internal OMS — open a trade on behalf of a robot
// ---------------------------------------------------------------------------
async function openRobotTrade(
  app: FastifyInstance,
  robot: any,
): Promise<{ ok: boolean; tradeId?: number; price?: number; error?: string }> {
  const account   = robot.accounts as any;
  const config    = robot.config ?? {};
  const symbol: string  = config.symbols?.[0];
  const rawSide: string = config.side === 'either' ? 'buy' : (config.side ?? 'buy');
  const side: 'buy' | 'sell' = rawSide === 'sell' ? 'sell' : 'buy';
  const volume: number  = Number(config.volume) || 0.01;
  const slPct: number | undefined   = config.risk?.stop_loss_pct;
  const tpPct: number | undefined   = config.risk?.take_profit_pct;
  const maxConc: number = Number(config.risk?.max_concurrent) || 1;

  if (!symbol || !account?.id) {
    return { ok: false, error: 'missing_symbol_or_account' };
  }

  // Enforce max_concurrent open robot trades
  if (maxConc > 0) {
    const { count } = await supabaseAdmin
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', account.id)
      .eq('status', 'open')
      .eq('reason', 'robot');
    if ((count ?? 0) >= maxConc) {
      return { ok: false, error: 'max_concurrent_reached' };
    }
  }

  const quote = getQuote(symbol);
  if (!quote) return { ok: false, error: `no_quote:${symbol}` };

  const openPrice = side === 'buy' ? quote.ask : quote.bid;
  const leverage  = Number(account.leverage) || 1;
  const required  = +requiredMargin(volume, openPrice, symbol, leverage).toFixed(2);
  const available = Number(account.free_margin) || 0;

  if (available < required) {
    return { ok: false, error: `insufficient_margin:required=${required},available=${available}` };
  }

  const reserveResult = await reserveMargin(
    { id: account.id, free_margin: available, margin_used: Number(account.margin_used) || 0 },
    required,
    app.log,
  );
  if (!reserveResult.ok) {
    return { ok: false, error: `margin_reserve_failed:${reserveResult.reason}` };
  }

  // Compute SL / TP from percentage config
  const stopLoss = slPct
    ? +(side === 'buy'
        ? openPrice * (1 - slPct / 100)
        : openPrice * (1 + slPct / 100)).toFixed(5)
    : null;
  const takeProfit = tpPct
    ? +(side === 'buy'
        ? openPrice * (1 + tpPct / 100)
        : openPrice * (1 - tpPct / 100)).toFixed(5)
    : null;

  const { data: trade, error: insErr } = await supabaseAdmin
    .from('trades')
    .insert({
      account_id:    account.id,
      symbol,
      side,
      volume,
      open_price:    openPrice,
      current_price: openPrice,
      stop_loss:     stopLoss,
      take_profit:   takeProfit,
      reason:        'robot',
    })
    .select('id')
    .single();

  if (insErr || !trade) {
    // Best-effort: release margin we just reserved
    try {
      const { releaseMargin } = await import('../lib/margin.js');
      await releaseMargin(account.id, required, app.log);
    } catch {}
    return { ok: false, error: insErr?.message ?? 'insert_failed' };
  }

  return { ok: true, tradeId: trade.id, price: openPrice };
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------
async function logRun(
  robotId: string,
  action: string,
  tradeId: number | null,
  notes: string,
  now: Date,
) {
  await supabaseAdmin.from('robot_runs').insert({
    robot_id:     robotId,
    action,
    trade_id:     tradeId,
    notes,
    triggered_at: now.toISOString(),
  });
}

async function updateRobotStats(robotId: string, prevTotalTrades: number, now: Date) {
  await supabaseAdmin
    .from('robots')
    .update({ last_run_at: now.toISOString(), total_trades: prevTotalTrades + 1 })
    .eq('id', robotId);
}

async function touchRobotLastRun(robotId: string, now: Date) {
  await supabaseAdmin
    .from('robots')
    .update({ last_run_at: now.toISOString() })
    .eq('id', robotId);
}
