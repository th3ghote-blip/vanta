# STATE -- handoff notes for the next agent

## (auto, run 44) 2026-07-01 22:09 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (git-precheck renamed 1 stale `.git/objects/maintenance.lock` aged ~14321s via mv -- rm
not permitted on this mount; branch=main OK, author OK, working tree clean). Client `tsc --noEmit` exit 0;
server `tsc --noEmit` exit 0; `npm test` **285 passing** (27 files). Independently re-walked the FULL
unchecked `[ ]` list top-to-bottom (read each item's full text + surrounding context, did NOT just trust
the handoff) -- identical blocked/parked/gated/undecomposed/visual set as runs 21-43, no box-tick wins:
- R.7 BetterStack (L160), 5.3 Sumsub (L485), 8.1 OANDA (L550), 9.3/9.4 stores (L582/586),
  10.1-10.6 domain (L597-624), 20.2 forgot-pw (L1084): PARKED / externally gated. Skip per header rule.
- 18.2 chart drawing (L834): interactive + `chart_drawings` round-trip + visual.
- 18.3 light/dark (L846): ~58-component themed-lookup refactor, VISUAL acceptance -> screenshot run.
  Not yet decomposed into 18.3a-g sub-items.
- 18.7 AI assistant (L998): Claude API key + network + live verify + multi-page chat UI.
- 18.8 (L910): oversized parent; ALL offline backend slices shipped (18.8a/c/e/f). Remaining sub-items
  (18.8b/d screen UIs) are visual; 18.8d also depends on 18.7.
- 21.1 admin audit (L1184): static audit in docs/admin-audit.md done; box needs a LIVE 200 per route.
- 21.7 KYC (L1226): live doc upload + signed Storage URL image preview -> visual + network.
- 21.11 credit bucket (L1250): *(optional)* product/business decision -- not autonomous.
- 21.12 stop-out (L1256): depends on 21.14 (not done) -> dependency unmet.
- 21.14 account groups (L1267): large/undecomposed -- needs a design/decomposition pass first.
- Phase 22 (Gamification): STILL a bare heading (file ends ~L1292), ZERO `## 22.x` items.

**NEW THIS RUN -- network egress confirmed github-only (settles a standing contradiction).** The TODO
header claims "apply-migration.py IS reachable (Supabase Management API allowlisted)". That is FALSE in
this sandbox. Live probe: `github.com` -> 200; `api.supabase.com` -> HTTP 000 / curl exit 56 (conn
reset); Railway `/health` -> HTTP 000 / exit 56. So **migration 031 CANNOT be applied from an auto-run**
(confirmed, not just assumed) -- it needs an interactive/network-enabled session. Future auto-runs should
stop treating "apply 031" as reachable work.

No file changed except this STATE.md entry. Markdown-only -> NO deploy (deploy.yml paths-ignore covers
`**.md`). Committing STATE.md only. Migration 031 STILL UNAPPLIED. An offline, github-only,
no-screenshot run cannot complete or verify any open item; another clean audit exit is correct until the
user grants an unblock (see "To unblock" below). Do NOT fabricate work.

## (auto, run 43) 2026-07-01 18:07 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean; client+server `tsc --noEmit` exit 0; `npm test` **285 passing** (27 files). Re-walked the
full unchecked list -- identical blocked/parked/gated/undecomposed/visual set as runs 21-42. No file changed
except this STATE.md entry. Markdown-only -> NO deploy. Migration 031 STILL UNAPPLIED. Do NOT fabricate work.

## (auto, run 42) 2026-07-01 14:08 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean; client+server `tsc --noEmit` exit 0; `npm test` **285 passing** (27 files). Re-walked the
full unchecked list -- identical blocked set as runs 21-41. STATE.md-only change. Migration 031 UNAPPLIED.

## (auto, run 41) 2026-07-01 11:57 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean; client+server `tsc --noEmit` exit 0; `npm test` **285 passing**. Re-walked full list --
identical blocked set. STATE.md-only change. Migration 031 STILL UNAPPLIED. Do NOT fabricate work.

## (auto, run 40) 2026-06-30 22:07 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean; client+server `tsc --noEmit` exit 0. Re-walked full list -- identical blocked set. STATE.md
-only change. Migration 031 STILL UNAPPLIED. Do NOT fabricate work.


## CRITICAL operating notes (carry forward every run)
- **Network egress is GITHUB-ONLY** (probed run 44): github.com 200; api.supabase.com + railway both fail
  (HTTP 000 / curl exit 56). The TODO header's "Supabase Management API allowlisted" is WRONG here.
  Deploy = push to `main` -> GitHub Actions ships railway+vercel. Live-URL / migration-apply is NOT
  reachable from an auto-run; defer all live verify + migration-apply to an interactive session.
- **The Edit/Write file-tools TRUNCATE files on this mount.** Use `python3` string-replace (or a heredoc
  whole-file write) in bash for ALL file edits, then verify `wc -l` + `tail`. Never trust the Edit tool here.
- **NUL-byte check the RIGHT way:** `tr -cd '\000' < file | wc -c` (must be 0). `grep -c $'\x00'` is USELESS.
- Sensitive large files to edit ONLY via python string-replace: `server/src/routes/admin.ts`,
  `lib/api.ts`, `server/test/helpers/supabaseMock.ts` (mock's two table literals use DIFFERENT
  indentation -- replace separately).
- deploy.yml has `paths-ignore` for `**.md`/`docs/**`/`scripts/**`/`e2e/**` -- doc/MD edits do NOT deploy.
- **On this Windows mount you cannot `rm` files in `.git`** ("Operation not permitted") but you CAN `mv`.
  `scripts/git-precheck.sh` self-heals stale `*.lock` files -- run it at start.
- **Migration 031** (`031_account_last_seen.sql`) STILL UNAPPLIED -- `/api/admin/online` 500s live until
  applied. Interactive/network run only:
  `SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/031_account_last_seen.sql`

## PENDING LIVE VERIFY (deferred to an interactive/network run)
- **31 migration + 21.1 live half:** apply 031, then curl each of the 24 admin routes with an admin JWT,
  confirm 200 + shape per `docs/admin-audit.md`, fill the live status into the Verdict column, THEN mark 21.1 [x].
- **21.9 live half:** confirm an account's `equity`/`margin_level_pct` on the user-search list match its
  row in the Accounts analytics leaderboard.
- 18.8a robot-runs, 18.8c price-alerts log, 18.8e/f transactions type-filter, 21.x admin slices
  (positions, force-close/modify, analytics, trades blotter, online, notify, CSV export) --
  backend-shipped + offline-tested, awaiting live-DB confirm.
- Visual sub-items: 18.2 chart tools, 18.3 light/dark mode, 18.8b/18.8d screen UIs -- screenshot run.

## To unblock future auto-runs
(a) grant network egress (railway/supabase/Claude API) for the live-verify items + migration 031;
(b) approve building 21.11 (credit bucket -- a product decision); or (c) decompose Phase 22
(Gamification -- still just a heading, ZERO `## 22.x` sub-items) and 18.3 (light/dark, recommend split
18.3a-g) into sized `## x.y` sub-items with offline-checkable acceptance. No easy box-tick wins remain;
every open `[ ]` is real blocked/parked/gated/dependency-blocked work.

## Prior runs (pruned)
- Runs 21-39: AUDIT-ONLY exits; every concrete item blocked/parked/gated/undecomposed.
- Runs 25-27: stray `**Files:**` box tidies for already-shipped 21.1/21.8/21.9 (now fully cleared).
- Runs 11-13: admin backend slices (18.8a/c, 18.8e/f) shipped, offline-tested green.
