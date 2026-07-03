# STATE -- handoff notes for the next agent

## (auto, run 51) 2026-07-04 00:12 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (git-precheck renamed 3 stale locks aside via mv: index.lock/HEAD.lock/objects/maintenance.lock,
age ~14264s; branch=main OK, author OK, tree clean). Client `tsc --noEmit` exit 0; server `tsc --noEmit`
exit 0; `npm test` **285 passing** (27 files) -- identical to runs 44-50. Egress re-probed live this run:
github.com 200; api.supabase.com HTTP 000 (curl exit 56); railway /health 000 -- STILL github-only,
confirming the TODO header's "Supabase Mgmt API allowlisted" line is WRONG for this sandbox.
Independently re-walked the FULL unchecked `[ ]` list top-to-bottom (read each item's full text + surrounding
`>` notes; file ends L1292, Phase 22 STILL a bare heading -- `grep -c '^## 22\.'` = 0). Identical
blocked/parked/gated/undecomposed/visual set as runs 21-50, no box-tick wins:
- PARKED/externally-gated (skip per header): R.7 BetterStack (L160), 5.3 Sumsub (L485), 8.1 OANDA (L550),
  9.3/9.4 stores (L582/586), 10.1-10.6 domain (L597-624), 20.2 forgot-pw (L1085).
- 18.2 chart drawing (L835): interactive + `chart_drawings` round-trip + visual.
- 18.3 light/dark (L847): ~58-component themed-lookup refactor, VISUAL acceptance; not decomposed 18.3a-g.
- 18.7 AI assistant (L999): Claude API key + network + live verify + multi-page chat UI.
- 18.8 (L911): oversized parent; offline backend slices all shipped under Phase 21; remaining sub-pages visual.
- 21.1 admin audit (L1185): static audit done in docs/admin-audit.md; box needs a LIVE 200 per route (network).
- 21.7 KYC (L1227): live doc upload + signed Storage image preview -> visual + network.
- 21.11 credit bucket (L1251): *(optional)* product/business decision -- not autonomous.
- 21.12 stop-out (L1257): depends on 21.14 (not done) -> dependency unmet.
- 21.14 account groups (L1268): large/undecomposed -- needs a design/decomposition pass first.
- Phase 22 (Gamification): STILL a bare heading, ZERO `## 22.x` items.
No file changed except this STATE.md entry. Markdown-only -> NO deploy (deploy.yml paths-ignore covers
`**.md`). Committing STATE.md only. Migration 031 STILL UNAPPLIED (network gated). Do NOT fabricate work.


## (auto, run 50) 2026-07-03 20:08 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (git-precheck renamed 1 stale `.git/objects/maintenance.lock` age ~23243s via mv; branch=main
OK, author OK, tree clean). Client `tsc --noEmit` exit 0; server `tsc --noEmit` exit 0; `npm test`
**285 passing** (27 files) -- identical to runs 44-49. Egress re-probed live this run: github.com 200;
api.supabase.com HTTP 000 (exit 56); pepqcrzbxyuhwqesuejk.supabase.co 000; railway /health 000 -- STILL
github-only, confirming the TODO header's "Supabase Mgmt API allowlisted" line is WRONG for this sandbox.
Independently re-walked the FULL unchecked `[ ]` list top-to-bottom (read each item's full text + surrounding
`>` notes; also read file tail -- Phase 22 is STILL a bare heading, file ends L1293, ZERO `## 22.x` items) --
identical blocked/parked/gated/undecomposed/visual set as runs 21-49, no box-tick wins:
- PARKED/externally-gated (skip per header): R.7 BetterStack (L160), 5.3 Sumsub (L485), 8.1 OANDA (L550),
  9.3/9.4 stores (L582/586), 10.1-10.6 domain (L597-624), 20.2 forgot-pw (L1085).
- 18.2 chart drawing (L835): interactive + `chart_drawings` round-trip + visual.
- 18.3 light/dark (L847): ~58-component themed-lookup refactor, VISUAL acceptance; not decomposed 18.3a-g.
- 18.7 AI assistant (L999): Claude API key + network + live verify + multi-page chat UI.
- 18.8 (L911): oversized parent; offline backend slices all shipped under Phase 21; remaining sub-pages visual.
- 21.1 admin audit (L1185): static audit done in docs/admin-audit.md; box needs a LIVE 200 per route (network).
- 21.7 KYC (L1227): live doc upload + signed Storage image preview -> visual + network.
- 21.11 credit bucket (L1251): *(optional)* product/business decision -- not autonomous.
- 21.12 stop-out (L1257): depends on 21.14 (not done) -> dependency unmet.
- 21.14 account groups (L1268): large/undecomposed -- needs a design/decomposition pass first.
- Phase 22 (Gamification): STILL a bare heading, ZERO `## 22.x` items.
No file changed except this STATE.md entry. Markdown-only -> NO deploy (deploy.yml paths-ignore covers
`**.md`). Committing STATE.md only. Migration 031 STILL UNAPPLIED (network gated). Do NOT fabricate work.


## (auto, run 49) 2026-07-03 13:40 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (git-precheck renamed 3 stale locks aside via mv: index.lock/HEAD.lock/objects/maintenance.lock,
age ~48550s; branch=main OK, author OK, tree clean). Client `tsc --noEmit` exit 0; server `tsc --noEmit`
exit 0; `npm test` **285 passing** (27 files) -- identical to runs 44-48. Egress re-probed live this run:
github.com 200; api.supabase.com HTTP 000; railway /health HTTP 000 (curl exit 56 -- STILL github-only).
Independently re-walked the FULL unchecked `[ ]` list top-to-bottom (read each item's full text + surrounding
`>` notes, did NOT just trust the handoff) -- identical blocked/parked/gated/undecomposed/visual set as runs
21-48, no box-tick wins:
- PARKED/externally-gated (skip per header): R.7 BetterStack (L160), 5.3 Sumsub (L485), 8.1 OANDA (L550),
  9.3/9.4 stores (L582/586), 10.1-10.6 domain (L597-624), 20.2 forgot-pw (L1085).
- 18.2 chart drawing (L835): interactive + `chart_drawings` round-trip + visual.
- 18.3 light/dark (L847): ~58-component themed-lookup refactor, VISUAL acceptance; not decomposed 18.3a-g.
- 18.7 AI assistant (L999): Claude API key + network + live verify + multi-page chat UI.
- 18.8 (L911): oversized parent; offline backend slices all shipped under Phase 21; remaining sub-pages visual.
- 21.1 admin audit (L1185): static audit done in docs/admin-audit.md; box needs a LIVE 200 per route (network).
- 21.7 KYC (L1227): live doc upload + signed Storage image preview -> visual + network.
- 21.11 credit bucket (L1251): *(optional)* product/business decision -- not autonomous.
- 21.12 stop-out (L1257): depends on 21.14 (not done) -> dependency unmet.
- 21.14 account groups (L1268): large/undecomposed -- needs a design/decomposition pass first.
- Phase 22 (Gamification): STILL a bare heading (file ends L1292), ZERO `## 22.x` items.
No file changed except this STATE.md entry. Markdown-only -> NO deploy (deploy.yml paths-ignore covers
`**.md`). Committing STATE.md only. Migration 031 STILL UNAPPLIED (network gated). Do NOT fabricate work.


## (auto, run 48) 2026-07-03 00:07 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (git-precheck renamed 3 stale locks aside via mv: index.lock/HEAD.lock/objects/maintenance.lock,
age ~14277s; branch=main OK, author OK, tree clean). Client `tsc --noEmit` exit 0; server `tsc --noEmit`
exit 0; `npm test` **285 passing** (27 files) -- identical to runs 44-47. Egress re-probed live this run:
github.com 200; api.supabase.com HTTP 000 / curl exit 56 (STILL github-only). Independently re-walked the
FULL unchecked `[ ]` list top-to-bottom (read each item's full text + surrounding `>` notes, did NOT just
trust the handoff) -- identical blocked/parked/gated/undecomposed/visual set as runs 21-47, no box-tick wins:
- PARKED/externally-gated (skip per header): R.7 BetterStack (L160), 5.3 Sumsub (L485), 8.1 OANDA (L550),
  9.3/9.4 stores (L582/586), 10.1-10.6 domain (L597-624), 20.2 forgot-pw (L1085).
- 18.2 chart drawing (L835): interactive + `chart_drawings` round-trip + visual.
- 18.3 light/dark (L847): ~58-component themed-lookup refactor, VISUAL acceptance; not decomposed 18.3a-g.
- 18.7 AI assistant (L999): Claude API key + network + live verify + multi-page chat UI.
- 18.8 (L911): oversized parent; offline backend slices all shipped under Phase 21; remaining sub-pages visual.
- 21.1 admin audit (L1185): static audit done in docs/admin-audit.md; box needs a LIVE 200 per route (network).
- 21.7 KYC (L1227): live doc upload + signed Storage image preview -> visual + network.
- 21.11 credit bucket (L1251): *(optional)* product/business decision -- not autonomous.
- 21.12 stop-out (L1257): depends on 21.14 (not done) -> dependency unmet.
- 21.14 account groups (L1268): large/undecomposed -- needs a design/decomposition pass first.
- Phase 22 (Gamification): STILL a bare heading (file ends L1292), ZERO `## 22.x` items.
No file changed except this STATE.md entry. Markdown-only -> NO deploy (deploy.yml paths-ignore covers
`**.md`). Committing STATE.md only. Migration 031 STILL UNAPPLIED (network gated). Do NOT fabricate work.


## (auto, run 47) 2026-07-02 18:07 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (git-precheck renamed 3 stale locks aside via mv: index.lock/HEAD.lock/objects/maintenance.lock,
age ~14306s; branch=main OK, author OK, tree clean). Client `tsc --noEmit` exit 0; server `tsc --noEmit`
exit 0; `npm test` **285 passing** (27 files) -- identical to runs 44-46. Network re-probed: github.com 200;
api.supabase.com + railway/health both HTTP 000 (egress STILL github-only). Independently re-walked the
FULL unchecked `[ ]` list top-to-bottom (read each item's full text + surrounding `>` notes) -- identical
blocked/parked/gated/undecomposed/visual set as runs 21-46, no box-tick wins:
- PARKED/externally-gated (skip per header): R.7 BetterStack (L160), 5.3 Sumsub (L485), 8.1 OANDA (L550),
  9.3/9.4 stores (L582/586), 10.1-10.6 domain (L597-624), 20.2 forgot-pw (L1084).
- 18.2 chart drawing (L835): interactive + `chart_drawings` round-trip + visual.
- 18.3 light/dark (L847): ~58-component themed-lookup refactor, VISUAL acceptance; not decomposed 18.3a-g.
- 18.7 AI assistant (L998): Claude API key + network + live verify + multi-page chat UI.
- 18.8 (L910): oversized parent; offline backend slices all shipped under Phase 21; remaining sub-pages visual.
- 21.1 admin audit (L1185): static audit done in docs/admin-audit.md; box needs a LIVE 200 per route (network).
- 21.7 KYC (L1227): live doc upload + signed Storage image preview -> visual + network.
- 21.11 credit bucket (L1251): *(optional)* product/business decision -- not autonomous.
- 21.12 stop-out (L1257): depends on 21.14 (not done) -> dependency unmet.
- 21.14 account groups (L1268): large/undecomposed -- needs a design/decomposition pass first.
- Phase 22 (Gamification): STILL a bare heading (file ends L1292), ZERO `## 22.x` items.
No file changed except this STATE.md entry. Markdown-only -> NO deploy (deploy.yml paths-ignore covers
`**.md`). Committing STATE.md only. Migration 031 STILL UNAPPLIED (network gated). Do NOT fabricate work.


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
