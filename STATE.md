# STATE -- handoff notes for the next agent

## (auto, run 24) 2026-06-25 -- AUDIT-ONLY, clean exit. No code changed.
Precheck clean (`scripts/git-precheck.sh`): no stale locks, branch=main, author OK, working tree
clean, HEAD = run-23 handoff. Independently re-walked the ENTIRE unchecked `- [ ]` set in TODO.md
(grep of every `- [ ]`, read each with context) and reproduced runs 21-23's finding -- **every
remaining item is blocked, parked, gated, a product decision, or undecomposed.** Nothing
offline-completable. Snapshot:
- **Network-gated (egress github-only, can't reach railway/supabase/Claude API):** R.7 Better-Stack
  (acct signup + live URL), 18.7 AI assistant (Claude API + live DB), 21.1 admin audit (acceptance =
  live 200s on railway), 21.7 KYC e2e (live upload + signed-URL image preview).
- **Visual/screenshot-gated:** 18.2 chart drawing tools (interactive + persistence + render);
  18.3 light/dark refactor (~58 components, acceptance explicitly visual -- recommended split into
  18.3a-g but sub-items NOT yet created as `## x.y` headings); 18.8b/18.8d screen UIs.
- **Product/business decision:** 21.11 credit/bonus bucket (tagged optional; build only if wanted).
- **Dependency-blocked:** 21.12 per-account stop-out (depends on 21.14).
- **Too large / undecomposed:** 21.14 account groups (own mini-phase); 18.8 umbrella; **Phase 22
  Gamification is STILL just a heading + intro paragraph at L1286-1291 with ZERO `## 22.x` sub-items**
  -- confirmed by reading to EOF (L1298). Must be decomposed before an auto-run can take it.
- **PARKED (need user action):** 5.3 Sumsub, 8.1 OANDA, 9.3/9.4 app stores, 10.1-10.6 domain chain,
  20.2 forgot-password (gated on 10.4 Resend).
- Stray `- [ ]` **Files:** bullets under already-`[x]` items (21.8 L1233, 21.9 L1239) are cosmetic
  leftovers, not work -- ignore.
Committed this STATE.md handoff only (TODO.md untouched; `**.md` is paths-ignored so no deploy).
**To unblock the next run:** (a) grant network egress (railway/supabase/Claude API) for the
live-verify items; (b) approve building 21.11; or (c) decompose Phase 22 / 18.3 into sized `## x.y`
sub-items with offline-checkable acceptance.

## (auto, run 23) 2026-06-25 -- AUDIT-ONLY, clean exit. Same finding (every item blocked/parked/gated).

## (auto, run 22) 2026-06-25 -- AUDIT-ONLY, clean exit. Same finding (every item blocked/parked/gated).

## (auto, run 20) 2026-06-24 -- Git is writable again.
On this Windows mount you **cannot `rm`** files in `.git` ("Operation not permitted") but you **CAN
`mv` (rename)** them. `scripts/git-precheck.sh` now `mv`-aside-falls-back when `rm` fails and sweeps
every `*.lock` under `.git`. Run `bash scripts/git-precheck.sh` at start; future runs self-heal.

## CRITICAL operating notes (carry forward every run)
- **The Edit/Write file-tools TRUNCATE files on this mount.** Use `python3` string-replace in bash
  for ALL file edits, then verify `wc -l` + `tail`. Never trust the Edit tool here.
- Sensitive large files to edit ONLY via python string-replace: `server/src/routes/admin.ts`,
  `lib/api.ts`, `server/test/helpers/supabaseMock.ts` (the mock's two table literals use DIFFERENT
  indentation -- init `};` 2-space, resetDb `  };` 4-space -- replace separately).
- **STATE.md NUL-byte risk:** write clean UTF-8 via python; check `grep -c $'\x00' STATE.md` == 0.
- **Deploy = push to `main`** -> GitHub Actions (github.com IS reachable; railway/vercel/supabase are
  NOT -- egress is github-only). deploy.yml has `paths-ignore` for `**.md`/`docs/**`/`scripts/**`.
- **Migration 031** (`031_account_last_seen.sql`, for 21.13) STILL UNAPPLIED -- `/api/admin/online`
  500s live until applied. On a network run:
  `SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/031_account_last_seen.sql`

## PENDING LIVE VERIFY (deferred to an interactive/network run)
- 18.8a robot-runs, 18.8c price-alerts log, 18.8e/f transactions type-filter, 21.x admin slices
  (positions, force-close/modify, analytics by-symbol/overview/accounts, trades blotter, users-equity,
  online, notify, CSV export) -- backend-shipped + offline-tested, awaiting live-DB confirm.
- Visual sub-items: 18.2 chart tools, 18.3 light/dark mode, 18.8b/18.8d screen UIs -- need a
  screenshot-capable run.

## Prior runs (pruned)
- Runs 21-23 (Jun 25): audit-only, no actionable item.
- Run 20 (Jun 24): fixed git lock (mv-aside fallback in precheck).
- Runs 11-13: admin backend slices (18.8a/c, 18.8e/f) shipped, offline-tested green.
