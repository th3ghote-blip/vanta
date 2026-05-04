import type { FastifyInstance } from 'fastify';
import { supabaseAdmin } from '../lib/supabase.js';

/**
 * Robot execution loop. Polls the `robots` table every 30 seconds for active
 * robots whose schedule says "fire now," runs their action, and logs to
 * `robot_runs`.
 *
 * This is a stub — full implementation needs:
 * - cron-style scheduler (next-fire-at column)
 * - per-symbol indicator computation (RSI, MAs)
 * - event triggers (nyse_open) wired to a market-clock service
 * - rate limiting per account
 */
export function startRobotEngine(app: FastifyInstance) {
  setInterval(async () => {
    try {
      const { data: robots, error } = await supabaseAdmin
        .from('robots')
        .select('*')
        .eq('status', 'active');

      if (error) {
        app.log.warn({ error }, 'robot_engine: select failed');
        return;
      }

      for (const robot of robots ?? []) {
        const shouldFire = checkSchedule(robot.config?.schedule, robot.last_run_at);
        if (!shouldFire) continue;

        // TODO: evaluate conditions, place trade, send tip notification
        await supabaseAdmin
          .from('robot_runs')
          .insert({ robot_id: robot.id, action: 'noop', notes: 'engine stub' });

        await supabaseAdmin
          .from('robots')
          .update({ last_run_at: new Date().toISOString() })
          .eq('id', robot.id);
      }
    } catch (err) {
      app.log.error({ err }, 'robot_engine: tick failed');
    }
  }, 30_000);

  app.log.info('Robot engine started.');
}

function checkSchedule(schedule: any, lastRunAt: string | null): boolean {
  if (!schedule) return false;

  if (schedule.type === 'interval') {
    const ms = Number(schedule.value);
    if (!ms) return false;
    if (!lastRunAt) return true;
    return Date.now() - new Date(lastRunAt).getTime() >= ms;
  }

  // cron / event types: not implemented in stub
  return false;
}
