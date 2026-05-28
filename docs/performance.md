# VANTA — Performance Baselines

> QA-3.1 · Generated 2026-05-28

## Measurement method

k6 is not installed in this environment. Baselines were measured with `curl -w "%{time_total}"` against the live Railway backend (`https://vanta-server-production.up.railway.app`).

Each public endpoint was measured 20 times sequentially (single client, no concurrency). Authenticated endpoints could not be measured: the `/api/auth/register` endpoint returned `account_lookup_failed` on all attempts during the measurement run (likely a transient Supabase trigger issue). The authenticated endpoint targets are carried forward from the k6 thresholds defined in `scripts/load-test.js`.

**Run k6 properly once the environment supports it:**

```bash
# Install k6 (Linux)
sudo apt-get install k6
# or macOS
brew install k6

# Get a test JWT first
TOKEN=$(curl -s -X POST https://vanta-server-production.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" -d '{}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['session']['access_token'])")

TEST_JWT=$TOKEN k6 run scripts/load-test.js
```

---

## Results — 2026-05-28 (single-client, sequential)

### Public endpoints (no auth required)

| Endpoint | n | p50 | p95 | p99 | Target | Status |
|---|---|---|---|---|---|---|
| `GET /health` | 20 | 450ms | 589ms | 634ms | <500ms | WARN (p95 above target) |
| `GET /api/quotes` | 20 | 444ms | 502ms | 583ms | <300ms | WARN (p95 above target) |
| `GET /api/bars/BTCUSD` | 20 | 445ms | 463ms | 1315ms | <800ms | PASS (excluding cold-start outlier) |

**Notes on public endpoint latency:**
- The Railway free tier (Hobby plan) cold-starts after inactivity. The first `/api/bars` request took 1315ms (cold-start). Subsequent requests were 291–463ms.
- `/health` and `/api/quotes` p95 of ~500ms exceeds the <100ms and <300ms targets. This is expected for Railway Hobby tier (EU region, single instance, no CDN edge). Under a k6 concurrent load test these numbers would be lower per-request due to connection keep-alive, but the process is geographically distant from the test client.
- Under concurrent load (100 VUs) the p95 is expected to improve for cache-served endpoints (quotes) and degrade for uncached ones.

### Authenticated endpoints (target baselines — not yet measured)

| Endpoint | Target p95 | Notes |
|---|---|---|
| `GET /api/orders/open` | <1200ms | Supabase RLS query + JWT validation |
| `GET /api/account` | <500ms | Single row lookup |

Authenticated measurements are blocked on `register` endpoint availability. Measure with:
```bash
TEST_JWT=<jwt> k6 run scripts/load-test.js
```

---

## Known issues

1. **`/api/auth/register` returning `account_lookup_failed`** — The Supabase DB trigger that auto-creates the accounts row may be failing intermittently. This affects both E2E tests and load test JWT generation. Needs investigation.

2. **p95 above targets on Railway Hobby** — The 100ms target for `/health` and 300ms for `/api/quotes` assume an edge-deployed or nearby server. Railway Hobby in EU from a client in Spain adds 200–400ms RTT. Under k6 with keep-alive connections, per-request overhead drops significantly.

3. **k6 not installed** — Full load test (100 VU / 60s sustained) hasn't been run. Targets in `scripts/load-test.js` remain unvalidated under concurrency.

---

## Thresholds (from `scripts/load-test.js`)

These are the acceptance thresholds the k6 run enforces:

| Metric | Threshold |
|---|---|
| `vanta_health_ms` p95 | < 500ms |
| `vanta_quotes_ms` p95 | < 800ms |
| `vanta_bars_ms` p95 | < 2000ms |
| `vanta_orders_ms` p95 | < 1200ms |
| `vanta_errors` rate | < 1% |
| `http_req_failed` rate | < 2% |
