# STATE -- handoff notes for the next agent

## (auto, run 27) 2026-06-26 -- 21.9 stray `**Files:**` box ticked (already-shipped work; doc only, no deploy).
Precheck clean (git-precheck renamed 3 stale `.git/*.lock` files aside; branch=main, author OK, tree
clean = run-26 handoff). Re-walked the unchecked list top-to-bottom: every concrete item above 21.9 stays
blocked/parked/gated/SKIPPED (R.7 BetterStack external-acct, 18.2/18.3 visual, 18.7 network+Claude-key,
21.1 live-200-gated, 21.7 KYC live/visual, 21.11 product decision, 21.12 dep-on-21.14, 21.14 undecomposed,
Phase 22 still a bare heading) -- same set as runs 21-26. Acted on the item run 26 flagged: 21.9 ("Admin
account list -- equity + margin-level columns") had its work DONE 2026-06-18 (equity + margin_level_pct on
`/api/admin/users`, UI line in `app/admin/users.tsx`, typed in `lib/api.ts`) with its `Done` line `[x]`,
but its secondary `**Files:**` checkbox left `[ ]` -- a stray box, not open work. Verified 21.9 OFFLINE:
`equityByAccount()` helper present in `server/src/routes/admin.ts` (l.475), UI "Equity $X · ML NN%" line in
users.tsx (l.101), `AdminUser.accounts[].equity?/margin_level_pct?` in lib/api.ts; client + server
`tsc --noEmit` both clean; `adminUsersEquity.test.ts` 5/5 passing. Ticked the stray box `[x]`. Markdown-only
edit (deploy.yml `paths-ignore` covers `**.md` -> NO deploy fires). Committed TODO.md + STATE.md.
- **NOTE for next run:** the 21.8/21.9 stray-box pattern is now fully cleared. The remaining unchecked `[ ]`
  boxes are all real open work that is blocked/parked/gated/undecomposed -- not stray boxes. Next genuine
  progress needs one of the unblock actions below.

## (auto, run 26) 2026-06-26 -- 21.8 box ticked (already-shipped parity doc reconciled; doc only, no deploy).
`docs/mt4-manager-parity.md` was shipped 2026-06-18 (69 lines, 15-row Have/Partial/Missing matrix,
9 Have / 4 Partial / 2 Missing, follow-ups 21.9-21.16) with its `Done` line `[x]` but `**Files:**` box `[ ]`.
Verified offline, ticked the stray box. Markdown-only, no deploy.

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
- **21.9 live half:** on the live DB, confirm an account's `equity`/`margin_level_pct` on the user-search
  list match its row in the Accounts analytics leaderboard.
- 18.8a robot-runs, 18.8c price-alerts log, 18.8e/f transactions type-filter, 21.x admin slices
  (positions, force-close/modify, analytics, trades blotter, online, notify, CSV export) --
  backend-shipped + offline-tested, awaiting live-DB confirm.
- Visual sub-items: 18.2 chart tools, 18.3 light/dark mode, 18.8b/18.8d screen UIs -- need a
  screenshot-capable run.

## To unblock future auto-runs
(a) grant network egress (railway/supabase/Claude API) for the live-verify items; (b) approve building
21.11 (credit bucket -- a product decision); or (c) decompose Phase 22 (Gamification -- still just a
heading at TODO L1287+, ZERO `## 22.x` sub-items) and 18.3 (light/dark, recommend split 18.3a-g) into
sized `## x.y` sub-items with offline-checkable acceptance. The 21.8/21.9 stray-box tidies are now DONE --
no easy box-tick wins remain; every open `[ ]` is real blocked/parked/gated work.

## Prior runs (pruned)
- Runs 21-24: AUDIT-ONLY exits; every concrete item blocked/parked/gated/undecomposed.
- Runs 11-13: admin backend slices (18.8a/c, 18.8e/f) shipped, offline-tested green.
