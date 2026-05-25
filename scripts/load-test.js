/**
 * Vanta Load Test — k6 script
 *
 * Usage:
 *   k6 run scripts/load-test.js
 *   k6 run --vus 50 --duration 60s scripts/load-test.js
 *   k6 run --vus 200 --duration 120s scripts/load-test.js   # stress test
 *
 * Install k6: https://grafana.com/docs/k6/latest/set-up/install-k6/
 *   macOS:  brew install k6
 *   Linux:  sudo apt-get install k6   (or snap install k6)
 *   Docker: docker run --rm -i grafana/k6 run - < scripts/load-test.js
 *
 * To run against a local server:
 *   BASE_URL=http://localhost:3000 k6 run scripts/load-test.js
 *
 * Target:
 *   Base URL: https://vanta-server-production.up.railway.app
 *   Endpoints: /health, /api/quotes, /api/orders/open (authenticated)
 *
 * Acceptance thresholds (per TODO 16.3):
 *   p95 < 800ms for public endpoints (/health, /api/quotes)
 *   p95 < 1200ms for authenticated trade endpoints
 *   error rate < 1% at 100 VUs sustained for 60s
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'https://vanta-server-production.up.railway.app';

// A real Supabase JWT for a test account.  Set via env var so it never lands
// in source control:  TEST_JWT=eyJ... k6 run scripts/load-test.js
// The test account should be a dedicated load-test user with a demo balance.
const TEST_JWT = __ENV.TEST_JWT || '';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

const errorRate   = new Rate('vanta_errors');
const healthTrend = new Trend('vanta_health_ms');
const quotesTrend = new Trend('vanta_quotes_ms');
const ordersTrend = new Trend('vanta_orders_ms');
const barsTrend   = new Trend('vanta_bars_ms');

// ---------------------------------------------------------------------------
// Load profile
// ---------------------------------------------------------------------------

export const options = {
  scenarios: {
    // Ramp up to 100 VUs hitting public endpoints
    public_endpoints: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 20  },  // warm-up
        { duration: '30s', target: 100 },  // ramp to target
        { duration: '60s', target: 100 },  // sustain
        { duration: '15s', target: 0   },  // ramp down
      ],
      gracefulRampDown: '5s',
    },

    // Separate scenario for authenticated trade endpoints (fewer VUs — mirrors
    // realistic ratio of readers vs. active traders)
    authenticated_endpoints: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 5   },
        { duration: '30s', target: 25  },
        { duration: '60s', target: 25  },
        { duration: '15s', target: 0   },
      ],
      gracefulRampDown: '5s',
      // Only run authenticated tests if a JWT was supplied
      exec: TEST_JWT ? 'authenticatedFlow' : 'skipAuthenticated',
    },
  },

  thresholds: {
    // Public endpoint SLOs
    vanta_health_ms:  ['p(95)<500'],
    vanta_quotes_ms:  ['p(95)<800'],
    vanta_bars_ms:    ['p(95)<2000'],  // bars hit upstream (Coinbase / Twelve Data)

    // Authenticated SLO
    vanta_orders_ms:  ['p(95)<1200'],

    // Overall error budget
    vanta_errors:      ['rate<0.01'],   // < 1% errors
    http_req_failed:   ['rate<0.02'],   // < 2% HTTP failures (incl. 4xx)

    // Raw k6 duration for the full request set
    http_req_duration: ['p(95)<2000'],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function headers(withAuth = false) {
  const h = { 'Content-Type': 'application/json' };
  if (withAuth && TEST_JWT) h['Authorization'] = `Bearer ${TEST_JWT}`;
  return h;
}

function record(trend, res, tag) {
  const ok = res.status >= 200 && res.status < 300;
  errorRate.add(!ok);
  trend.add(res.timings.duration, { endpoint: tag });
  return ok;
}

// ---------------------------------------------------------------------------
// Public flow (no auth required)
// ---------------------------------------------------------------------------

export default function publicFlow() {
  // 1. Health check
  {
    const res = http.get(`${BASE_URL}/health`, { tags: { endpoint: 'health' } });
    const ok = record(healthTrend, res, 'health');
    check(res, {
      'health 200':    (r) => r.status === 200,
      'health ok:true': (r) => r.json('ok') === true,
    });
  }

  sleep(0.2);

  // 2. All quotes (the ticker strip — heaviest public read)
  {
    const res = http.get(`${BASE_URL}/api/quotes`, { tags: { endpoint: 'quotes' } });
    const ok = record(quotesTrend, res, 'quotes');
    check(res, {
      'quotes 200':          (r) => r.status === 200,
      'quotes has BTC-USD':  (r) => { try { return !!r.json()['BTC-USD']; } catch { return false; } },
    });
  }

  sleep(0.2);

  // 3. Single quote
  {
    const res = http.get(`${BASE_URL}/api/quotes/BTC-USD`, { tags: { endpoint: 'quotes_single' } });
    record(quotesTrend, res, 'quotes_single');
    check(res, { 'quote single 200': (r) => r.status === 200 });
  }

  sleep(0.2);

  // 4. Bars for BTC (1m, 100 bars) — exercises the Coinbase upstream + cache
  {
    const res = http.get(`${BASE_URL}/api/bars/BTC-USD?tf=1m&limit=100`, { tags: { endpoint: 'bars' } });
    record(barsTrend, res, 'bars');
    check(res, {
      'bars 200':        (r) => r.status === 200,
      'bars has data':   (r) => { try { return r.json('bars').length > 0; } catch { return false; } },
    });
  }

  sleep(Math.random() * 0.5 + 0.1);  // 0.1–0.6s think time
}

// ---------------------------------------------------------------------------
// Authenticated flow (requires TEST_JWT)
// ---------------------------------------------------------------------------

export function authenticatedFlow() {
  if (!TEST_JWT) return;

  // 1. Fetch open orders
  {
    const res = http.get(`${BASE_URL}/api/orders/open`, {
      headers: headers(true),
      tags: { endpoint: 'orders_open' },
    });
    record(ordersTrend, res, 'orders_open');
    check(res, { 'orders/open 200': (r) => r.status === 200 });
  }

  sleep(0.3);

  // 2. Fetch account balance
  {
    const res = http.get(`${BASE_URL}/api/account`, {
      headers: headers(true),
      tags: { endpoint: 'account' },
    });
    record(ordersTrend, res, 'account');
    check(res, { 'account 200': (r) => r.status === 200 });
  }

  sleep(0.3);

  // 3. Fetch closed trades (history)
  {
    const res = http.get(`${BASE_URL}/api/orders/closed?limit=20`, {
      headers: headers(true),
      tags: { endpoint: 'orders_closed' },
    });
    record(ordersTrend, res, 'orders_closed');
    check(res, { 'orders/closed 200': (r) => r.status === 200 });
  }

  sleep(Math.random() * 0.5 + 0.2);

  // NOTE: We intentionally do NOT open/close real trades under load — that
  // would create real DB rows and pollute the test account.  Stress-testing
  // POST /api/orders/open should be done against a dedicated staging
  // environment with a test Supabase project.
}

// No-op executor when JWT not supplied
export function skipAuthenticated() {
  sleep(1);
}

// ---------------------------------------------------------------------------
// Summary handler — prints a human-readable p95 table at the end
// ---------------------------------------------------------------------------

export function handleSummary(data) {
  const ms = (metric) => {
    const m = data.metrics[metric];
    if (!m) return 'N/A';
    return `p50=${m.values['p(50)'].toFixed(0)}ms  p95=${m.values['p(95)'].toFixed(0)}ms  p99=${m.values['p(99)'].toFixed(0)}ms`;
  };

  const lines = [
    '',
    '╔══════════════════════════════════════════════════════════╗',
    '║              VANTA LOAD TEST — RESULTS SUMMARY           ║',
    '╠══════════════════════════════════════════════════════════╣',
    `║  /health               ${ms('vanta_health_ms').padEnd(35)}║`,
    `║  /api/quotes           ${ms('vanta_quotes_ms').padEnd(35)}║`,
    `║  /api/bars/*           ${ms('vanta_bars_ms').padEnd(35)}║`,
    `║  authenticated ops     ${ms('vanta_orders_ms').padEnd(35)}║`,
    '╠══════════════════════════════════════════════════════════╣',
    `║  error rate            ${(data.metrics['vanta_errors']?.values?.rate * 100).toFixed(2).padEnd(35)}%  ║`,
    '╚══════════════════════════════════════════════════════════╝',
    '',
    'Thresholds:',
    '  /health   p95 < 500ms',
    '  /quotes   p95 < 800ms',
    '  /bars     p95 < 2000ms  (upstream-bound)',
    '  auth ops  p95 < 1200ms',
    '  errors    < 1%',
    '',
  ];

  return {
    stdout: lines.join('\n'),
    'load-test-results.json': JSON.stringify(data, null, 2),
  };
}
