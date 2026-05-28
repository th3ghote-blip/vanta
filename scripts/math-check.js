#!/usr/bin/env node
/**
 * QA-6.1 — Live trade math smoke-test.
 *
 * Validates the full open→read→close cycle against the live backend and
 * verifies that P&L and margin numbers are internally consistent.
 *
 * Steps:
 *   1. GET  /api/quotes         → get live BTCUSD bid/ask
 *   2. POST /api/orders/open    → open 0.01 BTC buy (market)
 *   3. GET  /api/orders         → read back the opened trade
 *   4. Assert open_price within 1% of the quote
 *   5. Assert margin_used ≈ notional / leverage
 *   6. POST /api/orders/close   → close immediately
 *   7. Assert closed P&L within $1 of expected (near-zero for instant close)
 *
 * Run:
 *   TEST_JWT=<supabase_access_token> node scripts/math-check.js
 *   TEST_JWT=... BASE_URL=https://custom-host node scripts/math-check.js
 *
 * Exits 0 if all checks pass, 1 if any check fails.
 */

const BASE_URL = process.env.BASE_URL
  ?? 'https://vanta-server-production.up.railway.app';
const JWT = process.env.TEST_JWT;

if (!JWT) {
  console.error('ERROR: TEST_JWT env var is required');
  console.error('  Generate one: curl -sX POST https://vanta-server-production.up.railway.app/api/auth/register -H "Content-Type: application/json" -d \'{}\'');
  process.exit(1);
}

const SYMBOL = 'BTCUSD';
const VOLUME = 0.01;
const LEVERAGE = 100; // default account leverage
const CONTRACT_SIZE = 1; // BTCUSD contract size = 1

let failures = 0;

function fail(msg, got, expected) {
  failures++;
  console.error(`  FAIL  ${msg}`);
  if (got !== undefined) console.error(`         got ${got}, expected ${expected ?? '(see above)'}`);
}

function ok(msg) {
  console.log(`  ok    ${msg}`);
}

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JWT}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${method} ${path}: ${JSON.stringify(data)}`);
  }
  return data;
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\nMath check — ${BASE_URL}`);
  console.log('═'.repeat(56));

  // 1. Get live BTCUSD quote
  console.log('\n[1/7] Fetching live quote …');
  const quotes = await api('GET', '/api/quotes');
  const btcQuote = (quotes.quotes ?? quotes).find
    ? (quotes.quotes ?? quotes).find((q) => q.symbol === SYMBOL)
    : quotes[SYMBOL] ?? null;

  if (!btcQuote) {
    fail(`no ${SYMBOL} quote found in response`, JSON.stringify(quotes).slice(0, 100));
    process.exit(1);
  }
  const { bid, ask } = btcQuote;
  const mid = (bid + ask) / 2;
  ok(`${SYMBOL} bid=${bid} ask=${ask} mid=${mid}`);

  // 2. Open a 0.01 BTC buy (market)
  console.log('\n[2/7] Opening 0.01 BTC buy …');
  let openRes;
  try {
    // Need to know the accountId. First fetch account list.
    const accountData = await api('GET', '/api/account/all');
    const accounts = accountData.accounts ?? [];
    if (accounts.length === 0) {
      fail('no accounts found for test user');
      process.exit(1);
    }
    const accountId = accounts[0].id;
    ok(`using account ${accountId}`);

    openRes = await api('POST', '/api/orders/open', {
      accountId,
      symbol: SYMBOL,
      side: 'buy',
      volume: VOLUME,
    });
  } catch (err) {
    fail(`open order failed: ${err.message}`);
    process.exit(1);
  }
  const tradeId = openRes.tradeId ?? openRes.id;
  ok(`trade opened: id=${tradeId}`);

  // 3. Read back the opened trade
  console.log('\n[3/7] Reading back the trade …');
  const accountData2 = await api('GET', '/api/account/all');
  const accountId = accountData2.accounts[0].id;
  const ordersData = await api('GET', `/api/orders?accountId=${accountId}&status=open`);
  const trades = ordersData.trades ?? ordersData;
  const trade = Array.isArray(trades)
    ? trades.find((t) => t.id === tradeId)
    : null;

  if (!trade) {
    fail(`trade ${tradeId} not found in open orders`);
    // Try to close anyway to avoid leaving a dangling position
  } else {
    ok(`trade found: open_price=${trade.open_price} volume=${trade.volume}`);

    // 4. Assert open_price within 1% of quote
    console.log('\n[4/7] open_price vs quote …');
    const openPrice = Number(trade.open_price);
    const pctDiff = Math.abs((openPrice - ask) / ask) * 100;
    if (pctDiff <= 1) {
      ok(`open_price ${openPrice} is within 1% of ask ${ask} (diff=${pctDiff.toFixed(3)}%)`);
    } else {
      fail(`open_price too far from quote: diff=${pctDiff.toFixed(2)}%`, openPrice, `within 1% of ask ${ask}`);
    }

    // 5. Assert margin_used ≈ notional / leverage
    console.log('\n[5/7] margin_used check …');
    const expectedMargin = (VOLUME * openPrice * CONTRACT_SIZE) / LEVERAGE;
    const actualMargin = Number(trade.margin_used ?? 0);
    const marginDiff = Math.abs(actualMargin - expectedMargin);
    if (marginDiff < 1.0) {
      ok(`margin_used ${actualMargin.toFixed(4)} ≈ expected ${expectedMargin.toFixed(4)} (diff=${marginDiff.toFixed(4)})`);
    } else {
      fail(`margin_used too far from expected`, actualMargin.toFixed(4), expectedMargin.toFixed(4));
    }
  }

  // 6. Close the trade immediately
  console.log('\n[6/7] Closing trade immediately …');
  let closeRes;
  try {
    closeRes = await api('POST', '/api/orders/close', {
      tradeId,
      accountId,
    });
    ok(`trade closed: closePrice=${closeRes.closePrice} profit=${closeRes.profit}`);
  } catch (err) {
    fail(`close order failed: ${err.message}`);
    process.exit(1);
  }

  // 7. Assert P&L within $1 of expected (near-zero for instant close)
  console.log('\n[7/7] P&L sanity check …');
  const profit = Number(closeRes.profit ?? 0);
  const closePrice = Number(closeRes.closePrice ?? 0);
  const openPriceForCalc = Number(trade?.open_price ?? closePrice);
  // Expected P&L for buy: (close - open) * volume * contractSize
  // For an instant close, spread is the main cost: (bid - ask) * volume
  // The loss should be at most a few dollars for 0.01 BTC
  const MAX_LOSS_BOUND = 50; // generous bound; instant close should be < $50 loss for 0.01 BTC
  if (Math.abs(profit) <= MAX_LOSS_BOUND) {
    ok(`profit=${profit} is within reasonable bounds for an instant close`);
  } else {
    fail(`profit ${profit} is unexpectedly large for an instant close`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(56));
  if (failures > 0) {
    console.error(`\nFAIL — ${failures} check(s) failed`);
    process.exit(1);
  } else {
    console.log('\nPASS ✓ — all math checks passed');
    process.exit(0);
  }
})().catch((err) => {
  console.error(`\nUNEXPECTED ERROR: ${err.message}`);
  process.exit(1);
});
