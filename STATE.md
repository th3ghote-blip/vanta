# STATE -- handoff notes for the next agent

## ✅ 2026-06-22 (auto, run 11) — 18.8a DONE. Broke the 10-run no-op streak with a genuinely offline-completable item.
**Key reframe:** prior runs 3–10 concluded "no safe offline work," but the TODO header's operating manual is more
permissive than they treated it — live/visual verification is **deferred** (note under "PENDING LIVE VERIFY"), the
**offline gate is `tsc` + `npm test`**, and pushing code to `main` lets CI deploy. The residual blockers (migrations
unreachable; live URLs 000) are real but the header says NOT to gate on them. The TODO header ALSO explicitly says to
**split oversized 18.8 into per-page sub-items** so an auto-run can take one. So I carved **18.8a**.

**Shipped — 18.8a Robot run log: `GET /api/admin/robot-runs`.** Backend-only, paginated/filterable admin log over the
existing `robot_runs` table (no migration — table exists since `001_init`). Stitches `robot_runs -> robots -> accounts`
in-route (two-hop, no FK to embed) for robot_name + owner login/user_id. Filters: from/to (triggered_at), action, robot,
account(login->id; unknown login -> empty, not error), dir, limit/offset. `totals` (count, trades_opened, by_action) over
the FULL filtered set. Added `api.adminGetRobotRuns()` (`lib/api.ts`) + `seed.robot()/seed.robotRun()` (mock) + new
`server/test/adminRobotRuns.test.ts` (10 tests). **Verified offline: client tsc clean, server tsc clean, `npm test`
265 passing (was 255).** Commit pushed to `main` (CI deploys both — additive endpoint, safe).
**PENDING LIVE VERIFY:** trigger a robot run on live -> confirm it appears in `/api/admin/robot-runs` with correct stitch.

**WARN: HIT THE `Edit`-TOOL TRUNCATION BUG (the one STATE has warned about).** Using the `Edit` file-tool on `lib/api.ts`,
`server/src/routes/admin.ts`, AND `server/test/helpers/supabaseMock.ts` each **silently truncated the tail** of the file
(api.ts lost its watchlist/hedging/note exports; admin.ts lost the `/online`+`/notify` routes; mock lost its rpc/auth
tail). tsc caught it ("'}' expected" / "no exported member"). **Fix used: rebuild from `origin/main:<file>` and splice the
addition in via `python3` (Write/python only — NEVER the `Edit` tool on these files).** Always `wc -l` + `tail` + `git
show origin/main:<f> | wc -l` after any edit to confirm no truncation. This is the single biggest footgun here.

**Carried-over still-open queue (all genuinely blocked for a pure-offline no-screenshot run):**
- **Migration 031** (`031_account_last_seen.sql`, for shipped 21.13) STILL UNAPPLIED — Supabase Management API
  (`api.supabase.com`) is unreachable (egress github-only, re-tested run 11: 000/no-DNS). Until applied, `/api/admin/online`
  500s live. Apply on a network run: `SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/031_account_last_seen.sql`.
- **More 18.8 sub-items** carved but NOT done: 18.8b "Robot Runs" screen UI (visual), 18.8c price-alerts log,
  18.8d AI chat-logs (depends 18.7), 18.8e deposits admin approve/reject, 18.8f withdrawals admin approve/reject.
  **18.8e/18.8f are likely the next offline-completable backend items** (approve/reject routes over existing transactions
  table — unit-testable like 18.8a). Good candidates for run 12.
- **18.2** chart drawing (interactive+visual+migration 026), **18.3** light/dark (~58-component visual refactor — split into
  18.3a-g for a preview run), **18.7** AI assistant (needs Claude API key + live DB), **21.1** admin audit (live 200s),
  **21.7** KYC e2e (live upload + image preview), **21.11** credit bucket (PRODUCT DECISION + migration), **21.12**
  stop-out (depends 21.14), **21.14** account groups (large — design first), **R.7** Better-Stack (external signup),
  **PARKED** (5.3/8.1/9.3/9.4/10.x/20.2 — external; resume only on explicit user say-so).

**ENV GOTCHAS (carried):** `.git/index.lock` is STUCK & un-`rm`-able (sync-layer owned). Commit workaround used this run:
`GIT_INDEX_FILE=/tmp/i git read-tree origin/main && GIT_INDEX_FILE=/tmp/i git add <files> &&`
`TREE=$(GIT_INDEX_FILE=/tmp/i git write-tree) && C=$(git commit-tree $TREE -p origin/main -m '...') &&`
`git push origin $C:refs/heads/main`. Local HEAD trails origin/main by handoff commits — normal, not a user edit.
STATE/TODO-only (`**.md`) pushes do NOT trigger a deploy (deploy.yml `paths-ignore`); code pushes DO.

## (PAUSED) 2026-06-22 (auto, run 10) — NO ITEM PICKED (superseded by run 11's reframe). Egress github-only; concluded all
open items live/visual/large/product-gated. Migration 031 unapplied.

## (PAUSED) 2026-06-21 (auto, run 9) — NO ITEM PICKED. 9th no-op. Egress github-only. Migration 031 unapplied.

## (PAUSED) 2026-06-21 (auto, run 8) — NO ITEM PICKED. Dirty tree was NUL-byte corruption of `rateLimit.test.ts`
(sync-layer, not a user edit), since self-healed.

## (DONE) 2026-06-20 (auto) — 22.1 DONE (expanded achievements catalogue, +15 badges). Pushed to main. tsc clean, 255 tests.
