# STATE -- handoff notes for the next agent

## (auto, run 62) 2026-07-06 15:12 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (git-precheck renamed 1 stale lock aside via mv: objects/maintenance.lock, age ~39847s;
branch=main OK, author OK, tree clean). Client `tsc --noEmit` exit 0; server `tsc --noEmit` exit 0;
`npm test` **285 passing** (27 files, 9.74s) -- identical to runs 44-61. Did NOT re-probe egress (header
says live/network checks do not apply and must not gate an auto-run; handoff establishes github-only).
Independently re-walked the FULL unchecked list (`grep -c '^\s*- \[ \]'` = 33 lines = ~16 distinct items,
matching the documented set exactly; body line numbers unchanged: 18.2@835, 18.3@847, 18.8@911, 18.7@999,
21.1@1185, 21.7@1227, 21.11@1251, 21.12@1257, 21.14@1268) and read the 18.2/18.3 (L835-853) and
21.11/21.12/21.14 (L1250-1271) bodies + Phase 22 tail (L1287-1292) directly. Phase 22 STILL a bare heading
+ intro prose (`grep -c '^## 22\.'` = 0); file ends L1292. Identical blocked/parked/gated/undecomposed/
visual set as runs 21-61, no box-tick wins:
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



## (auto, run 61) 2026-07-06 04:07 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (git-precheck renamed 3 stale locks aside via mv: index.lock/HEAD.lock/objects/maintenance.lock,
age ~14320s; branch=main OK, author OK, tree clean). Client `tsc --noEmit` exit 0; server `tsc --noEmit`
exit 0; `npm test` **285 passing** (27 files, 3.62s) -- identical to runs 44-60. Did NOT re-probe egress
(header says live/network checks do not apply and must not gate an auto-run; handoff establishes github-only).
Independently re-walked the FULL unchecked list (`grep -c '^\s*- \[ \]'` = 33 lines = ~16 distinct items,
matching the documented set; body line numbers unchanged: 18.2@835, 18.3@847, 18.8@911, 18.7@999,
21.1@1185, 21.7@1227, 21.11@1251, 21.12@1257, 21.14@1268). Phase 22 STILL a bare heading
(`grep -c '^## 22\.'` = 0). Identical blocked/parked/gated/undecomposed/visual set as runs 21-60, no
box-tick wins:
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


## (auto, run 60) 2026-07-06 00:07 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (git-precheck renamed 1 stale lock aside via mv: objects/maintenance.lock, age ~14302s;
branch=main OK, author OK, tree clean). Client `tsc --noEmit` exit 0; server `tsc --noEmit` exit 0;
`npm test` **285 passing** (27 files, 3.06s) -- identical to runs 44-59. Did NOT re-probe egress (header
says live/network checks do not apply and must not gate an auto-run; handoff establishes github-only).
Independently re-walked the FULL unchecked list (`grep '^\s*- \[ \]'` = 33 lines = ~16 distinct items,
matching the documented set) and read the 18.2 (L835), 18.3 (L847), 21.11/21.12/21.14 (L1251-1271) bodies
+ Phase 22 tail (L1287-1292) directly. Phase 22 STILL a bare heading (`grep -c '^## 22\.'` = 0); file ends
L1292. Identical blocked/parked/gated/undecomposed/visual set as runs 21-59, no box-tick wins:
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


## (auto, run 59) 2026-07-05 20:07 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (git-precheck renamed 1 stale lock aside via mv: objects/maintenance.lock, age ~14332s;
branch=main OK, author OK, tree clean). Client `tsc --noEmit` exit 0; server `tsc --noEmit` exit 0;
`npm test` **285 passing** (27 files, 8.26s) -- identical to runs 44-58. Did NOT re-probe egress (header
says live/network checks do not apply and must not gate an auto-run; handoff establishes github-only).
Independently re-walked the FULL unchecked list this run (`grep -c '^\s*- \[ \]'` = 33 lines = ~16
distinct items, matching the documented set exactly) and read the 18.3 body (L846-853) directly to confirm
it is still a ~58-component VISUAL themed-lookup refactor with visual acceptance -- not offline-verifiable
and not decomposed into 18.3a-g. Phase 22 STILL a bare heading (`grep -c '^## 22\.'` = 0). Identical
blocked/parked/gated/undecomposed/visual set as runs 21-58, no box-tick wins:
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


## (auto, run 58) 2026-07-05 16:06 UTC -- AUDIT-ONLY exit. No completable item. Tree healthy.
Precheck clean (git-precheck renamed 1 stale lock aside via mv: objects/maintenance.lock, age ~4875s;
branch=main OK, author OK, tree clean). Client `tsc --noEmit` exit 0; server `tsc --noEmit` exit 0;
`npm test` **285 passing** (27 files, 3.36s) -- identical to runs 44-57. Did NOT re-probe egress (header
says live/network checks do not apply and must not gate an auto-run; handoff establishes github-only).
Independently re-walked the FULL unchecked list this run (`grep -c '^\s*- \[ \]'` = 33 lines = ~16
distinct items) and read the bodies of 18.2 (L835), 18.3 (L847) and Phase 22 (L1287-1292) directly.
Phase 22 STILL a bare heading + intro paragraph -- ZERO `## 22.x` sub-items; file ends L1292. Identical
blocked/parked/gated/undecomposed/visual set as runs 21-57, no box-tick wins:
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
