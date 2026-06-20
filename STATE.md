# STATE -- handoff notes for the next agent

## ⏸️ 2026-06-20 (auto, run 2) — NO ITEM PICKED. Offline queue still DRAINED (unchanged since c6ce3ae).
HEAD = `c6ce3ae`, branch up to date with origin/main. Working tree verified byte-for-byte identical to HEAD
(`diff` of every file git-status flagged → all MATCH; the status/`diff --cached` "uncommitted changes" are the
SAME stale-index artifact from the stuck 0-byte `.git/index.lock` dated 2026-06-18 — NOT a user mid-edit, safe to run).

**Re-triaged every unchecked non-PARKED `- [ ]`. Still none offline-completable; nothing changed since last run:**
- **R.7** (Better-Stack uptime) — externally gated (betterstack.com signup + live URL + live takedown to verify).
- **18.2** (chart drawing) — visual + persistence + `chart_drawings` round-trip; needs screenshot run.
- **18.3** (light/dark refactor) — ~58-component mechanical refactor, acceptance is VISUAL; needs preview. Split 18.3a–g already in file.
- **18.7** (AI assistant) — needs Claude API key + live DB to verify streamed answers; large chat UI.
- **18.8** (MT4 manager panel) — oversized (~8 pages + ~10 routes); needs splitting into sub-items first.
- **21.1** (admin route audit) — acceptance = live 200 on every `/api/admin/*`; needs network (Railway/Supabase).
- **21.7** (KYC e2e) — live/visual verification.
- **21.11** (credit bucket) — "(optional)"; a PRODUCT/financial decision for the owner, not an autonomous pick.
- **21.12** (per-account stop-out) — "(Depends on 21.14.)"; dependency unmet → skip.
- **21.14** (account groups) — large design-first mini-phase; partly network/visual. Needs scoping first.
- **PARKED** (5.3 / 8.1 / 9.3 / 9.4 / 10.1–10.6 / 20.2) — externally gated; resume only on explicit user say-so.

**Network empirically re-confirmed this run** (not inherited): `git ls-remote origin` OK (github reachable, push works);
`curl https://api.supabase.com` → 000 UNREACHABLE; `curl …railway.app/health` → 000 UNREACHABLE. So the egress is
github-only as the deploy-model note says — the manual's "apply-migration.py IS reachable" line is WRONG for this sandbox.

**This run shipped:** docs/handoff only — NO code, NO migration, NO deploy. Just this STATE entry (committed via the
GIT_INDEX_FILE workaround; `.git/index.lock` is still stuck). TODO.md unchanged (every blocked item already carries its `>` note).

**⚠️ ACTION FOR THE USER — auto-runs have no safe offline work left.** To unblock, ONE of: (a) an **interactive/
network-enabled run** (unblocks 18.2, 18.7, 21.1, 21.7, the 18.3 visual refactor, AND lets us finally apply **migration
031**); (b) a **product decision** on 21.11 (credit/bonus bucket?); (c) **scoping** 21.14 (account groups) or splitting
18.8 into sub-items; or (d) unparking an external item (domain, mobile builds, Better-Stack). Until then, no auto pick exists.

**CARRIED-OVER PENDING (unchanged):** migration **031** (`031_account_last_seen.sql`) still NOT applied — sandbox can't
reach Supabase. Apply on the next network run: `SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/031_account_last_seen.sql`.
Until then `/api/admin/online` 500s on live and `last_seen` writes are swallowed no-ops. The 0-byte `.git/index.lock`
(2026-06-18) is still STUCK — use `GIT_INDEX_FILE=/tmp/<idx> git read-tree HEAD && … add && … commit`; the `Edit`
file-tool can TRUNCATE through the sync layer, so prefer Write/python + verify `wc -l`.

**⚠️ NEW LOCK + COMMIT WORKAROUND (this run):** a SECOND stale lock `.git/refs/heads/main.lock` (41 bytes, 2026-06-20) is now ALSO stuck and un-removable — so BOTH `git commit` and `git update-ref` fail. Workaround that WORKED: build the commit with plumbing then push by sha — `GIT_INDEX_FILE=/tmp/i git read-tree HEAD && GIT_INDEX_FILE=/tmp/i git add <file> && TREE=$(GIT_INDEX_FILE=/tmp/i git write-tree) && C=$(git commit-tree $TREE -p HEAD -m '…') && git push origin $C:refs/heads/main`. NB: local `refs/heads/main` could NOT be advanced (still at c6ce3ae), so **local main now TRAILS origin/main by 1** (origin=41c5806). Next run: `git fetch` and treat origin as truth; the on-disk STATE.md/TODO.md ARE current. Object writes log a benign `unable to unlink tmp_obj` sync-layer warning but succeed.

## ⏸️ 2026-06-20 (auto) — NO ITEM PICKED. Offline-completable queue is DRAINED.
Working tree was byte-for-byte identical to HEAD at start (`diff` confirmed; the git `status`/`diff --cached`
"uncommitted changes" are purely the STALE-INDEX artifact from the stuck `.git/index.lock` dated 2026-06-18 —
the staged diff *reverts* 22.1 and the unstaged diff *re-adds* it; they cancel). 22.1 is genuinely committed
(`c8b3d71`) and pushed; branch up to date with origin/main. So this was NOT a user-mid-edit STOP — safe to run.

**Triaged every unchecked `- [ ]` in TODO.md. None is offline-completable this run:**
- **R.7** (topmost, Better-Stack uptime) — externally gated: needs a betterstack.com signup + a live URL + live takedown to verify. Added a `>` SKIPPED note under it this run.
- **5.3 / 8.1 / 9.3 / 9.4 / 10.1–10.6 / 20.2** — PARKED (externally gated: Sumsub sales call, OANDA setup, Apple/Google dev accounts, domain purchase, Resend email). Resume only on explicit user say-so.
- **18.2** (chart drawing) / **18.7** (AI assistant) / **21.1** (admin route audit) / **21.7** (KYC e2e) — BLOCKED for offline: each needs network (Claude API / live Railway+Supabase) and/or visual confirmation. Each carries its `>` note.
- **18.3** (light/dark mode) — large ~58-component mechanical refactor whose acceptance is VISUAL ("a missed token = broken render"); unsafe without a screenshot/preview run. Split plan 18.3a–g already in the file.
- **18.8** (MT4 manager panel) — oversized (~8 pages + ~10 routes); needs splitting into sub-items first.
- **21.11** (non-withdrawable credit bucket) — marked "(optional) … only build if a credit/bonus concept is wanted": a PRODUCT/financial decision for the owner, not an autonomous pick.
- **21.12** (per-account stop-out level) — explicitly "(Depends on 21.14.)"; dependency unmet → skip per the operating manual.
- **21.14** (account groups) — large, design-first mini-phase; partly network/visual. Needs scoping before an auto-run.

**This run shipped (docs/handoff only — NO code, NO migration, NO deploy):** a `>` SKIPPED note under R.7 in
TODO.md + this STATE entry. Committed via the GIT_INDEX_FILE workaround (the `.git/index.lock` is still stuck).

**⚠️ ACTION FOR THE USER:** the clean offline auto-run queue is now exhausted. To unblock further auto progress,
ONE of these is needed: (a) an **interactive/network-enabled run** (lets 18.2, 18.7, 21.1, 21.7, and the 18.3
visual refactor proceed, AND lets us finally apply **migration 031**); (b) a **product decision** on 21.11 (do we
want a credit/bonus bucket?); (c) **scoping** 21.14 (account groups) into sub-items; or (d) unparking an external
item (domain, mobile builds, etc.). Until then, auto-runs have no safe offline work to pick.

**CARRIED-OVER PENDING (unchanged):** migration **031** (`031_account_last_seen.sql`) still NOT applied — the
sandbox can't reach the Supabase Management API (egress github-only). Apply on the next network run:
`SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/031_account_last_seen.sql`. Until then
`/api/admin/online` 500s on live and `last_seen` writes are swallowed no-ops. Also the usual `.git/index.lock`
(0-byte, 2026-06-18) is still STUCK — use the `GIT_INDEX_FILE=/tmp/<idx> git read-tree HEAD && … add && … commit`
workaround; the `Edit` file-tool can TRUNCATE files through the sync layer, so prefer Write/python + verify `wc -l`.

## ✅ 2026-06-20 (auto) — 22.1 DONE (expanded achievements catalogue). Pushed to main.
Working tree was clean at start (after clearing a STALE `.git/index.lock` dated 2026-06-18 that the
sandbox could NOT `rm` — sync-layer owned; used the precheck's `GIT_INDEX_FILE` workaround to commit).
22.1 was the recommended next offline pick: 21.1 (admin audit) and 21.7 (KYC e2e) remain BLOCKED for
offline runs (network/visual, each carries its `>` skip note); 21.11 (credit bucket) needs a product
decision; 21.12 depends on 21.14; 21.14 (account groups) is a large design-first item.

**What shipped (commit on main, CI deploys both):**
- `server/src/lib/achievements.ts`: +15 badge codes (total 22). New `checkX` helpers (each fetches rows and
  reduces in JS so the in-memory test mock exercises the same path — no `.gt()` needed):
  `checkVolumeMilestones` (volume_1/10/100, Σ lots over open+closed), `checkTradeCountMilestones`
  (trades_10/50/100), `checkProfitMilestones` (first_green + profit_100/1000 over CLOSED profit; open trades
  excluded), `checkGain10pct` (balance ≥ $11k), `checkTakeProfitPlanner` (≥10 closed w/ take_profit),
  `checkDiversified` (≥5 distinct symbols), `checkRobotMaster` (≥10 robots). All idempotent via `awardAchievement`.
- Wiring (fire-and-forget, mirrors existing): `orders.ts` open block → volume/trade-count/diversified;
  close block (Promise.all) → profit/tp-planner/gain_10pct. `robots.ts` create → robot_master.
  `auth.ts` login streak → three_day_streak (≥3) + thirty_day_streak (≥30) alongside the existing 7-day.
- NO migration (codes are free-text in the `achievements` table). NO client change: `app/(tabs)/profile.tsx`
  renders one tile per `ACHIEVEMENT_META` entry from `GET /api/achievements`, so new badges show automatically.
- Tests: new `server/test/achievements.test.ts` (13). IMPORTANT FIX: the routes now call the new helpers, so the
  achievements `vi.mock` in `orders/robots/auth/auth-boundaries/copyTrading/rounds` tests had to gain the 7 new fns
  — otherwise `void checkVolumeMilestones(...)` is `undefined(...)` → synchronous TypeError → the open/close route
  500s (this is what broke 10 orders hedging tests until the mocks were extended). Verified offline: client tsc clean,
  server tsc clean, `npm test` **255 passing** (was 242).

**⚠️ ENVIRONMENT GOTCHAS for the next run:**
1. The `Edit` file-tool TRUNCATED several files when writing through the Windows→bash sync layer this run (e.g.
   achievements.ts came out 110 lines on the bash disk vs the full content the tool reported). The `Write` tool and
   direct bash/python writes were fine. **Recommendation: apply code edits via bash (python/sed) or the Write tool and
   verify line counts with `wc -l` from bash before trusting them.** Restored the corrupted files with
   `git show HEAD:<path> > <path>` then re-applied edits via python — all good now.
2. `.git/index.lock` (0 bytes, dated 2026-06-18) is STUCK — `rm` fails (permission/sync-layer). Normal `git add`/
   `commit`/`checkout` error with "index.lock File exists". Workaround used: `GIT_INDEX_FILE=/tmp/<idx> git read-tree HEAD
   && GIT_INDEX_FILE=/tmp/<idx> git add <paths> && GIT_INDEX_FILE=/tmp/<idx> git commit ...`. If a future run can remove
   the lock, prefer that.

**PENDING LIVE VERIFY (next interactive session):** unlock a few new badges (place trades to cross volume/trade-count,
grow to $11k, build robots, 3-day login streak) and confirm they render on the profile Achievements grid.
(Carried over: **migration 031 still NOT applied** — apply on the next network-enabled run:
`SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/031_account_last_seen.sql`.)

### Next pick: offline-completable Phase 21/22 work is now thin. **22.2/22.3** (market-news feed) need a news-source
decision + likely network. **21.11** (credit bucket) needs a product decision; **21.12** depends on 21.14; **21.14**
(account groups) is a large design-first mini-phase. **21.1** (admin audit) and **21.7** (KYC e2e) stay BLOCKED until a
network-enabled/visual interactive run. Recommend the next run flag to the user that the clean offline queue is
essentially drained and the remaining items need a decision, design, or live/network access.

## ✅ 2026-06-19 (auto) — 21.16 DONE (operator broadcast / notify). Pushed to main.
Working tree was clean at start (only the STATE.md/TODO.md handoff). 21.16 was the topmost
offline unit-testable item, as the prior run queued. 21.11 (credit bucket) needs a product decision;
21.12 depends on 21.14; 21.14 (account groups) is a large design-first item; 21.1 (admin audit) and
21.7 (KYC e2e) stay BLOCKED for offline runs (network/visual).

**What shipped (commit on main, CI deploys both):**
- `server/src/routes/admin.ts`: `POST /api/admin/notify` (admin-only). zod body: `title`(1–200),
  `body`(1–4000), `audience` `'all'|'account'` (default account), `login`(account login NUMBER) OR
  `userId`(uuid), optional `symbol`/`data`. account-mode resolves ONE recipient by userId else by
  login→owner user_id (unknown login → **404 account_not_found**; neither → **400 missing_target**).
  all-mode fans out to every distinct `profiles.id`. Inserts one `notifications` row per recipient
  (`kind='system'`, `data={...,broadcast,from_admin}`) — in-app feed is source of truth — then a
  best-effort `sendPushBatch` (never fails the request). Returns `{ok,audience,recipients}`.
  Added `import { sendPushBatch } from '../lib/push.js'` + `NotifySchema`.
- `lib/api.ts`: `api.adminNotify({title,body,audience?,login?,userId?,symbol?,data?})`.
- `app/admin/notify.tsx` (NEW): audience toggle, login input, title + multiline body, all-clients
  warning banner, success/error states, Send button.
- `app/admin/index.tsx`: "Broadcast / Notify" nav tile (Send icon).
- Tests: `server/test/adminNotify.test.ts` (8). Verified offline: client tsc clean, server tsc clean,
  `npm test` **242 passing** (was 234). No migration (reuses `notifications` table from migration 029).

**PENDING LIVE VERIFY (next interactive session):** a composed message appears in the target client's
in-app notifications; "all clients" reaches every account; push arrives on devices with a token.
(Carried over: **migration 031 still NOT applied** — apply on the next network-enabled run, see the
21.13 entry below.)

### Next pick: **21.11** (credit bucket) needs a product decision; **21.12** depends on 21.14; **21.14**
(account groups) is a large design-first item — none are clean offline auto-picks. The remaining
offline-completable Phase 21 work is **exhausted** except items needing a product decision or design.
**21.1** (admin audit) and **21.7** (KYC e2e) stay blocked until a network-enabled/visual interactive
run. Consider Phase 22 (gamification): **22.1** (expanded achievements catalogue) is offline-completable
backend+UI; 22.2/22.3 need a news source decision + likely network. Recommend 22.1 next.

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

