# STATE -- handoff notes for the next agent

## ✅ 2026-06-19 (auto) — 21.13 DONE (online-users monitor). Pushed to main.
Working tree was clean at start (only the STATE.md/TODO.md handoff). Topmost unchecked items
21.1 (admin audit) and 21.7 (KYC e2e) stay BLOCKED for offline runs (network/visual — each carries
its `>` skip note); 21.11 (credit bucket) needs a product decision (left for the user). 21.13 was
the topmost offline-completable item, as the prior run queued.

**What shipped (commit on main, CI deploys both):**
- `supabase/migrations/031_account_last_seen.sql` (NEW): `accounts.last_seen timestamptz` +
  `accounts_last_seen_idx` (DESC NULLS LAST). **⚠️ NOT YET APPLIED** — the auto-run sandbox can't
  reach the Supabase Management API (egress github-only; `apply-migration.py` → 403 Tunnel). Apply on
  the next network-enabled run: `SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/031_account_last_seen.sql`.
- `server/src/lib/presence.ts` (NEW): `stampLastSeen(userId)` — updates `last_seen=now()` for ALL of a
  user's accounts, throttled in-memory (one write per user per 60s; slot reserved before the await),
  best-effort. Own module so tests (which mock supabase.js) hit it against the in-memory mock. Exports
  `_resetPresence()` for tests.
- `server/src/lib/supabase.ts`: `authUser()` now fires `void stampLastSeen(user.id)` after a token
  verifies — every authed request stamps presence. (NB: creates a runtime-safe circular import
  supabase↔presence; both refs are used inside functions, so ESM live bindings are fine.)
- `server/src/routes/admin.ts`: `GET /api/admin/online?minutes=N` (admin-only; default 5, clamp
  1..1440). Returns accounts seen within the window, newest-first (limit 500), stitched to owner
  `display_name`+`is_admin` by user_id, with `seconds_ago`; + `count`/`window_minutes`/`generated_at`.
- `lib/api.ts`: `api.adminGetOnline(minutes?)`. `app/admin/online.tsx` (NEW): window selector
  (1m/5m/15m/1h) + count card + presence-dot rows. `app/admin/index.tsx`: "Online Now" nav tile (Radio).
- Test helper (ADDITIVE): `DbAccount`+`last_seen`/`type`/`status`, `DbProfile`+`display_name`, seed
  pass-throughs. New `server/test/adminOnline.test.ts` (5 tests).
- Verified offline: client tsc clean, server tsc clean, `npm test` **223 passing** (was 218).

**PENDING LIVE VERIFY (next interactive/network session):** (1) apply migration 031; (2) make an
authed request from an account → it appears in `/admin/online`, then drops off after the window.
Until 031 is applied, `/online` will 500 on live (column missing) and the stamp write is a swallowed
no-op error — applying the migration is the unblock.

### Next pick: **21.15** (report export CSV — backend serialization of the analytics views, no
migration) is the topmost remaining fully-offline-completable item. **21.16** (operator broadcast —
`POST /api/admin/notify`, reuse `notifications` table + `lib/push.ts`) is also offline unit-testable.
21.11 (credit bucket) needs a product decision; 21.12 depends on 21.14; 21.14 (account groups) is a
large design-first item. 21.1 (admin audit) and 21.7 (KYC e2e) stay blocked until a network-enabled
interactive run.

## ✅ 2026-06-19 (auto) — 21.10 DONE (global closed-trades blotter). Pushed to main.
Working tree was clean at start (only the prior STATE.md handoff — diff showed binary because the
committed HEAD copy is stale; the working copy is the latest handoff, which prior runs treat as clean).
Topmost unchecked items 21.1 (admin audit) and 21.7 (KYC e2e) stay BLOCKED for offline runs (need a
network-enabled / visual run — each carries its `>` skip note). 21.10 was the topmost offline-completable
item, as the prior run queued.

**What shipped (commit on main, CI deploys both):**
- `server/src/routes/admin.ts`: new admin-only `GET /api/admin/trades` — filtered global history of
  `status='closed'` trades. Params (all optional): `from`/`to` (ISO bounds on `close_time`, gte/lte),
  `symbol` (exact), `account` (login NUMBER → resolved to account_id; non-numeric = raw id; unknown
  login → empty set, NOT an error), `reason` (exact), `sort` (close_time|open_time|profit|volume|symbol,
  default close_time), `dir` (asc|desc, default desc), `limit` (1–500, default 100), `offset` (≥0).
  Rows carry login via `accounts!inner` embed + `duration_seconds` (close−open). `totals`
  (count, volume_lots, gross_profit, gross_loss, net_profit=realized_client_pnl, realized_house_pnl,
  wins, win_rate) computed over the **FULL filtered set** (not the page) so they reconcile against raw
  `trades`; `trades` is the sorted page slice, `count` is the full filtered count.
- `lib/api.ts`: `api.adminGetTrades(params)` typed helper.
- `app/admin/trades.tsx` (new): filter bar (symbol/account/reason + from/to + Apply) + totals card +
  sort tabs (asc/desc toggle) + per-row blotter + Prev/Next pagination (50/page).
- `app/admin/index.tsx`: "Trade History" nav tile (History icon, newly imported).
- Test helper (ADDITIVE): `supabaseMock` Query gained `.lte()`; `seed.trade` now carries `close_price`.
  New `server/test/adminTradesBlotter.test.ts` (10 tests: 403 gating; closed-only + totals
  reconciliation; symbol/account-login/reason filters; unknown-login→empty; close_time from/to range;
  limit/offset paging w/ full-set totals; profit asc sort).
- Verified offline: client tsc clean, server tsc clean, `npm test` **218 passing** (was 208). No migration.

**⚠️ LESSON RE-CONFIRMED THIS RUN:** editing `server/test/helpers/supabaseMock.ts` with the Edit tool
TRUNCATED the file (esbuild "Expected } but found end of file"). Restored via
`git show HEAD:<path> > /tmp/x` then re-applied changes with a python here-doc. **Use bash/python for
ALL `.ts`/`.tsx` edits — `.md` only for the Edit/Write tools.** (git checkout was blocked by a stale
`.git/index.lock` the mount can't `rm` — see the WSL wall recipe below.)

**PENDING LIVE VERIFY (next interactive session):** on the live DB, filtering `/api/admin/trades` by
symbol/account/date narrows the set; totals reconcile against raw closed `trades` for a known account.

### Next pick: **21.13** (online-users monitor — migration `0XX_account_last_seen.sql` + throttled
last_seen stamp in auth middleware + admin panel) or **21.15** (report export CSV — backend
serialization of the analytics views) are the topmost remaining offline-completable items. 21.11
(credit bucket) is a migration but needs a product decision (only build if a credit/bonus concept is
wanted) — left for the user. 21.16 (operator broadcast) is offline-unit-testable backend. 21.1 (admin
audit) and 21.7 (KYC e2e) stay blocked until a network-enabled interactive run.

## ✅ 2026-06-18 (auto) — 21.9 DONE (admin account list equity + margin-level columns). Pushed to main.
Working tree was clean at start (only the prior STATE.md handoff). Topmost unchecked items 21.1
(admin audit) and 21.7 (KYC e2e) both stay BLOCKED for offline runs (need a network-enabled /
visual run — each already carries its `>` skip note). 21.9 was the topmost offline-completable item,
as the prior run queued.

**What shipped (commit `0fce4d4` on main, CI deploys both):**
- `server/src/routes/admin.ts`: new `equityByAccount(rawAccts)` helper — one batched
  `status='open'` trades query (`.in('account_id', …).eq('status','open')`), computes per account
  live `equity` (= balance + Σ unrealized via `getMid`/`calculatePnL`, fallback `open_price`) and
  `margin_level_pct` (= `equity / margin_used * 100`, 1dp; **null** when `margin_used` is 0) — same
  definitions as `/analytics/accounts`. `GET /api/admin/users` enriches every returned account with
  these two fields on BOTH paths: `attachAccounts` (no-search + email-search) and the login-number
  search path. Both account `select`s now also pull `margin_used`.
- `lib/api.ts`: `AdminUser.accounts[]` gained optional `equity` / `margin_level_pct`.
- `app/admin/users.tsx`: `UserCard` shows a 2nd line "Equity $X · ML NN%", colour-coded
  (red <100%, amber <200%, green ≥200%, em-dash when null). Added `fmtMarginLevel`/`marginLevelColor`.
- `server/test/adminUsersEquity.test.ts` (new, 5 tests): 403 unauth/non-admin; equity+ML
  cross-checked against `/analytics/accounts` for the same account (the acceptance criterion);
  null-margin → null ML; login-number search path enriched.
- Verified offline: client tsc clean, server tsc clean, `npm test` **208 passing** (was 203).
  No migration this run.

**PENDING LIVE VERIFY (next interactive session):** on the live DB, an account's `equity` /
`margin_level_pct` on the user-search list match its row in the Accounts analytics leaderboard.

### Next pick: **21.10** (globa