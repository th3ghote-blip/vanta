#!/usr/bin/env node
/**
 * Vanta Load Test — Node.js (no extra deps required)
 *
 * Fallback if k6 is not installed.  Uses Node's built-in `https` module.
 * Produces p50/p95/p99 latency numbers identical to the k6 script.
 *
 * Usage:
 *   node scripts/load-test-node.js
 *   BASE_URL=http://localhost:3000 node scripts/load-test-node.js
 *   CONCURRENCY=200 DURATION=60 node scripts/load-test-node.js
 *
 * Env vars:
 *   BASE_URL      Target server (default: https://vanta-server-production.up.railway.app)
 *   CONCURRENCY   Number of parallel workers (default: 100)
 *   DURATION      Test duration in seconds (default: 60)
 *   TEST_JWT      Bearer token for authenticated endpoints (optional)
 */

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const BASE_URL    = process.env.BASE_URL    || 'https://vanta-server-production.up.railway.app';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '100', 10);
const DURATION_S  = parseInt(process.env.DURATION    || '60',  10);
const TEST_JWT    = process.env.TEST_JWT    || '';

// ---------------------------------------------------------------------------
// HTTP helper — returns { statusCode, durationMs }
// ---------------------------------------------------------------------------

function request(urlStr, opts = {}) {
  return new Promise((resolve) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const t0 = Date.now();
    const req = lib.request({
      hostname: u.hostname,
      port:     u.port || (u.protocol === 'https:' ? 443 : 80),
      path:     u.pathname + u.search,
      method:   opts.method || 'GET',
      headers:  opts.headers || {},
      timeout:  10000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, durationMs: Date.now() - t0, body });
      });
    });
    req.on('error', () => resolve({ statusCode: 0, durationMs: Date.now() - t0, body: '' }));
    req.on('timeout', () => { req.destroy(); resolve({ statusCode: 0, durationMs: Date.now() - t0, body: '' }); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

const samples = {};  // tag → number[]

function record(tag, durationMs, statusCode) {
  if (!samples[tag]) samples[tag] = [];
  samples[tag].push(durationMs);
  if (statusCode < 200 || statusCode >= 300) {
    if (!samples['__errors']) samples['__errors'] = [];
    samples['__errors'].push(1);
  }
}

function percentile(arr, p) {
  if (!arr || arr.length === 0) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ---------------------------------------------------------------------------
// Worker — runs one iteration of the public flow
// ---------------------------------------------------------------------------

async function publicIteration() {
  {
    const r = await request(`${BASE_URL}/health`);
    record('health', r.durationMs, r.statusCode);
  }
  await sleep(200);

  {
    const r = await request(`${BASE_URL}/api/quotes`);
    record('quotes', r.durationMs, r.statusCode);
  }
  await sleep(200);

  {
    const r = await request(`${BASE_URL}/api/bars/BTC-USD?tf=1m&limit=100`);
    record('bars', r.durationMs, r.statusCode);
  }
  await sleep(200 + Math.random() * 400);
}

async function authIteration() {
  if (!TEST_JWT) { await sleep(1000); return; }
  const h = { 'Authorization': `Bearer ${TEST_JWT}` };

  {
    const r = await request(`${BASE_URL}/api/orders/open`, { headers: h });
    record('orders_open', r.durationMs, r.statusCode);
  }
  await sleep(300);

  {
    const r = await request(`${BASE_URL}/api/account`, { headers: h });
    record('account', r.durationMs, r.statusCode);
  }
  await sleep(300 + Math.random() * 400);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function workerLoop(fn, endAt) {
  while (Date.now() < endAt) {
    await fn();
  }
}

async function main() {
  console.log(`\nVanta Load Test (Node.js fallback)`);
  console.log(`Target:      ${BASE_URL}`);
  console.log(`Concurrency: ${CONCURRENCY} VUs`);
  console.log(`Duration:    ${DURATION_S}s`);
  console.log(`Auth:        ${TEST_JWT ? 'yes' : 'no (set TEST_JWT to enable)'}`);
  console.log('');
  console.log('Running...');

  const endAt = Date.now() + DURATION_S * 1000;
  const pubWorkers  = Math.floor(CONCURRENCY * 0.8);
  const authWorkers = Math.floor(CONCURRENCY * 0.2);

  const workers = [
    ...Array.from({ length: pubWorkers  }, () => workerLoop(publicIteration, endAt)),
    ...Array.from({ length: authWorkers }, () => workerLoop(authIteration,   endAt)),
  ];

  await Promise.all(workers);

  // ---------------------------------------------------------------------------
  // Results
  // ---------------------------------------------------------------------------

  const totalRequests = Object.values(samples)
    .filter((_, i) => Object.keys(samples)[i] !== '__errors')
    .reduce((s, arr) => s + arr.length, 0);
  const totalErrors  = (samples['__errors'] || []).length;
  const errorRate    = totalRequests > 0 ? (totalErrors / totalRequests * 100).toFixed(2) : '0.00';

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║              VANTA LOAD TEST — RESULTS SUMMARY           ║');
  console.log('╠══════════════════════════════════════════════════════════╣');

  const tags = ['health', 'quotes', 'bars', 'orders_open', 'account'];
  for (const tag of tags) {
    const arr = samples[tag];
    if (!arr || arr.length === 0) continue;
    const p50 = percentile(arr, 50).toFixed(0);
    const p95 = percentile(arr, 95).toFixed(0);
    const p99 = percentile(arr, 99).toFixed(0);
    const label = tag.padEnd(18);
    const vals  = `p50=${p50}ms  p95=${p95}ms  p99=${p99}ms`.padEnd(35);
    console.log(`║  ${label}  ${vals}  ║`);
  }

  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  requests total    ${String(totalRequests).padEnd(39)}║`);
  console.log(`║  error rate        ${(errorRate + '%').padEnd(39)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  console.log('\nThresholds:');
  console.log('  /health   p95 < 500ms');
  console.log('  /quotes   p95 < 800ms');
  console.log('  /bars     p95 < 2000ms  (upstream-bound)');
  console.log('  auth ops  p95 < 1200ms');
  console.log('  errors    < 1%');

  // Threshold check
  const thresholds = [
    { tag: 'health',      p: 95, limit: 500  },
    { tag: 'quotes',      p: 95, limit: 800  },
    { tag: 'bars',        p: 95, limit: 2000 },
    { tag: 'orders_open', p: 95, limit: 1200 },
    { tag: 'account',     p: 95, limit: 1200 },
  ];

  let passed = true;
  console.log('\nThreshold check:');
  for (const t of thresholds) {
    if (!samples[t.tag]) continue;
    const val = percentile(samples[t.tag], t.p);
    const ok  = val <= t.limit;
    if (!ok) passed = false;
    console.log(`  ${ok ? '✅' : '❌'} ${t.tag} p${t.p} = ${val.toFixed(0)}ms (limit ${t.limit}ms)`);
  }
  if (parseFloat(errorRate) >= 1) {
    passed = false;
    console.log(`  ❌ error rate ${errorRate}% >= 1%`);
  } else {
    console.log(`  ✅ error rate ${errorRate}% < 1%`);
  }

  console.log(`\n${passed ? '✅ ALL THRESHOLDS PASSED' : '❌ ONE OR MORE THRESHOLDS FAILED'}\n`);
  process.exit(passed ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
