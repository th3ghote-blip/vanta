# STATE -- handoff notes for the next agent

## ✅ 2026-06-19 (auto) — 21.15 DONE (analytics CSV export). Pushed to main.
Working tree was clean at start (only the STATE.md/TODO.md handoff). 21.15 was the topmost
offline-completable item: 21.11 (credit bucket) needs a product decision; 21.12 depends on 21.14;
21.14 (account groups) is a large design-first item; 21.1 (admin audit) and 21.7 (KYC e2e) stay
BLOCKED for offline runs. So 21.15 was picked, as the prior run queued.

**What shipped (commit on main, CI deploys both):**
- `server/src/lib/csv.ts` (NEW): dependency-free RFC-4180 serializer — `toCsv(columns, rows)`,
  `csvCell` (quotes on `, " CR LF`, null/NaN→empty, CRLF lines), `csvFilename(base)` →
  `vanta-<base>-<YYYY-MM-DD>.csv` (sanitized).
- `server/src/routes/admin.ts`: the three analytics endpoints now accept `?format=csv`. The CSV path
  serializes the SAME computed payload the JSON path returns (so rows reconcile with on-screen data),
  returns `text/csv; charset=utf-8` + `Content-Disposition: attachment`. Module-scope helpers
  `wantsCsv`/`sendCsv` + column defs `BY_SYMBOL_COLUMNS` (15), `OVERVIEW_COLUMNS` (7), `ACCOUNTS_COLUMNS`
  (16). by-symbol exports `symbols`; overview exports daily `series`; accounts exports the page slice
  `limited` (matches what the screen shows).
- `lib/api.ts`: `requestCsv(path)` (auth-injected fetch → `{filename,text}`) + `adminAnalyticsBySymbolCsv`
  / `adminAnalyticsOverviewCsv` / `adminAnalyticsAccountsCsv`.
- `app/admin/analytics.tsx`: web-only `ExportCsvButton` (Download icon, Blob download) on each of the
  three views; renders null on native.
- Tests: `server/test/csv.test.ts` (6) + `server/test/adminAnalyticsExport.test.ts` (5, cell-for-cell
  JSON↔CSV reconciliation + headers + dated filename). Verified offline: client tsc clean, server tsc
  clean, `npm test` **234 passing** (was 223). No migration.

**PENDING LIVE VERIFY (next interactive session):** on live, each analytics view's "Export CSV" button
downloads a file whose rows match the on-screen table. (NB carried over from 21.13: **migration 031
still NOT applied** — apply on the next network-enabled run, see entry below.)

### Next pick: **21.16** (operator broadcast — `POST /api/admin/notify`, reuse `notifications` table +
`lib/push.ts`) is the topmost remaining fully-offline unit-testable item. 21.11 (credit bucket) needs a
product decision; 21.12 depends on 21.14; 21.14 (account groups) is a large design-first item; 21.1
(admin audit) and 21.7 (KYC e2e) stay blocked until a network-enabled/visual interactive run.

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

### Next pick: **21.13** (online-users mo