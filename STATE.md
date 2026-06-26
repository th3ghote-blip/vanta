# STATE -- handoff notes for the next agent

## (auto, run 26) 2026-06-26 -- 21.8 box ticked (already-shipped work reconciled; doc only, no deploy).
Precheck clean (git-precheck renamed 1 stale `.git/objects/maintenance.lock` aside; branch=main, author OK,
tree clean = run-25 handoff). Re-walked every unchecked `- [ ]`: all concrete items remain
blocked/parked/gated/undecomposed (same set as runs 21-25). Found 21.8 ("MT4-Manager parity checklist")
had its work DONE 2026-06-18 (`docs/mt4-manager-parity.md` shipped) and tests/tsc green, but its
secondary `**Files:**` checkbox was left `[ ]` while its `Done` line was `[x]` -- a stray box, not real
open work. Verified 21.8's acceptance fully OFFLINE: doc exists (69 lines), complete 15-row
Have/Partial/Missing matrix (9 Have / 4 Partial / 2 Missing summary), and linked follow-ups 21.9-21.16.
Ticked the stray box `[x]`. Markdown-only edit (paths-ignored -> NO deploy fires). Client+server
`tsc --noEmit` both clean. Committed TODO.md + STATE.md.
- **NOTE for next run:** 21.9 (line ~1240) has the SAME stray-box situation -- its `Done 2026-06-18`
  line is `[x]` (equity/margin-level columns shipped, 208 tests green) but its `**Files:**` box is still
  `[ ]`. It's verifiably done; a future tidy run can tick it. Left untouched this run (one item per run).

## (auto, run 25) 2026-06-26 -- 21.1 STATIC AUDIT shipped (`docs/admin-audit.md`, 114 lines).
Cross-checked all 24 `/api/admin/*` routes column-by-column vs migrations 001-031: NO column/embed bug
(historical `opened_at`->`open_time` and profiles<->accounts-embed defects confirmed fixed). One caveat:
`/api/admin/online` reads `accounts.last_seen` (migration **031, still UNAPPLIED**) -> 500s live until
applied (not a code bug). Box left `[ ]` -- acceptance needs a LIVE 200 per route (network-gated).

## CRITICAL operating notes (carry forward every run)
- **The Edit/Write file-tools TRUNCATE files on this mount.** Use `python3` string-replace (or a heredoc
  whole-file write) in bash for ALL file edits, then verify `wc -l` + `tail`. Never trust the Edit tool here.
- **NUL-byte check the RIGHT way:** `tr -cd '\000' < file | wc -c` (must be 0). `grep -c $'\x00'` is
  USELESS here -- bash truncates the pattern at NUL so it matches every line (false positive).
- Sensitive large files to edit ONLY via python string-replace: `server/src/routes/admin.ts`,
  `lib/api.ts`, `server/test/helpers/supabaseMock.ts` (mock's two table literals use DIFFERENT
  indentation -- replace separately).
- **Deploy = push to `main`** -> GitHub Actions (github.com reachable; railway/vercel/supabase NOT --
  egress github-only). deploy.yml has `paths-ignore` for `**.md`/`docs/**`/`scripts/**` -- doc/MD edits
  do NOT trigger a deploy.
- **On this Windows mount you cannot `rm` files in `.git`** ("Operation not permitted") but you CAN
  `mv` (rename). `scripts/git-precheck.sh` self-heals stale `*.lock` files -- run it at start.
- **Migration 031** (`031_account_last_seen.sql`) STILL UNAPPLIED -- `/api/admin/online` 500s live until
  applied. Network run: `SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/031_account_last_seen.sql`

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
sized `## x.y` sub-items with offline-checkable acceptance. (d) Quick: tick 21.9's stray `**Files:**` box.

## Prior runs (pruned)
- Runs 21-24: AUDIT-ONLY exits; every concrete item blocked/parked/gated/undecomposed.
- Runs 11-13: admin backend slices (18.8a/c, 18.8e/f) shipped, offline-tested green.
