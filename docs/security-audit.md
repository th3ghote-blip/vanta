# VANTA — Backend Security Audit (TODO 18.12)

**Date:** 2026-06-03
**Scope:** `server/src/routes/orders.ts`, `server/src/routes/auth.ts`, `server/src/routes/admin.ts`, `server/src/routes/transactions.ts`, `server/src/lib/margin.ts`, `server/src/lib/supabase.ts`, `server/src/index.ts`, `server/src/middleware/`
**Method:** Static code review of every backend route plus the auth/margin libraries. Hermetic test suite (`cd server && npm test`, 160 tests) re-run after fixes. No live-DB or network access in the sandbox; runtime acceptance (concurrent-request races) verified by code reasoning + the existing CAS-guard test patterns.

## Summary

Two issues were found and **fixed this session**: a double-close P&L double-credit race (HIGH) and missing rate limits on two high-value endpoints (MEDIUM). All other checks in the 18.12 checklist passed without code changes. One defense-in-depth observation about multiple pending withdrawals is noted but not a live exploit (admin approval re-checks the balance).

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Double-close race → P&L credited twice, margin released twice | HIGH | **Fixed** |
| 2 | No rate limit on `POST /api/orders/open` and `POST /api/transactions/withdraw` | MEDIUM | **Fixed** |
| 3 | Margin double-spend on concurrent opens | — | Pass (already mitigated) |
| 4 | Close same trade twice (partial path) | LOW | Pass (CAS guard present) |
| 5 | Negative / zero volume orders | — | Pass |
| 6 | Client-supplied price trusted | — | Pass |
| 7 | Admin endpoint exposure | — | Pass |
| 8 | JWT expiry not enforced | — | Pass |
| 9 | Withdraw more than balance | — | Pass |
| 10 | Multiple pending withdrawals exceed balance | INFO | Mitigated by admin re-check; recommendation noted |
| 11 | Hardcoded secrets | — | Pass |

---

## Findings fixed this session

### 1. Double-close race — P&L double-credit (HIGH) — FIXED

**File:** `server/src/routes/orders.ts`, full-close path.

**Problem.** The handler first `SELECT`s the trade filtered on `status='open'`, then later issued the closing `UPDATE` with only `.eq('id', tradeId)` — **no `status='open'` guard on the write**. Two concurrent `POST /api/orders/close` requests for the same trade could both pass the initial `status='open'` read before either wrote. Both would then run the `UPDATE` and, critically, both would call `apply_trade_pnl` and `releaseMargin`. Result: the realized P&L is **credited to the account balance twice** and the reserved margin is **released twice** — a direct balance-inflation exploit by double-tapping / racing the close endpoint.

The partial-close, modify, and pending-cancel paths in the same file already carried a compare-and-set (`.eq('status', 'open')` / `.eq('status', 'pending')`) guard on their writes; only the full-close path was missing it.

**Fix.** The closing `UPDATE` now includes `.eq('status', 'open').select('id')`, turning it into an atomic compare-and-set: only the single request that actually transitions the row `open → closed` gets a row back. If `closedRows` is empty, a concurrent request already closed the trade, so the handler returns `409 already_closed` **before** applying P&L or releasing margin. This guarantees the settlement side effects run exactly once per close.

### 2. Missing rate limits on high-value endpoints (MEDIUM) — FIXED

**Files:** `server/src/routes/orders.ts` (`/open`), `server/src/routes/transactions.ts` (`/withdraw`).

**Problem.** Rate limiting is registered globally as opt-in (`@fastify/rate-limit` with `global: false`); routes must declare `config.rateLimit` to be covered. Only the two auth routes (`/register`, `/login`) opted in. The highest-value write endpoints — order opening and withdrawal requests — had **no rate limit**, leaving them open to scripted abuse / request flooding.

**Fix.** Added per-IP limits matching the existing auth-route pattern:
- `POST /api/orders/open` → `max: 30, timeWindow: '1 minute'` (generous for manual trading, blocks scripts).
- `POST /api/transactions/withdraw` → `max: 10, timeWindow: '1 minute'`.

There is a dedicated `rateLimit.test.ts` (4 tests) that continues to pass.

---

## Checks that passed (no change needed)

**3. Margin double-spend on concurrent opens — Pass.** `reserveMargin` (`server/src/lib/margin.ts`) delegates to an atomic Postgres RPC `reserve_margin` that re-validates `free_margin >= amount` *inside* the database function, so two concurrent opens cannot both draw the same free margin. The fallback path (when the RPC is absent) uses a single conditional `UPDATE ... .gte('free_margin', amount)`, which is also atomic at the row level and surfaces a `race` result the caller maps to `insufficient_margin`. Order opening reserves margin *before* inserting the trade and rolls the reservation back on insert failure.

**4. Close same trade twice (partial path) — Pass.** The partial-close `UPDATE` already carries `.eq('status', 'open')`. The full-close gap is finding #1 (now fixed).

**5. Negative / zero volume — Pass.** All sizes are validated by Zod before any DB work: `volume: z.number().positive()` and `closeVolume: z.number().positive().optional()` in orders; `amount: z.number().positive()` for deposits and withdrawals. Non-positive values are rejected with `400 invalid_input`.

**6. Client-supplied price trusted — Pass.** Open and close prices are always taken server-side from the quote cache (`getQuote(...)` → `quote.ask` / `quote.bid`). The open schema has no `openPrice`/`closePrice` field; a client cannot inject a fill price. Pending-order trigger/limit prices are user-supplied by design but are validated for directional sanity against the live quote and only ever become the fill price the user explicitly chose.

**7. Admin endpoint exposure — Pass.** Every one of the 13 handlers in `admin.ts` calls `authAdmin(req.headers.authorization)` as its first statement and returns `403` when the caller is not an admin (`profiles.is_admin`). Verified: 13 route handlers, 13 `authAdmin` guards, none unguarded. The impersonation route additionally refuses to impersonate another admin.

**8. JWT expiry enforced — Pass.** `authUser` (`server/src/lib/supabase.ts`) verifies tokens by calling Supabase's `GET /auth/v1/user` with the bearer token. Supabase returns a non-2xx for expired/invalid tokens, so `authUser` returns `null` and the route replies `401`. Expiry is enforced by the auth server, not trusted from the client. (`auth-boundaries.test.ts` covers rejection of bad tokens.)

**9. Withdraw more than balance — Pass.** `POST /api/transactions/withdraw` checks `body.amount > Number(account.balance)` server-side and returns `400 insufficient_balance`; it also requires an `approved` KYC submission before creating the pending row.

**11. Hardcoded secrets — Pass.** `grep -rniE "sk_|secret|password|apikey|api_key" server/src --include="*.ts"` surfaces only environment-variable reads (`process.env.TWELVE_DATA_API_KEY`, `process.env.SUPABASE_SERVICE_ROLE_KEY`) used in request headers/URLs. No literal credential is committed. The literal-assignment scan (`= '...'`) returned nothing.

---

## Observation / recommendation (not fixed)

**10. Multiple pending withdrawals (defense-in-depth).** A withdrawal does not decrement the balance at request time — funds move only on admin approval, and the approval path re-checks sufficient balance before debiting. So a user could submit several pending withdrawals that each individually pass the `amount <= balance` check; the admin gate prevents over-payment because each approval re-validates. This is acceptable today (manual approval is the control). If withdrawals are ever auto-approved, add a server-side reservation (sum of pending withdrawals counted against balance) or a per-account in-flight lock. Left unchanged to keep this task within scope and migration-free.

## Verification performed

- `cd server && npx tsc --noEmit` → clean.
- `npx tsc --noEmit` (client) → clean.
- `cd server && npm test` → **160 passed** (includes `orders.test.ts` 50 tests and `rateLimit.test.ts` 4 tests).
- Static re-read of the patched close path confirms P&L/margin side effects are now gated behind the `409 already_closed` early-return.
