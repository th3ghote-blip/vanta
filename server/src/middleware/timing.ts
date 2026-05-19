/**
 * Route timing registry for R.10 performance dashboard.
 *
 * Every request records (route, durationMs) with a timestamp.
 * Stats are computed over a rolling 5-minute window.
 * Stale entries are pruned on each record() call so memory stays bounded.
 */

const WINDOW_MS = 5 * 60 * 1_000; // 5 minutes
const MAX_PER_ROUTE = 2_000;       // hard cap per route bucket

interface Sample {
  ts:  number; // epoch ms when recorded
  dur: number; // request duration ms
}

const store = new Map<string, Sample[]>();

/** Record a completed request. Call from Fastify onResponse hook. */
export function recordTiming(route: string, durationMs: number): void {
  const now = Date.now();
  if (!store.has(route)) store.set(route, []);
  const samples = store.get(route)!;
  samples.push({ ts: now, dur: durationMs });

  // Prune entries outside the window
  const cutoff = now - WINDOW_MS;
  let i = 0;
  while (i < samples.length && samples[i].ts < cutoff) i++;
  if (i > 0) samples.splice(0, i);

  // Safety cap
  if (samples.length > MAX_PER_ROUTE) {
    samples.splice(0, samples.length - MAX_PER_ROUTE);
  }
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export interface RouteStats {
  route:  string;
  count:  number;
  p50:    number; // ms
  p95:    number; // ms
  p99:    number; // ms
  min:    number; // ms
  max:    number; // ms
}

/** Return per-route stats over the last 5 minutes, sorted by p95 descending. */
export function getTimingStats(): RouteStats[] {
  const now    = Date.now();
  const cutoff = now - WINDOW_MS;
  const result: RouteStats[] = [];

  for (const [route, samples] of store.entries()) {
    const durs = samples
      .filter(s => s.ts >= cutoff)
      .map(s => s.dur)
      .sort((a, b) => a - b);

    if (durs.length === 0) continue;

    result.push({
      route,
      count: durs.length,
      p50:   Math.round(pct(durs, 50)),
      p95:   Math.round(pct(durs, 95)),
      p99:   Math.round(pct(durs, 99)),
      min:   Math.round(durs[0]),
      max:   Math.round(durs[durs.length - 1]),
    });
  }

  result.sort((a, b) => b.p95 - a.p95);
  return result;
}
