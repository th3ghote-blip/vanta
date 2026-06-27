# STATE -- handoff notes for the next agent

## (auto, run 28) 2026-06-27 -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean: git-precheck renamed 1 stale `.git/objects/maintenance.lock` aside; branch=main,
author OK, working tree clean (run-27 handoff). Client `tsc --noEmit` clean, server `tsc --noEmit`
clean, `npm test` **285/285 passing** (27 files). Re-walked the entire unchecked `[ ]` list
top-to-bottom; every concrete item remains blocked/parked/gated/dependency-blocked/undecomposed --
SAME set as runs 21-27, and the 21.8/21.9 stray-box tidies are already cleared (no box-tick wins left):
- R.7 (BetterStack, L160): external signup + network.
- 18.2 chart drawing: interactive/persistence/visual.
- 18.3 light/dark: single undecomposed item, VISUAL acceptance (missed token = broken render,
  unverifiable offline). Needs split into 18.3a-g + a screenshot/preview run.
- 18.7 AI assistant: Claude API key + network + live verify.
- 18.8 remaining sub-items: 18.8b/18.8c-screen (visual), 18.8d (depends on 18.7).
- 21.1: needs a LIVE 200 per admin route (network). Static audit already in `docs/admin-audit.md`.
- 21.7 KYC: live doc upload + signed-URL image preview (visual + network).
- 21.11 credit bucket: tagged *(optional)*, product/business decision -- not for an autonomous run.
- 21.12 stop-out: explicit "Depends on 21.14"; 21.14 not done -> dependency not met.
- 21.14 account groups: large/undecomposed ("scope as its own mini-phase first").
- Phase 22 (Gamification): still a bare heading at TODO L1287+, ZERO `## 22.x` sub-items.
No file changed except this STATE.md entry. Markdown-only (`deploy.yml` `paths-ignore` covers `**.md`)
-> NO deploy fires. Committed STATE.md only.
- **NOTE for next run:** do not expect an easy win. Every open `[ ]` needs an external unblock (see
  "To unblock future auto-runs" below). An offline, no-network, no-screenshot run cannot complete or
  verify any of them. Don't fabricate work -- another clean audit exit is the correct outcome until the
  user grants one of the unblocks.

## (auto, run 27) 2026-06-26 -- 21.9 stray `**Files:**` box ticked (already-shipped work; doc only, no deploy).
Re-walked the unchecked list: every concrete item above 21.9 stays blocked/parked/gated/SKIPPED. Acted on
the item run 26 flagged: 21.9 ("Admin account list -- equity + margin-level columns") work was DONE
2026-06-18 (equity + margin_level_pct on `/api/admin/users`, UI line in `app/admin/users.tsx`, typed in
`lib/api.ts`) with its `Done` line `[x]` but its secondary `**Files:**` checkbox left `[ ]` -- a stray box.
Verified 21.9 offline (`equityByAccount()` in admin.ts l.475, UI line users.tsx l.101, lib/api.ts types;
client+server tsc clean; `adminUsersEquity.test.ts` 5/5). Ticked the stray box. Markdown-only, no deploy.

## (auto, run 26) 2026-06-26 -- 21.8 box ticked (already-shipped parity doc reconciled; doc only, no deploy).
`docs/mt4-manager-parity.md` shipped 2026-06-18 (69 lines, 15-row Have/Partial/Missing matrix, follow-ups
21.9-21.16) with its `Done` line `[x]` but `**Files:**` box `[ ]`. Verified offline, ticked the stray box.

## (auto, run 25) 2026-06-26 -- 21.1 STATIC AUDIT shipped (`docs/admin-audit.md`, 114 lines).
Cross-checked all 24 `/api/admin/*` routes column-by-column vs migrations 001-031: NO column/embed bug.
One caveat: `/api/admin/online` reads `accounts.last_seen` (migration **031, still UNAPPLIED**) -> 500s
live until applied. Box left `[ ]` -- acceptance needs a LIVE 200 per route (network-gated).

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
  applied. apply-migration.py returns 403 Tunnel offline (Supabase Mgmt API NOT reachable from sandbox,
  despite the TODO header's claim). Network run:
  `SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/031_account_last_seen.sql`

## PENDING LIVE VERIFY (deferred to an interactive/network run)
- **21.1 live half:** apply 031, then curl each of the 24 admin routes with an admin JWT, confirm 200 +
  shape per `docs/admin-audit.md`, fill the live status into the Verdict column, THEN mark 21.1 [x].
- **21.9 live half:** confirm an account's `equity`/`margin_level_pct` on the user-search list match its
  row in the Accounts analytics leaderboard.
- 18.8a robot-runs, 18.8c price-alerts log, 18.8e/f transactions type-filter, 21.x admin slices
  (positions, force-close/modify, analytics, trades blotter, online, notify, CSV export) --
  backend-shipped + offline-tested, awaiting live-DB confirm.
- Visual sub-items: 18.2 chart tools, 18.3 light/dark mode, 18.8b/18.8d screen UIs -- need a
  screenshot-capable run.

## To unblock future auto-runs
(a) grant network egress (railway/supabase/Claude API) for the live-verify items; (b) approve building
21.11 (credit bucket -- a product decision); or (c) decompose Phase 22 (Gamification -- still just a
heading at TODO L1287+, ZERO `## 22.x` sub-items) and 18.3 (light/dark, recommend split 18.3a-g) into
sized `## x.y` sub-items with offline-checkable acceptance. No easy box-tick wins remain; every open
`[ ]` is real blocked/parked/gated/dependency-blocked work.

## Prior runs (pruned)
- Runs 21-24, 28: AUDIT-ONLY exits; every concrete item blocked/parked/gated/undecomposed.
- Runs 25-27: stray `**Files:**` box tidies for already-shipped 21.1/21.8/21.9 (now fully cleared).
- Runs 11-13: admin backend slices (18.8a/c, 18.8e/f) shipped, offline-tested green.
