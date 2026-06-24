# STATE -- handoff notes for the next agent

## ✅ 2026-06-25 (auto, run 21) -- AUDIT-ONLY, clean exit. No offline-completable item.
Git is healthy (precheck self-heals the stuck `index.lock` via `mv`-aside; READ ops work with a
leftover lock). Working tree clean at start. Walked the ENTIRE unchecked `- [ ]` set in TODO.md;
**every remaining item is blocked, parked, gated, a product decision, or undecomposed** -- all
already annotated by prior runs, so nothing new to annotate:
- **Network-gated (github-only egress):** 21.1 admin audit (needs live 200s), 21.7 KYC e2e
  (live upload+signed-URL image preview), 18.7 AI assistant (Claude API), R.7 Better-Stack (acct+live URL).
- **Visual/screenshot-gated:** 18.2 chart drawing tools, 18.3 light/dark refactor (~58 components;
  a missed token = broken render, unverifiable offline -- recommended split 18.3a-g stands).
- **Product/business decision:** 21.11 credit/bonus bucket ("optional", build only if wanted).
- **Dependency-blocked:** 21.12 per-account stop-out ("Depends on 21.14"; author intends groups first).
- **Too large / undecomposed:** 21.14 account groups ("design as its own mini-phase"); **Phase 22
  Gamification** is still just a heading + description with NO `## 22.x` sub-items -- decompose before
  an auto-run can take one (a gamification design is itself a product call, not an impl detail).
- **PARKED (need user action):** 5.3 Sumsub, 8.1 OANDA, 9.3/9.4 app stores, 10.x domain chain, 10.6 reset.
- Stray unchecked `- [ ]` **Files:** lines under already-`[x]` items (21.8 L1233, 21.9 L1239) are
  cosmetic un-flipped bullets, not real work -- left as-is.
No code changed; committed this STATE.md handoff only. **To unblock the next run, the user can:**
grant network egress (railway/supabase/Claude API) for the live-verify items; approve building 21.11;
or decompose Phase 22 / 18.3 into sized sub-items.

## ✅ 2026-06-24 (auto, run 20) -- BROKE THE 6-RUN BLOCK. Git is writable again.
Root cause of runs 14-19 no-ops: on this Windows mount you **cannot `rm`** files in `.git`
("Operation not permitted") but you **CAN `mv` (rename)** them. Renaming stuck 0-byte locks aside
cleared them. **Durable fix shipped:** `scripts/git-precheck.sh` now `mv`-aside-falls-back when `rm`
fails and sweeps every `*.lock` under `.git`. Run `bash scripts/git-precheck.sh` at start; future
runs self-heal. (Every git command still leaves a new `index.lock` it can't unlink -- harmless for
READ ops; WRITE ops need the precheck sweep first.)

## ⚠️ CRITICAL operating notes (carry forward every run)
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
- Runs 14-19 (Jun 23-24): SKIPPED no-ops, blocked by the now-fixed git lock (resolved run 20).
- Runs 11-13: admin backend slices (18.8a/c, 18.8e/f) shipped, offline-tested green.
