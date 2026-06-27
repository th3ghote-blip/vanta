# STATE -- handoff notes for the next agent

## (auto, run 29) 2026-06-27 -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (git-precheck: no stale locks, branch=main, author OK, tree clean). Client
`tsc --noEmit` clean (exit 0). Re-walked the full unchecked `[ ]` list top-to-bottom; every
concrete item is the SAME blocked/parked/gated/undecomposed set as runs 21-28 -- no box-tick
wins remain:
- R.7 (BetterStack, L160): external signup + network.
- 18.2 chart drawing (L835): interactive/persistence/visual.
- 18.3 light/dark (L847): single undecomposed item, VISUAL acceptance (missed token = broken
  render, unverifiable offline). Needs split into 18.3a-g + a screenshot/preview run.
- 18.7 AI assistant (L999): Claude API key + network + live verify, multi-page chat UI.
- 18.8 parent (L911) + remaining sub-items: visual/oversized; backend slices already shipped.
- 21.1 (L1185): needs a LIVE 200 per admin route (network). Static audit in `docs/admin-audit.md`.
- 21.7 KYC (L1227): live doc upload + signed-URL image preview (visual + network).
- 21.11 credit bucket (L1251): *(optional)*, product/business decision -- not for an autonomous run.
- 21.12 stop-out (L1257): explicit "Depends on 21.14"; 21.14 not done -> dependency unmet.
- 21.14 account groups (L1268): large/undecomposed.
- Phase 22 (Gamification): STILL a bare heading at TODO L1289 (file ends L1292), ZERO `## 22.x`
  sub-items. Nothing to pick.
PARKED (skip): 5.3 Sumsub, 8.1 OANDA, 9.3/9.4 store builds, 10.x domain/email, 11.x reset.
No file changed except this STATE.md entry. Markdown-only -> NO deploy (deploy.yml paths-ignore
covers `**.md`). Committed STATE.md only.
- **NOTE for next run:** unchanged since run 28 (same day, clean tree). Do not expect an easy win.
  An offline, no-network, no-screenshot run cannot complete or verify any open item. Another clean
  audit exit is the correct outcome until the user grants an unblock (see below). Do NOT fabricate work.

## (auto, run 28) 2026-06-27 -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean. Client+server `tsc --noEmit` clean, `npm test` **285/285 passing** (27 files).
Re-walked entire unchecked list; every item blocked/parked/gated/undecomposed (same set as 21-27);
21.8/21.9 stray-box tidies already cleared. No file changed except STATE.md.

## (auto, run 27) 2026-06-26 -- 21.9 stray `**Files:**` box ticked (already-shipped work; doc only, no deploy).
21.9 ("Admin account list -- equity + margin-level columns") was DONE 2026-06-18 (equity +
margin_level_pct on `/api/admin/users`, UI in `app/admin/users.tsx`, typed in `lib/api.ts`) with its
`Done` line `[x]` but secondary `**Files:**` box `[ ]`. Verified offline, ticked the stray box.

## (auto, run 26) 2026-06-26 -- 21.8 box ticked (already-shipped parity doc reconciled; doc only, no deploy).
`docs/mt4-manager-parity.md` shipped 2026-06-18 (15-row Have/Partial/Missing matrix, follow-ups
21.9-21.16) with `Done` `[x]` but `**Files:**` `[ ]`. Verified offline, ticked the stray box.

## CRITICAL operating notes (carry forward every run)
- **The Edit/Write file-tools TRUNCATE files on this mount.** Use `python3` string-replace (or a heredoc
  whole-file write) in bash for ALL file edits, then verify `wc -l` + `tail`. Never trust the Edit tool here.
- **NUL-byte check the RIGHT way:** `tr -cd '\000' < file | wc -c` (must be 0). `grep -c $'\x00'` is
  USELESS here -- bash truncates the pattern at NUL so it matches every line (false positive).
- Sensitive large files to edit ONLY via python string-replace: `server/src/routes/admin.ts`,
  `lib/api.ts`, `server/test/helpers/supabaseMock.ts` (mock's two table literals use DIFFERENT
  indentation -- replace separately).
- **Deploy = push to `main`** -> GitHub Actions (github.com reachable; railway/vercel/supabase NOT --
  egress github-only). deploy.yml has `paths-ignore` for `**.md`/`docs/**`/`scripts/**`/`e2e/**` -- doc/MD
  edits do NOT trigger a deploy.
- **On this Windows mount you cannot `rm` files in `.git`** ("Operation not permitted") but you CAN
  `mv` (rename). `scripts/git-precheck.sh` self-heals stale `*.lock` files -- run it at start.
- **Migration 031** (`031_account_last_seen.sql`) STILL UNAPPLIED -- `/api/admin/online` 500s live until
  applied. Network run:
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
heading at TODO L1289, ZERO `## 22.x` sub-items) and 18.3 (light/dark, recommend split 18.3a-g) into
sized `## x.y` sub-items with offline-checkable acceptance. No easy box-tick wins remain; every open
`[ ]` is real blocked/parked/gated/dependency-blocked work.

## Prior runs (pruned)
- Runs 21-25, 28-29: AUDIT-ONLY exits; every concrete item blocked/parked/gated/undecomposed.
- Runs 25-27: stray `**Files:**` box tidies for already-shipped 21.1/21.8/21.9 (now fully cleared).
- Runs 11-13: admin backend slices (18.8a/c, 18.8e/f) shipped, offline-tested green.
