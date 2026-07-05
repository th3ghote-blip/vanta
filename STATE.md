# STATE -- handoff notes for the next agent

## (auto, run 57) 2026-07-05 14:44 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (git-precheck renamed 3 stale locks aside via mv: index.lock/HEAD.lock/objects/maintenance.lock,
age ~38ks; branch=main OK, author OK, tree clean). Client `tsc --noEmit` exit 0; server `tsc --noEmit`
exit 0; `npm test` **285 passing** (27 files, 9.77s) -- identical to runs 44-56. Did NOT re-probe egress
(header says live/network checks do not apply and must not gate an auto-run; handoff establishes github-only).
Re-walked the FULL unchecked list this run (`grep -c '^\s*- \[ \]'` = 33 lines = ~16 distinct items) and
read the bodies of the borderline non-PARKED candidates directly: 21.12 (L1257, "Depends on 21.14"),
21.14 (L1268, item text says "design and scope as its own mini-phase" + prior SKIPPED note -> undecomposed),
18.7 (L999, has an explicit `>` BLOCKED note: Claude API key + network + live verify + multi-page chat UI).
Phase 22 STILL a bare heading (`grep -c '^## 22\.'` = 0); file ends L1292. Identical blocked/parked/gated/
undecomposed/visual set as runs 21-56, no box-tick wins:
- PARKED/externally-gated (skip per header): R.7 BetterStack (L160), 5.3 Sumsub (L485), 8.1 OANDA (L550),
  9.3/9.4 stores (L582/587), 10.1-10.6 domain (L598-624), 20.2 forgot-pw (L1085).
- 18.2 chart drawing (L835): interactive + `chart_drawings` round-trip + visual -> not offline-verifiable.
- 18.3 light/dark (L847): ~58-component themed-lookup refactor, VISUAL acceptance; not decomposed 18.3a-g.
- 18.7 AI assistant (L999): Claude API key + network + live verify + multi-page chat UI.
- 18.8 (L911): oversized parent; offline backend slices all shipped `[x]`; remaining sub-pages visual.
- 19.2 (L1169): parent [x]; only open box is a UI-only browser-verify sub-item (not offline-doable).
- 21.1 admin audit (L1185): static audit done in docs/admin-audit.md; acceptance = LIVE 200 per route (network).
- 21.7 KYC (L1227): live doc upload + signed Storage image preview -> visual + network.
- 21.11 credit bucket (L1251): *(optional)* product/business decision -- not autonomous.
- 21.12 stop-out (L1257): depends on 21.14 (not done) -> dependency unmet.
- 21.14 account groups (L1268): item text says "design and scope as its own mini-phase" -- undecomposed.
- Phase 22 (Gamification): STILL a bare heading, ZERO `## 22.x` items.
No file changed except this STATE.md entry. Markdown-only -> NO deploy (deploy.yml paths-ignore covers
`**.md`). Committing STATE.md only. Migration 031 STILL UNAPPLIED (network gated). Do NOT fabricate work.


## (auto, run 56) 2026-07-05 04:08 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (git-precheck renamed 1 stale lock aside via mv: objects/maintenance.lock, age ~14417s;
`.git/index.lock` unlink "Operation not permitted" is the known Windows-mount quirk, tree still reads clean;
branch=main OK, author OK). Client `tsc --noEmit` exit 0; server `tsc --noEmit` exit 0; `npm test`
**285 passing** (27 files, 12.66s) -- identical to runs 44-55. Did NOT re-probe egress (header says
live/network checks do not apply and must not gate an auto-run; handoff establishes github-only).
Independently re-walked the FULL unchecked list this run (`grep -c '^\s*- \[ \]'` = 33 lines = ~16 distinct
items) and read the bodies of every non-PARKED candidate directly: 18.2 (L835), 18.3 (L847), 18.7 (L999),
18.8 parent+sub-items 18.8a/c/e/f (L911-925, all backend slices `[x]`), 19.2 dangling UI sub-item (L1169),
21.1 (L1185), 21.7 (L1227), 21.11 (L1251), 21.12 (L1257), 21.14 (L1268), plus Phase 22 body (L1287-1292).
Phase 22 STILL a bare heading -- ZERO `## 22.x` sub-items; file ends L1292. Identical blocked/parked/gated/
undecomposed/visual set as runs 21-55, no box-tick wins:
- PARKED/externally-gated (skip per header): R.7 BetterStack (L160), 5.3 Sumsub (L485), 8.1 OANDA (L550),
  9.3/9.4 stores (L582/587), 10.1-10.6 domain (L598-624), 20.2 forgot-pw (L1085).
- 18.2 chart drawing (L835): interactive + `chart_drawings` round-trip + visual -> not offline-verifiable.
- 18.3 light/dark (L847): ~58-component themed-lookup refactor, VISUAL acceptance; not decomposed 18.3a-g.
- 18.7 AI assistant (L999): Claude API key + network + live verify + multi-page chat UI.
- 18.8 (L911): oversized parent; offline backend slices (18.8a/c/e/f) all shipped `[x]`; remaining sub-pages visual.
- 19.2 (L1169): parent `[x]`; only open box is a UI-only browser-verify sub-item (not offline-doable).
- 21.1 admin audit (L1185): static audit done in docs/admin-audit.md; acceptance = LIVE 200 per route (network).
- 21.7 KYC (L1227): live doc upload + signed Storage image preview -> visual + network.
- 21.11 credit bucket (L1251): *(optional)* product/business decision -- not autonomous.
- 21.12 stop-out (L1257): depends on 21.14 (not done) -> dependency unmet.
- 21.14 account groups (L1268): item text says "design and scope as its own mini-phase" -- undecomposed.
- Phase 22 (Gamification): STILL a bare heading, ZERO `## 22.x` items.
No file changed except this STATE.md entry. Markdown-only -> NO deploy (deploy.yml paths-ignore covers
`**.md`). Committing STATE.md only. Migration 031 STILL UNAPPLIED (network gated). Do NOT fabricate work.


## (auto, run 55) 2026-07-05 00:07 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (git-precheck renamed 3 stale locks aside via mv: index.lock/HEAD.lock/objects/maintenance.lock,
age ~14.26ks; branch=main OK, author OK, tree clean). Client `tsc --noEmit` exit 0; server `tsc --noEmit`
exit 0; `npm test` **285 passing** (27 files) -- identical to runs 44-54. Did NOT re-probe egress (header
says live/network checks do not apply and must not gate an auto-run; handoff establishes github-only).
Independently re-walked the FULL unchecked list this run via `grep -n '^\s*- \[ \]'` (same ~16 distinct
items) and read the 18.2 (L835), 18.3 (L847) bodies + Phase 22 body (L1287-1292) directly. Phase 22
STILL a bare heading -- ZERO `## 22.x` sub-items; file ends L1292. Identical blocked/parked/gated/
undecomposed/visual set as runs 21-54, no box-tick wins:
- PARKED/externally-gated (skip per header): R.7 BetterStack (L160), 5.3 Sumsub (L485), 8.1 OANDA (L550),
  9.3/9.4 stores (L582/587), 10.1-10.6 domain (L598-624), 20.2 forgot-pw (L1085).
- 18.2 chart drawing (L835): interactive + `chart_drawings` round-trip + visual -> not offline-verifiable.
- 18.3 light/dark (L847): ~58-component themed-lookup refactor, VISUAL acceptance; not decomposed 18.3a-g.
- 18.7 AI assistant (L999): Claude API key + network + live verify + multi-page chat UI.
- 18.8 (L911): oversized parent; offline backend slices all shipped under Phase 21; remaining sub-pages visual.
- 19.2 (L1169): parent [x]; only open box is a UI-only browser-verify sub-item (not offline-doable).
- 21.1 admin audit (L1185): static audit done in docs/admin-audit.md; acceptance = LIVE 200 per route (network).
- 21.7 KYC (L1227): live doc upload + signed Storage image preview -> visual + network.
- 21.11 credit bucket (L1251): *(optional)* product/business decision -- not autonomous.
- 21.12 stop-out (L1257): depends on 21.14 (not done) -> dependency unmet.
- 21.14 account groups (L1268): item text says "design and scope as its own mini-phase" -- undecomposed.
- Phase 22 (Gamification): STILL a bare heading, ZERO `## 22.x` items.
No file changed except this STATE.md entry. Markdown-only -> NO deploy (deploy.yml paths-ignore covers
`**.md`). Committing STATE.md only. Migration 031 STILL UNAPPLIED (network gated). Do NOT fabricate work.



## (auto, run 54) 2026-07-04 ~20:08 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (git-precheck renamed 3 stale locks aside via mv: index.lock/HEAD.lock/objects/maintenance.lock,
age ~14.3ks; branch=main OK, author OK, tree clean). Client `tsc --noEmit` exit 0; server `tsc --noEmit`
exit 0; `npm test` **285 passing** (27 files) -- identical to runs 44-53. Did NOT re-probe egress (header
says live/network checks do not apply and must not gate an auto-run; handoff establishes github-only).
Independently re-walked the FULL unchecked list this run: `grep -c '^\s*- \[ \]'` = 33 lines = ~16 distinct
items; read the FULL bodies of 18.2 (L834), 18.3 (L846), 21.1 (L1184), 21.12 (L1256), 21.14 (L1267), and
19.2's dangling UI sub-item (L1169) directly rather than trusting the handoff. Phase 22 confirmed STILL a bare
heading -- `grep '# Phase 22'` = L1287, ZERO `## 22.x` sub-items; file ends L1292 with just the intro para.
Identical blocked/parked/gated/undecomposed/visual set as runs 21-53, no box-tick wins:
- PARKED/externally-gated (skip per header): R.7 BetterStack (L160), 5.3 Sumsub (L485), 8.1 OANDA (L550),
  9.3/9.4 stores (L582/587), 10.1-10.6 domain (L598-624), 20.2 forgot-pw (L1085).
- 18.2 chart drawing (L834): interactive + `chart_drawings` round-trip + visual -> not offline-verifiable.
- 18.3 light/dark (L846): ~58-component themed-lookup refactor, VISUAL acceptance; not decomposed 18.3a-g.
- 18.7 AI assistant (L999): Claude API key + network + live verify + multi-page chat UI.
- 18.8 (L911): oversized parent; offline backend slices all shipped under Phase 21; remaining sub-pages visual.
- 19.2 (L1159): parent [x]; only open box is a UI-only browser-verify sub-item (not offline-doable).
- 21.1 admin audit (L1184): static audit done in docs/admin-audit.md; acceptance = LIVE 200 per route (network;
  header itself defers live-URL verification) -> cannot box-tick in an auto-run.
- 21.7 KYC (L1227): live doc upload + signed Storage image preview -> visual + network.
- 21.11 credit bucket (L1251): *(optional)* product/business decision -- not autonomous.
- 21.12 stop-out (L1256): depends on 21.14 (not done) -> dependency unmet.
- 21.14 account groups (L1267): item text itself says "design and scope as its own mini-phase" -- undecomposed.
- Phase 22 (Gamification): STILL a bare heading, ZERO `## 22.x` items.
No file changed except this STATE.md entry. Markdown-only -> NO deploy (deploy.yml paths-ignore covers
`**.md`). Committing STATE.md only. Migration 031 STILL UNAPPLIED (network gated). Do NOT fabricate work.


## (auto, run 53) 2026-07-04 ~UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (git-precheck renamed 3 stale locks aside via mv: index.lock/HEAD.lock/objects/maintenance.lock,
age ~2.4ks; branch=main OK, author OK, tree clean). Client `tsc --noEmit` exit 0; server `tsc --noEmit`
exit 0; `npm test` **285 passing** (27 files) -- identical to runs 44-52. Did NOT re-probe egress (header
says live/network checks do not apply and must not gate an auto-run; handoff already establishes github-only).
Independently re-walked the FULL unchecked `[ ]` list this run: `grep -c '^\s*- \[ \]'` = 33 lines = same
~16 distinct items; read the 18.2 (L835), 21.1 (L1185), 21.11 (L1251), 21.12 (L1257), 21.14 (L1268) bodies
directly. Phase 22 STILL a bare heading (`grep -c '^## 22\.'` = 0); file ends L1292. Identical
blocked/parked/gated/undecomposed/visual set as runs 21-52, no box-tick wins:
- PARKED/externally-gated (skip per header): R.7 BetterStack (L160), 5.3 Sumsub (L485), 8.1 OANDA (L550),
  9.3/9.4 stores (L582/587), 10.1-10.6 domain (L598-624), 20.2 forgot-pw (L1085).
- 18.2 chart drawing (L835): interactive + `chart_drawings` round-trip + visual.
- 18.3 light/dark (L847): ~58-component themed-lookup refactor, VISUAL acceptance; not decomposed 18.3a-g.
- 18.7 AI assistant (L999): Claude API key + network + live verify + multi-page chat UI.
- 18.8 (L911): oversized parent; offline backend slices all shipped under Phase 21; remaining sub-pages visual.
- 19.2 UI sub-item (L1169): browser-only verification of a checked parent (API E2E already green).
- 21.1 admin audit (L1185): static audit done in docs/admin-audit.md; box needs a LIVE 200 per route (network).
- 21.7 KYC (L1227): live doc upload + signed Storage image preview -> visual + network.
- 21.11 credit bucket (L1251): *(optional)* product/business decision -- not autonomous.
- 21.12 stop-out (L1257): depends on 21.14 (not done) -> dependency unmet.
- 21.14 account groups (L1268): large/undecomposed -- needs a design/decomposition pass first.
- Phase 22 (Gamification): STILL a bare heading, ZERO `## 22.x` items.
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
