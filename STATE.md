# STATE -- handoff notes for the next agent

## (auto, run 25) 2026-06-26 -- 21.1 STATIC AUDIT shipped (doc only; box left [ ]).
Precheck clean (`scripts/git-precheck.sh` renamed 3 stale `.git/*.lock` aside; branch=main, author OK,
tree was clean = run-24 handoff). Re-walked every unchecked `- [ ]` again: all concrete items still
blocked/parked/gated/undecomposed (same set as runs 21-24) EXCEPT the offline-doable half of **21.1** --
`docs/admin-audit.md` did not exist yet. Did it: built the cumulative schema from migrations 001-031,
then cross-checked column-by-column EVERY `.from/.select/.order/.eq/.gte/.lte/.insert/.update/.rpc` call
across all 24 `/api/admin/*` routes in `server/src/routes/admin.ts`.
- **Result: NO column/embed bug.** Historical defects (`opened_at`->`open_time` on /risk; profiles<->accounts
  embed -> stitch on /users) confirmed fixed, not regressed. RPC `apply_trade_pnl(p_account_id,p_amount)`
  signature matches (defined in 002, not 013). `storage.from('kyc')` is a bucket, not a missing table.
- **One non-code caveat:** `/api/admin/online` reads `accounts.last_seen` (migration **031, still UNAPPLIED**)
  -> will 500 live until applied. Not a code bug.
- Shipped `docs/admin-audit.md` (114 lines, route-by-route table + findings + the live-verify checklist).
  Updated 21.1's `>` comment in TODO.md to record the static audit. **Left 21.1 `[ ]`** -- acceptance
  still requires a LIVE 200 from each route (network-gated), which this sandbox can't do.
- Client + server `tsc --noEmit` both clean. No code/tests changed (doc + 2 markdown edits only; `**.md`
  is paths-ignored so NO deploy fires). Committed admin-audit.md + TODO.md + STATE.md.

## (auto, runs 21-24) 2026-06-25/26 -- AUDIT-ONLY exits; every concrete item blocked/parked/gated/undecomposed.

## (auto, run 20) 2026-06-24 -- Git writable again.
On this Windows mount you **cannot `rm`** files in `.git` ("Operation not permitted") but you **CAN
`mv` (rename)** them. `scripts/git-precheck.sh` `mv`-aside-falls-back when `rm` fails and sweeps every
`*.lock` under `.git`. Run `bash scripts/git-precheck.sh` at start; future runs self-heal.

## CRITICAL operating notes (carry forward every run)
- **The Edit/Write file-tools TRUNCATE files on this mount.** Use `python3` string-replace in bash for
  ALL file edits, then verify `wc -l` + `tail`. Never trust the Edit tool here.
- **NUL-byte check the RIGHT way:** `tr -cd '\000' < file | wc -c` (must be 0). `grep -c $'\x00'` is
  USELESS here -- bash truncates the pattern at NUL so it matches every line (false positive).
- Sensitive large files to edit ONLY via python string-replace: `server/src/routes/admin.ts`,
  `lib/api.ts`, `server/test/helpers/supabaseMock.ts` (mock's two table literals use DIFFERENT
  indentation -- replace separately).
- **Deploy = push to `main`** -> GitHub Actions (github.com reachable; railway/vercel/supabase NOT --
  egress github-only). deploy.yml has `paths-ignore` for `**.md`/`docs/**`/`scripts/**`.
- **Migration 031** (`031_account_last_seen.sql`) STILL UNAPPLIED -- `/api/admin/online` 500s live until
  applied. On a network run: `SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/031_account_last_seen.sql`

## PENDING LIVE VERIFY (deferred to an interactive/network run)
- **21.1 live half:** apply 031, then curl each of the 24 admin routes with an admin JWT, confirm 200 +
  shape per `docs/admin-audit.md`, fill the live status into the doc's Verdict column, THEN mark 21.1 [x].
- 18.8a robot-runs, 18.8c price-alerts log, 18.8e/f transactions type-filter, 21.x admin slices
  (positions, force-close/modify, analytics, trades blotter, users-equity, online, notify, CSV export) --
  backend-shipped + offline-tested, awaiting live-DB confirm.
- Visual sub-items: 18.2 chart tools, 18.3 light/dark mode, 18.8b/18.8d screen UIs -- need a
  screenshot-capable run.

## To unblock future auto-runs
(a) grant network egress (railway/supabase/Claude API) for the live-verify items; (b) approve building
21.11 (credit bucket -- a product decision); or (c) decompose Phase 22 (Gamification -- still just a
heading at TODO L1287+, ZERO `## 22.x` sub-items) and 18.3 (light/dark, recommend split 18.3a-g) into
sized `## x.y` sub-items with offline-checkable acceptance.

## Prior runs (pruned)
- Runs 11-13: admin backend slices (18.8a/c, 18.8e/f) shipped, offline-tested green.
