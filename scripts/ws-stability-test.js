#!/usr/bin/env node
/**
 * QA-3.2 — WebSocket price feed stability test.
 *
 * Connects to the /ws/quotes feed, subscribes to all symbols, then monitors
 * for 5 minutes. Reports:
 *   - Total tick count
 *   - Average interval between ticks (ms)
 *   - Maximum gap between any two consecutive ticks (ms)
 *   - Any reconnect events
 *
 * Exits 0 if max gap < 10 000 ms for any symbol that has ticked at all.
 * Exits 1 if max gap >= 10 000 ms (stale feed detected).
 *
 * Usage:
 *   node scripts/ws-stability-test.js [--url wss://custom-host/ws/quotes] [--duration 300]
 */

import WebSocket from 'ws';

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
};

const WS_URL = getArg('--url')
  ?? process.env.WS_URL
  ?? 'wss://vanta-server-production.up.railway.app/ws/quotes';

const DURATION_S = parseInt(getArg('--duration') ?? process.env.DURATION_S ?? '300', 10);
const STALE_THRESHOLD_MS = 10_000; // 10 seconds

// ── State ─────────────────────────────────────────────────────────────────────
const stats = {
  connected: false,
  connectTime: null,
  reconnects: 0,
  ticks: 0,
  lastTickTime: null,
  maxGapMs: 0,
  totalIntervalMs: 0,
  intervals: 0,
  perSymbol: new Map(), // symbol → { ticks, lastTime, maxGap }
  errors: [],
};

// ── Connect ───────────────────────────────────────────────────────────────────
let ws;
let done = false;

function connect() {
  console.log(`[ws-stability] connecting to ${WS_URL} …`);
  ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    stats.connected = true;
    stats.connectTime = Date.now();
    console.log('[ws-stability] connected ✓');
    if (stats.reconnects > 0) {
      console.log(`[ws-stability] reconnect #${stats.reconnects}`);
    }
  });

  ws.on('message', (raw) => {
    const now = Date.now();
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return; // ignore non-JSON frames
    }

    const quotes = msg.type === 'snapshot'
      ? (msg.quotes ?? [])
      : msg.type === 'tick'
        ? [msg]
        : [];

    for (const q of quotes) {
      const symbol = q.symbol;
      if (!symbol) continue;

      stats.ticks++;
      if (stats.lastTickTime !== null) {
        const gap = now - stats.lastTickTime;
        stats.totalIntervalMs += gap;
        stats.intervals++;
        if (gap > stats.maxGapMs) stats.maxGapMs = gap;
      }
      stats.lastTickTime = now;

      // Per-symbol tracking
      if (!stats.perSymbol.has(symbol)) {
        stats.perSymbol.set(symbol, { ticks: 0, lastTime: null, maxGap: 0 });
      }
      const ps = stats.perSymbol.get(symbol);
      ps.ticks++;
      if (ps.lastTime !== null) {
        const symbolGap = now - ps.lastTime;
        if (symbolGap > ps.maxGap) ps.maxGap = symbolGap;
      }
      ps.lastTime = now;
    }
  });

  ws.on('error', (err) => {
    stats.errors.push({ time: new Date().toISOString(), message: err.message });
    console.error(`[ws-stability] error: ${err.message}`);
  });

  ws.on('close', (code, reason) => {
    stats.connected = false;
    if (!done) {
      stats.reconnects++;
      console.warn(`[ws-stability] disconnected (code=${code}), reconnecting in 2s …`);
      setTimeout(connect, 2000);
    }
  });
}

// ── Run ───────────────────────────────────────────────────────────────────────
connect();

// Progress heartbeat every 30s
const progressTimer = setInterval(() => {
  const elapsed = Math.round((Date.now() - (stats.connectTime ?? Date.now())) / 1000);
  console.log(
    `[ws-stability] ${elapsed}s elapsed | ticks=${stats.ticks} | maxGap=${stats.maxGapMs}ms`,
  );
}, 30_000);

// Finish after DURATION_S
setTimeout(() => {
  done = true;
  clearInterval(progressTimer);
  ws.close();

  // ── Report ─────────────────────────────────────────────────────────────────
  const avgInterval = stats.intervals > 0
    ? Math.round(stats.totalIntervalMs / stats.intervals)
    : 0;

  console.log('\n══════════════════════════════════════════');
  console.log('  WebSocket Stability Test — Results');
  console.log('══════════════════════════════════════════');
  console.log(`  URL          : ${WS_URL}`);
  console.log(`  Duration     : ${DURATION_S}s`);
  console.log(`  Reconnects   : ${stats.reconnects}`);
  console.log(`  Total ticks  : ${stats.ticks}`);
  console.log(`  Avg interval : ${avgInterval} ms`);
  console.log(`  Max gap      : ${stats.maxGapMs} ms`);
  console.log(`  Errors       : ${stats.errors.length}`);

  if (stats.perSymbol.size > 0) {
    console.log('\n  Per-symbol breakdown:');
    for (const [sym, s] of [...stats.perSymbol.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const stale = s.maxGap >= STALE_THRESHOLD_MS;
      console.log(
        `    ${sym.padEnd(10)} ticks=${s.ticks}  maxGap=${s.maxGap}ms${stale ? '  ⚠ STALE' : ''}`,
      );
    }
  }

  if (stats.errors.length > 0) {
    console.log('\n  Errors:');
    for (const e of stats.errors) console.log(`    ${e.time} ${e.message}`);
  }

  console.log('══════════════════════════════════════════\n');

  // Determine pass/fail
  let staleSymbols = 0;
  for (const [, s] of stats.perSymbol) {
    if (s.maxGap >= STALE_THRESHOLD_MS) staleSymbols++;
  }

  if (stats.ticks === 0) {
    console.error('FAIL: no ticks received during the test window');
    process.exit(1);
  }
  if (staleSymbols > 0) {
    console.error(`FAIL: ${staleSymbols} symbol(s) had a gap ≥ ${STALE_THRESHOLD_MS}ms`);
    process.exit(1);
  }

  console.log('PASS ✓ — no stale symbols, feed is healthy');
  process.exit(0);
}, DURATION_S * 1000);
