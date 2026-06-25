# STATE -- handoff notes for the next agent

## (auto, run 22) 2026-06-25 -- AUDIT-ONLY, clean exit. Nothing changed since run 21.
Precheck clean: no stale locks, branch=main, working tree clean, HEAD = run-21 handoff
(`b6879e2`); no new commits since. Independently re-walked the ENTIRE unchecked `- [ ]`
set in TODO.md and reproduced run 21's finding -- **every remaining item is blocked,
parked, gated, a product decision, or undecomposed.** All are already annotated by prior
runs, so nothing new to add. Snapshot:
- **Network-gated (egress github-only):** R.7 Better-Stack (acct+live URL), 18.7 AI assistant
  (Claude API+live DB), 21.1 admin audit (needs live 200s), 21.7 KYC e2e (live upload+signed-URL preview).
- **Visual/screenshot-gated:** 18.2 chart drawing tools, 18.3 light/dark refactor (~58 components).
- **Product/business decision:** 21.11 credit/bonus bucket ("optional", build only if wanted).
- **Dependency-blocked:** 21.12 per-account stop-out (depends on 21.14).
- **Too large / undecomposed:** 21.14 account groups (own mini-phase); Phase 22 Gamification is
  still a heading with NO `## 22.x` sub-items -- decompose before an auto-run can take one.
- **PARKED (need user action):** 5.3 Sumsub, 8.1 OANDA, 9.3/9.4 app stores, 10.x domain chain, 10.6 reset.
- Stray `- [ ]` **Files:** bullets under already-`[x]` items (21.8 L1233, 21.9 L1239) are cosmetic, not work.
No code changed; committed this STATE.md handoff only. **To unblock the next run:** grant network
egress (railway/supabase/Claude API) for live-verify items; approve building 21.11; or decompose
Phase 22 / 18.3 into sized sub-items.

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
- 18.8c price-alerts log, 18.8e/f transactions type-filter, 21.x admin slices (positions, analytics,
  trades, online, notify, users-equity) -- backend-shipped + offline-tested, awaiting live-DB confirm.
- Visual sub-items 18.2 chart tools, 18.3 light/dark mode, 18.8b/18.8d screen UIs -- need a
  screenshot-capable run.

## Prior runs (pruned)
- Run 21 (Jun 25): audit-only, no actionable item (same finding as this run).
- Runs 14-19 (Jun 23-24): SKIPPED no-ops, blocked by the now-fixed git lock (resolved run 20).
- Runs 11-13: admin backend slices (18.8a/c, 18.8e/f) shipped, offline-tested green.
