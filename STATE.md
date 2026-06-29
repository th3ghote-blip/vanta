# STATE -- handoff notes for the next agent

## (auto, run 32) 2026-06-29 -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (git-precheck self-healed three stale `.git/*.lock` files aged ~136131s via rename;
branch=main OK, author OK, working tree clean). Client `tsc --noEmit` exit 0; server `tsc --noEmit`
exit 0. Independently re-walked the FULL unchecked `[ ]` list top-to-bottom (did NOT just trust the
handoff) -- same blocked/parked/gated/undecomposed/visual set as runs 21-31, no box-tick wins remain:
- R.7 (BetterStack, L160): external signup + reachable live URL + live alert verify. Externally gated.
- 18.2 chart drawing (L835): interactive + `chart_drawings` round-trip + visual.
- 18.3 light/dark (L847): undecomposed, VISUAL acceptance. Needs split into 18.3a-g + a screenshot run.
- 18.7 AI assistant (L999): Claude API key + network + live verify, multi-page chat UI.
- 18.8 parent (L911): remaining sub-items are screen UIs (visual); 18.8d depends on 18.7; all offline
  backend slices already shipped (18.8a/c/e/f).
- 21.1 (L1185): needs LIVE 200 per admin route (network). Static audit done in `docs/admin-audit.md`.
- 21.7 KYC (L1227): live doc upload + signed-URL image preview (visual + network).
- 21.11 credit bucket (L1251): *(optional)* product/business decision -- not for an autonomous run.
- 21.12 stop-out (L1257): explicit "Depends on 21.14"; 21.14 not done -> dependency unmet.
- 21.14 account groups (L1268): large/undecomposed -- needs a design/decomposition pass first.
- 1169 (19.2 UI-only steps): browser/visual verification, not offline-completable.
- Phase 22 (Gamification): STILL a bare heading (TODO L1287-1292), ZERO `## 22.x` sub-items; the file
  ends at L1292. Decomposing it = product feature choices = a judgment call, not autonomous work.
No file changed except this STATE.md entry. Markdown-only -> NO deploy (deploy.yml paths-ignore covers
`**.md`). Committing STATE.md only.
- **NOTE for next run:** unchanged since runs 28-31 (same clean tree). An offline, no-network,
  no-screenshot run cannot complete or verify any open item. Another clean audit exit is the correct
  outcome until the user grants an unblock (see "To unblock" below). Do NOT fabricate work.

## (auto, run 31) 2026-06-28 -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (self-healed three stale `.git/*.lock`). Client+server `tsc --noEmit` exit 0. Re-walked
the FULL unchecked list -- same blocked/parked/gated/undecomposed set as runs 21-30. STATE.md only.

## (auto, run 30) 2026-06-27 -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (self-healed one stale `.git/index.lock`). Client+server `tsc --noEmit` exit 0.
Re-walked the FULL unchecked list -- same set as runs 21-29, no box-tick wins. STATE.md only changed.

## (auto, run 29) 2026-06-27 -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean. Client `tsc --noEmit` clean. Re-walked the unchecked list; every concrete item the
SAME blocked/parked/gated/undecomposed set as runs 21-28. STATE.md only changed.

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
heading at TODO L1287, ZERO `## 22.x` sub-items) and 18.3 (light/dark, recommend split 18.3a-g) into
sized `## x.y` sub-items with offline-checkable acceptance. No easy box-tick wins remain; every open
`[ ]` is real blocked/parked/gated/dependency-blocked work.

## Prior runs (pruned)
- Runs 21-28, 30-31: AUDIT-ONLY exits; every concrete item blocked/parked/gated/undecomposed.
- Runs 25-27: stray `**Files:**` box tidies for already-shipped 21.1/21.8/21.9 (now fully cleared).
- Runs 11-13: admin backend slices (18.8a/c, 18.8e/f) shipped, offline-tested green.
