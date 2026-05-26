# VANTA — Testing TODO

> **For the cowork agent.** Same rules as TODO.md: pick topmost unchecked item, implement fully, mark `[x]`, push, move on. Never take more than ~60 min per item. Push to main triggers GH Actions deploy automatically.

---

## How to work this list

Same precheck as TODO.md before starting any item:

```bash
cd /c/Claude/vanta
bash scripts/git-precheck.sh
git status && git branch --show-current
npx --no-install tsc --noEmit
cd server && npx --no-install tsc --noEmit && cd ..
curl -sf https://vanta-server-production.up.railway.app/health | grep -q '"ok":true'
```

**Existing test infrastructure:**
- `server/test/*.test.ts` — 32 hermetic vitest unit tests (auth, orders, rounds, robots). Run: `cd server && npm test`
- `e2e/smoke.spec.ts` — Playwright E2E against live Vercel URL. Run: `npx playwright test`
- `scripts/load-test.js` — k6 load test. Run: `k6 run scripts/load-test.js`
- `.github/workflows/e2e.yml` — E2E runs in CI after every deploy
- `.github/workflows/backup-check.yml` — daily Supabase backup check

---

## Phase QA-1 — Fix & harden E2E smoke test

### QA-1.1 Make smoke test reliably green
- [ ] **File:** `e2e/smoke.spec.ts`
- **Problem:** Test has broken 4 times in a row on selector issues (`/auth/login` URL, strict-mode button clash, `Pressable` role lookup). Each fix reveals the next fragile selector.
- **What:** Audit every `waitForURL`, `getByText`, `getByRole`, `locator` in the test. Replace fragile selectors with `data-testid` attributes:
  - Add `testID="login-account-input"` to account number input in `app/(auth)/login.tsx`
  - Add `testID="login-password-input"` to password input
  - Add `testID="login-submit"` to the Sign In Pressable
  - Add `testID="buy-button"` to the Buy button in `components/pro/OrderEntry.tsx`
  - Add `testID="close-trade-button"` to close button in `components/pro/TradeBook.tsx` (already has `accessibilityLabel`, add `testID` too)
  - Update smoke test to use `page.locator('[data-testid="login-submit"]')` etc.
- **Acceptance:** `npx playwright test` passes locally. CI goes green and stays green for 3 consecutive pushes.

### QA-1.2 Add E2E test for Quick Mode round
- [ ] **File:** `e2e/quick-mode.spec.ts` (new)
- **What:** Register fresh account → navigate to Quick tab → place a $10 BTC Up 60s round → verify round appears in active list with countdown → wait for settlement (mock or fast-forward if possible; if not, verify the round row exists and has correct data). Sign out.
- **Acceptance:** Test passes in CI. Covers the binary rounds flow end-to-end.

### QA-1.3 Add E2E test for pending limit order
- [ ] **File:** `e2e/limit-order.spec.ts` (new)
- **What:** Register → sign in → switch to Limit tab in OrderEntry → place a BTC buy-limit 5% below current price (guaranteed not to fill immediately) → verify it appears in the Pending tab of TradeBook → cancel it → verify it disappears → sign out.
- **Acceptance:** Test passes in CI. Covers the pending orders flow.

---

## Phase QA-2 — Expand server unit tests

### QA-2.1 P&L and margin calculation tests
- [ ] **File:** `server/test/calculations.test.ts` (new)
- **What:** Pure unit tests for `lib/contracts.ts` and `lib/margin.ts`. No mocks needed — pure math.
  - `contractSize('EURUSD')` = 100000, `contractSize('BTCUSD')` = 1, `contractSize('XAUUSD')` = 100
  - `calculatePnL('buy', 0.1, 1.1000, 1.1050, 'EURUSD')` = +50 USD
  - `calculatePnL('sell', 0.1, 1.1050, 1.1000, 'EURUSD')` = +50 USD
  - `notionalUSD(0.1, 76000, 'BTCUSD')` = 7600
  - `pipSizeFor('EURUSD')` = 0.0001, `pipSizeFor('BTCUSD')` = 1
  - `pipValueFor(0.1, 'EURUSD')` = 10, `pipValueFor(0.01, 'BTCUSD')` = 0.01
  - Margin: 0.1 lots EURUSD at 1.1000 with 100× leverage = $110 required margin
  - Insufficient margin: balance $100, required $200 → reject
- **Acceptance:** `cd server && npm test` covers all cases above. 0 failures.

### QA-2.2 Risk worker unit tests (SL/TP/stop-out)
- [ ] **File:** `server/test/risk.test.ts` (new)
- **What:** Test the risk worker logic in isolation using the existing mock infrastructure.
  - Buy trade with SL=74000, price ticks to 73999 → trade auto-closes with reason='stopout'
  - Buy trade with TP=78000, price ticks to 78001 → trade auto-closes with reason='takeprofit'
  - Sell trade with SL=78000, price ticks to 78001 → auto-closes
  - Trailing stop: trail_distance=500, price rises from 75k to 78k → SL ratchets to 77500 → price dips to 77400 → auto-close
  - Stop-out: equity < 0 → worst losing trade auto-closed
- **Acceptance:** All risk scenarios pass without a live Supabase connection.

### QA-2.3 Orders trigger worker tests (pending → open)
- [ ] **File:** `server/test/ordersTrigger.test.ts` (new)
- **What:** Test pending order fill logic.
  - Buy-limit at 74000, price ticks to 74000 → status flips to 'open'
  - Buy-limit at 74000, price ticks to 74100 (above) → stays pending
  - Sell-stop at 78000, price ticks to 77999 (below) → flips to 'open'
  - Stop-limit: trigger=76000, limit=76100, price hits 76000 → creates limit order at 76100
  - OCO group: two pending orders linked, one fills → other auto-cancelled
- **Acceptance:** All trigger scenarios pass hermetically.

### QA-2.4 Copy trading mirror logic tests
- [ ] **File:** `server/test/copyTrading.test.ts` (new)
- **What:** Test that when a leader opens a trade, followers get mirrored trades at correct allocation.
  - Leader opens 0.1 BTC buy. Follower has allocation_pct=50 → follower gets 0.05 BTC buy.
  - Follower has insufficient margin → mirror skipped, no error thrown.
  - Leader closes trade → follower's mirrored trade also closes.
  - allocation_pct=100 → follower mirrors at exactly same volume.
- **Acceptance:** All copy scenarios pass hermetically.

---

## Phase QA-3 — Performance & load

### QA-3.1 Run load test and document p95 baselines
- [ ] **File:** `docs/performance.md` (new), `scripts/load-test.js` (minor updates if needed)
- **What:** Run `k6 run scripts/load-test.js` against the live Railway backend with `TEST_JWT` set. Record actual p95 numbers for:
  - `/health` p95 target: <100ms
  - `/api/quotes` p95 target: <300ms
  - `/api/bars/BTCUSD` p95 target: <800ms
  - `/api/orders/open` p95 target: <1200ms
  - `/api/account` p95 target: <500ms
  Document the results in `docs/performance.md`. If any threshold fails, note it as a known issue.
- **Note:** Requires `TEST_JWT` env var (a valid Supabase JWT from a test account). Get one from `server/.env` test section or generate via the register endpoint.
- **Acceptance:** `docs/performance.md` exists with real numbers from a live run.

### QA-3.2 WebSocket price feed stability test
- [ ] **File:** `scripts/ws-stability-test.js` (new)
- **What:** Node.js script that connects to `wss://vanta-server-production.up.railway.app` (or the WS endpoint), subscribes to BTCUSD, and:
  - Measures time between price ticks
  - Detects gaps > 10s (stale feed)
  - Runs for 5 minutes
  - Outputs: tick count, avg interval, max gap, any reconnect events
- **Acceptance:** Script runs, outputs stats. Max gap < 10s for BTCUSD over 5 min.

---

## Phase QA-4 — Security & correctness

### QA-4.1 Auth boundary tests
- [ ] **File:** `server/test/auth-boundaries.test.ts` (new)
- **What:** Verify RLS and auth guards hold:
  - Unauthenticated request to `/api/orders/open` → 401
  - User A's JWT cannot read User B's trades via `/api/orders`
  - User A cannot close User B's trade via `/api/orders/close`
  - Admin endpoints (`/api/admin/*`) reject non-admin users with 403
  - Expired JWT → 401 (not 500)
  - Malformed JWT → 401 (not 500)
- **Acceptance:** All boundary checks return the correct HTTP status in hermetic tests.

### QA-4.2 Input validation fuzz tests
- [ ] **File:** `server/test/validation.test.ts` (new)
- **What:** Feed bad inputs to order endpoints and verify they're rejected cleanly:
  - `volume: -1` → 400
  - `volume: 0` → 400
  - `volume: 999999999` → 400 (exceeds max)
  - `symbol: "'; DROP TABLE trades; --"` → 400
  - `symbol: ""` → 400
  - `side: "sideways"` → 400
  - `stop_loss: "banana"` → 400
  - Missing required fields → 400 with meaningful error
- **Acceptance:** All bad inputs return 400, no 500s, no SQL injection surface.

### QA-4.3 Rate limit tests
- [ ] **File:** `server/test/rateLimit.test.ts` (new)
- **What:** Verify rate limiting on auth endpoints:
  - POST `/api/auth/login` 11 times in quick succession → 11th returns 429
  - POST `/api/auth/register` 6 times → 6th returns 429
  - After rate limit window resets → requests succeed again
- **Acceptance:** Rate limit kicks in at documented thresholds, returns 429 with `Retry-After` header.

---

## Phase QA-5 — Monitoring & alerting

### QA-5.1 Better Stack uptime monitoring — NEEDS USER ACTION
- [ ] **Externally gated:** User must sign up at https://betterstack.com/sign-up (free tier, no card).
  Once signed up, add two monitors:
  1. `https://vanta-server-production.up.railway.app/health` — every 3 min, keyword check `"ok":true`
  2. `https://vanta-jade.vercel.app` — every 3 min, HTTP 200 check
  Alert channel: email.
- **Acceptance:** Both monitors green in Better Stack dashboard. Take Railway down → email arrives within 5 min.

### QA-5.2 Sentry alert thresholds
- [ ] **File:** Sentry dashboard config (no code change)
- **What:** In Sentry dashboard (https://sentry.io), configure:
  - Alert: any new error → email immediately
  - Alert: error rate > 5/min on any route → email
  - Alert: p95 response time > 3s on `/api/orders/open` → email
  - Performance: set apdex threshold to 500ms
- **Acceptance:** Alerts configured in Sentry. Trigger a test error → email received.

### QA-5.3 Admin health dashboard improvements
- [ ] **File:** `app/admin/perf.tsx` (extend), `server/src/middleware/timing.ts` (extend)
- **What:** Add to the existing perf dashboard:
  - Worker health: last tick time for risk worker, orders trigger worker, rounds worker (are they running?)
  - Price feed health: last tick time per symbol, count of stale symbols (>10s since last tick)
  - WebSocket connections: current count
  - Error count in last 5 min (from Sentry or in-process counter)
- **Acceptance:** `/admin/perf` shows worker + feed health. Stale symbols highlighted in red.

---

## Phase QA-6 — Regression safety net

### QA-6.1 Smoke test for trade math on live data
- [ ] **File:** `scripts/math-check.js` (new)
- **What:** Node.js script (no deps beyond `node-fetch`) that:
  1. Calls `/api/quotes` to get live BTCUSD price
  2. Calculates expected notional for 0.01 BTC at that price
  3. Calls `/api/orders/open` with a test JWT (0.01 BTC buy)
  4. Calls `/api/orders` to read back the opened trade
  5. Verifies `open_price` is within 1% of the quote, `margin_used` ≈ notional/leverage
  6. Closes the trade immediately
  7. Verifies closed P&L is within $1 of expected (near-zero for instant close)
  Exits 1 if any check fails.
- **Run:** `TEST_JWT=... node scripts/math-check.js`
- **Acceptance:** Script passes on the live backend. Math is correct end-to-end.

### QA-6.2 Schema drift detector
- [ ] **File:** `scripts/check-schema.py` (new)
- **What:** Python script that calls the Supabase Management API and verifies:
  - All migration tables exist: `trades`, `accounts`, `profiles`, `binary_rounds`, `copy_relationships`, `chart_drawings`, `price_alerts`, `robot_runs`, `kyc_documents`, `kyc_submissions`
  - Key columns exist: `trades.order_type`, `trades.trigger_price`, `trades.trail_distance`, `trades.notes`, `accounts.hedging_enabled`
  - All RLS policies are enabled on the above tables
  Exits 1 if anything is missing.
- **Run:** `SUPABASE_PAT=... python scripts/check-schema.py`
- **Acceptance:** Script passes against the live DB. Add it to `.github/workflows/backup-check.yml` as a second step.
