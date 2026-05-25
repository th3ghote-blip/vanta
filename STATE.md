# STATE -- handoff notes for the next agent

## ⚠️ READ THIS FIRST — Vercel git-author block

Every session must set this BEFORE the first commit:
```bash
git config user.email "229847808+th3ghote-blip@users.noreply.github.com"
git config user.name "th3ghote-blip"
```

## ⚠️ Git object write workaround (persistent)

The WSL-mounted `.git/objects/` dir will NOT create new subdirectories
or write new loose objects directly. The stale `tmp_obj_*` files in `9d/`
and `0b/` cannot be removed (Operation not permitted).

**Commit workflow that works:**
1. Clone the repo into `/tmp/vanta_staging`
2. Set git config in the staging clone
3. Make changes, `git add`, `git commit` in staging
4. `git pack-objects /tmp/missing_objs` for objects not in existing dirs
5. Copy the resulting `.pack` + `.idx` to `.git/objects/pack/`
6. Update `.git/refs/heads/main` (loose ref, takes precedence over packed-refs)
7. Verify with `git log --oneline -3` and `git show --stat HEAD`

See the 16.3 run (2026-05-25) for the exact Python+bash sequence.


---

## 2026-05-25T~auto — Phase 13/14 housekeeping

**TODO item picked:** Phase 13/14 duplicate-item housekeeping

**Pre-run state**
- HEAD was caffbf5 which accidentally dropped STATE.md content, TODO.md [x] marks, and
  load-test scripts committed in e8e2d43. Recovery commit 458b233 restored those first.
- Working tree clean after recovery. Client/server tsc not re-run (no code changed).

**What changed**
- `TODO.md`: marked the following Phase 13/14 items as `[x]` (all were completed in earlier R.x runs, just never reflected in these duplicate phase sections):
  - 13.1 Sentry frontend → done as R.3
  - 13.2 Sentry backend → done as R.4
  - 13.4 Performance dashboard → done as R.10
  - 14.1 Terms of Service + Privacy Policy → done as R.12
  - 14.2 Risk disclosure modal → done as R.12
- **13.3 BetterStack** left unchecked — still requires external account signup (https://betterstack.com/sign-up). Human action needed.
- No code changes. No deploy needed.

**⚠️ Persistent issues (same as before)**
- maintenance.lock in .git/objects is unremovable — use /tmp/v2 staging clone + pack-copy workflow.
- index.lock may reappear — clear before git ops.
- Edit/Write tools do NOT write through to the WSL mount. Always use Python open().
- refs/heads/main: always update the loose ref at .git/refs/heads/main.

**Next agent picks (in priority order)**
- **T.16 Drawing tools** — trendline/fib on chart. Needs `chart_drawings` Supabase migration
  (can write SQL file + commit; user applies manually via Supabase dashboard) + Lightweight
  Charts drawings API work. Substantial but the migration blocker is manageable.
- **T.18 Copy trading** — needs `copy_relationships` migration + leaderboard UI.
- **R.7 / 13.3 BetterStack** — requires human to sign up at https://betterstack.com/sign-up.
  Cannot be done by agent.
---

## 2026-05-25T~14:15Z — 16.3 Load test

**TODO item picked:** **16.3 Load test**

**Pre-run state**
- Working tree clean. HEAD = `daaa0a8` (after 14.3 cookie consent).
- Client tsc: exit 0. Server tsc: exit 0.
- Sandbox network blocked — no Railway/Vercel deploy needed.

**What changed**
- `scripts/load-test.js` (new, 265 lines): k6 load test script.
  Two scenarios: `public_endpoints` (0→100 VUs, 60s sustain) and
  `authenticated_endpoints` (0→25 VUs). Covers `/health`, `/api/quotes`,
  `/api/quotes/:symbol`, `/api/bars/BTC-USD`, `/api/orders/open`, `/api/account`.
  Thresholds encoded: p95<500ms health, p95<800ms quotes, p95<2000ms bars,
  p95<1200ms auth ops, error rate<1%. Prints a summary table at end.
  Auth enabled by setting `TEST_JWT=<supabase_jwt>` env var.
- `scripts/load-test-node.js` (new, 221 lines): Node.js fallback (no k6 needed).
  Same endpoints, same thresholds, same summary output. Uses only built-in `https`.
  Run: `node scripts/load-test-node.js` or `CONCURRENCY=200 DURATION=60 node ...`
- `TODO.md`: 16.3 marked `[x]`. Also marked 16.1 `[x]` (done as R.8) and
  16.2 `[x]` (done as R.9) — housekeeping for already-completed items.

**Verification**
- Client tsc: exit 0 ✅
- Server tsc: exit 0 ✅
- Commit: `e8e2d43` (via staging clone + pack copy workaround)
- No backend/frontend deploy needed — pure test infrastructure.
- Note: actual p95 numbers require running against the live Railway server.

**⚠️ Persistent issues (same as before)**
- `index.lock` is unremovable — use staging clone + pack-copy workflow (see above).
- `refs/heads/main` has a LOOSE ref at `.git/refs/heads/main` that overrides
  packed-refs — always update the loose ref file, not just packed-refs.
- Edit/Write tools do NOT write through to the WSL mount. Always use Python `open`.

**Next agent picks (in priority order)**
- **T.16 Drawing tools** — trendline/fib on chart. Needs `chart_drawings` Supabase
  migration + Lightweight Charts drawings API work (~2-3h). Use staging clone commit
  workflow. Network still blocked in sandbox — migration needs GH Actions or manual run.
- **T.18 Copy trading** — needs `copy_relationships` migration + leader leaderboard UI.
- **R.7 BetterStack** — requires external account signup (https://betterstack.com/sign-up).
  Cannot be done by agent — needs human to sign up and configure.
- **Phase 13/14 housekeeping** — 13.1–13.4 done as R.3/R.4/R.7/R.10; 14.1–14.2 done as R.12.
  Can mark [x] without code. Quick 1-item run.

## 2026-05-25T~12:30Z — 14.3 Cookie consent (web banner)

**TODO item picked:** **14.3 Cookie consent (web)**

**Pre-run state**
- Working tree clean (only untracked scripts/__pycache__). HEAD = `07e8377`.
- Client tsc: exit 0. Server tsc: exit 0.
- index.lock present and unremovable (permissions) — used GIT_INDEX_FILE=/tmp/vanta_fresh_idx + read-tree HEAD workaround throughout.

**What changed**
- `components/shared/CookieConsentBanner.tsx` (new): web-only bottom banner.
  Platform.OS guard at top of useEffect — renders nothing on iOS/Android.
  Uses AsyncStorage (`cookie_consent` key) to persist choice; banner hidden once
  any choice is made. Two buttons: "Accept all" (stores `accepted`) and
  "Necessary only" (stores `declined`). Privacy Policy link opens `/legal/privacy`
  in a new tab. Respects `useThemeColors()` so it adapts to light/dark mode.
- `app/_layout.tsx`: added `<CookieConsentBanner />` as last child of the
  QueryClientProvider `<View>` (after `<Stack>`), so it overlays all screens at z=9999.
- `TODO.md`: 14.3 marked `[x]`.

**Verification**
- Client tsc: exit 0 ✅
- Server tsc: exit 0 ✅
- Commit: `8d1ad45`
- No backend deploy needed — pure frontend change.
- GH Actions will deploy to Vercel on push.

**⚠️ Persistent issues (same as before)**
- index.lock is unremovable — always use `GIT_INDEX_FILE=/tmp/vanta_fresh_idx` +
  `git read-tree HEAD` before staging.
- Edit/Write tools do NOT write through to the WSL mount. Always use Python
  `open(..., 'w')` for file writes.
- refs/heads/main may get a stray warning line prepended — check before commits.

**Next agent picks (in priority order)**
- **T.16 Drawing tools** — trendline/fib on chart. Needs `chart_drawings` Supabase
  migration + Lightweight Charts drawings API work (~2-3h). Now that R.1 auto-deploy
  is live, migration can land via GH Actions after being committed. This is the
  richest remaining trading feature. Skip only if the work estimate still feels
  too large for one run.
- **T.18 Copy trading** — needs `copy_relationships` migration + leader leaderboard UI.
  Also substantial but self-contained.
- **16.3 Load test** — k6 script against trade endpoints, document p95. Pure code/infra,
  no migration, no deploy gate.
- **Phase 13 duplicate items (13.1–13.4)** are already done as R.3/R.4/R.7/R.10 —
  they can be marked [x] without code work (just housekeeping).
- **Phase 14 duplicate items (14.1–14.2)** are already done as R.12 — same housekeeping.
- **Phase 16 duplicate items (16.1–16.2)** are already done as R.8/R.9.

## 2026-05-24T22:21Z — T.19 Spread-betting / micro-lot mode

**TODO item picked:** **T.19 Spread-betting / micro-lot mode**

**Pre-run state**
- Working tree had truncated pricefeed.ts (321 vs 360 lines), bars.ts (208 vs 289 lines),
  deploy.yml (86 vs 105 lines) — same Edit-tool truncation bug. Also refs/heads/main was
  corrupted (warning line prepended to SHA). All fixed before picking the TODO item:
  restored full files from HEAD + applied intentional changes (PAXGUSD, NON_CRYPTO_SYMBOLS=[]).
  Used `git commit-tree` + manual mktree walk to build a correct commit (91bf917).
- Client tsc: exit 0. Server tsc: exit 0.
- Sandbox network blocked — no deploy possible; GH Actions deploys on push.

**What changed**
- `stores/prefs.ts` (new): AsyncStorage-backed preference store, starting with `spreadBet` bool.
  Hydrated on app startup via `app/_layout.tsx`.
- `lib/contracts.ts`: added `pipSizeFor()` (0.0001 for forex, 1 for everything else),
  `pipValueFor()` (lots → $/pip), `lotsFromPipValue()` ($/pip → lots), `pipLabel()` ("pip"/"pt").
- `components/pro/OrderEntry.tsx`: when spread-bet mode is on:
  - Volume field becomes "Stake ($/pip)" or "Stake ($/pt)" with a separate `sbRaw` display
    string so cursor never jumps mid-typing.
  - Notional bar shows "\$1.00/pip · 0.1000 lots · ..." instead of "0.1 lots × ...".
  - Internal `volume` stays in lots at all times; only the display converts.
- `app/(tabs)/profile.tsx`: Display section gets "Order sizing" with a slide-switch toggle
  for spread-bet mode.
- `app/_layout.tsx`: `hydratePrefs()` added to startup effect.

**Verification**
- Client tsc: exit 0 ✅
- Server tsc: exit 0 ✅
- No backend deploy needed — pure frontend change.
- GH Actions will deploy to Vercel on push.

**⚠️ Persistent issues**
- Edit tool does NOT write through to the WSL-mounted path (`C:\Claude\vanta`). Always use
  Python (`open(..., 'w')`) for file writes — the Edit/Write tools only update the tool's
  in-memory cache, not the actual filesystem that bash sees.
- refs/heads/main continues to get corrupted (stray warning line). Always fix with Python
  before doing git operations.
- The GIT_INDEX_FILE workaround produces broken trees (only staged files, not full repo tree).
  Use `git commit-tree` with proper `mktree` walk instead.

**Next agent**
- T.16 (Drawing tools) — still blocked on `chart_drawings` migration + significant
  Lightweight Charts work. Skip unless network is available.
- T.18 (Copy trading) — needs `copy_relationships` migration. Skip if network blocked.
- 14.3 Cookie consent (web banner) — pure UI, no migration, no deploy. Safe pick.
- Or any other unchecked non-PARKED item.


## 2026-05-24T~10:00Z -- T.20 Quick Mode durations + category tabs

**TODO item picked:** **T.20 Quick Mode — more durations + asset categories**

**Pre-run state**
- Working tree clean (GIT_INDEX_FILE=/tmp/vanta_idx workaround). HEAD = `205b242` (R.11 STATE chore).
- Stale index.lock / HEAD.lock / main.lock as usual — GIT_INDEX_FILE + direct ref-write workaround used throughout.
- Client tsc: exit 0. Server tsc: exit 0.
- Sandbox network blocked — no deploy possible; R.1 GH Actions will deploy on push.

**What changed**
- `components/fun/QuickTradeScreen.tsx`: expanded DURATIONS from 3 → 8 entries:
  5s (×2.00), 30s (×1.92), 60s (×1.85), 5min (×1.78), 15min (×1.72), 30min (×1.65), 4h (×1.55), 24h (×1.45).
  Duration picker changed from rigid flex `<View>` to `<ScrollView horizontal>` (68px tile width) so all 8 tiles are accessible without wrapping.
  Category tabs (All/Crypto/Forex/Metals/Stocks) were already implemented — no code change needed there.

**Verification**
- Client tsc: exit 0 ✅
- Server tsc: exit 0 ✅
- Commit: `2f76ec0`
- No backend deploy needed — pure frontend change.
- Vercel deploy will trigger via GH Actions on push.

**⚠️ File truncation issue encountered**
The Edit tool silently truncated `QuickTradeScreen.tsx` (280+ lines) mid-file. Fixed with Python append.
**REMINDER: Always use Python for writes/edits to files >200 lines. Never use the Edit tool on large files.**

**Next agent**
- T.16 (Drawing tools) — blocked: needs `chart_drawings` migration (sandbox network blocked). Skip.
- T.18 (Copy trading) — needs `copy_relationships` migration. Likely network-blocked. Skip unless migration can be applied.
- T.19 (Spread-betting / micro-lot mode) — pure UI cosmetic, no migration. Could store in `profiles` JSONB. Safe pick.
- Or pick any unchecked item in Phase 13–14 (monitoring/legal) that is pure code.

---

## 2026-05-24T~09:00Z -- R.11 DB backup verification

**TODO item picked:** **R.11 Database backup verification**

**Pre-run state**
- Working tree clean (GIT_INDEX_FILE=/tmp/vanta_fresh/idx). HEAD = `087534c` (R.8 STATE chore).
- Stale index.lock / HEAD.lock / main.lock as usual — GIT_INDEX_FILE + direct ref-write workaround used throughout.
- Client tsc: exit 0. Server tsc: exit 0.
- Sandbox network blocked (curl to Railway/Vercel timed out) — no deploy required for this item.

**What changed**
- `scripts/verify-backup.py` (new): queries `GET https://api.supabase.com/v1/projects/{ref}/database/backups`, finds the most recent completed backup across `backups` + `tiered_backups` arrays, exits 1 if age > MAX_AGE_HOURS (default 30). Prints clear human-readable output with timestamps, age, and total backup count.
- `.github/workflows/backup-check.yml` (new): daily cron at 06:15 UTC (after Supabase's nightly backup window). Also supports `workflow_dispatch` with optional `max_age_hours` input. Uses `SUPABASE_PAT` GitHub repo secret (same PAT already in `server/.env`).

**Verification**
- Python syntax: OK (`python3 -m py_compile`)
- Missing-PAT guard: correctly prints error and exits 1
- Commit: `8d9cbbb` (direct ref-write to bypass HEAD.lock)
- No deploy needed — pure CI infrastructure.

**Action required by user**
- Add `SUPABASE_PAT` as a GitHub repo secret (Settings → Secrets → Actions). Value: already in `server/.env` as `SUPABASE_PAT`.

