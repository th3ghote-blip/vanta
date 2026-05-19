/**
 * workerHealth — shared tick-timestamp registry.
 *
 * Each worker calls recordTick(name) at the end of every successful tick so
 * the /api/health/workers endpoint can surface which workers are stuck.
 */

const ticks: Record<string, number> = {};

export function recordTick(worker: string): void {
  ticks[worker] = Date.now();
}

interface WorkerStatus {
  lastTickMs: number;
  lastTickAgo: string;
  ok: boolean;
}

export function getWorkerHealth(): Record<string, WorkerStatus> {
  const now = Date.now();
  const STALE_MS = 30_000; // consider stuck if no tick in 30s
  return Object.fromEntries(
    Object.entries(ticks).map(([name, ts]) => {
      const ago = now - ts;
      return [
        name,
        {
          lastTickMs: ts,
          lastTickAgo: `${Math.round(ago / 1000)}s ago`,
          ok: ago < STALE_MS,
        },
      ];
    }),
  );
}
