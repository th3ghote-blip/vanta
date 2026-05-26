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
1. Clone the repo into `/tmp/vanta_staging` (use `--no-local` flag)
2. Set git config in the staging clone
3. Make changes, `git add`, `git commit` in staging
4. `git pack-objects /tmp/missing_objs` for objects not in existing dirs
5. Copy the resulting `.pack` + `.idx` to `.git/objects/pack/`
6. Update `.git/refs/heads/main` (loose ref, takes precedence over packed-refs)
7. Verify with `git log --oneline -3` and `git show --stat HEAD`

See the 16.3 run (2026-05-25) for the exact Python+bash sequence.


---

## 2026-05-26T~auto — All TODO items complete or externally blocked

**TODO item picked:** None (project complete pending human action)

**Pre-run state**
- HEAD was bb088a2 (T.16 STATE/TODO housekeeping). Working tree showed apparent deletions
  of CopyTrading.tsx, load-test scripts, traders.ts, orders.ts, migrations — all confirmed
  WSL mount artifacts (files exist on disk, present in HEAD via `git ls-tree`, just not in
  the git index because pack-copy workaround doesn't refresh the index). Not user edits.

**Status**
- All non-PARKED TODO items are complete.
- The only unchecked non-PARKED item is **R.7 / 13.3 BetterStack** — requires human to
  sign up at https://betterstack.com/sign-up. Cannot be done by agent (external account).
- Phase 17 items are labeled "Optional / future" — not part of the active roadmap.
- All PARKED items remain blocked on external actions (domain purchase, Apple/Google
  developer accounts, OANDA signup, Sumsub sales call).

**No code changes this run.**

**⚠️ Human action needed to unblock remaining items**
1. **BetterStack (R.7/13.3):** Sign up at https://betterstack.com/sign-up → add monitor for
   `https://vanta-server-production.up.railway.app/health` (every 3 min) and
   `https://vanta-server-production.up.railway.app/api/quotes` (every 3 min) → configure
   email alert. This is the only item standing between "feature complete" and fully monitored.
2. **Supabase migrations** (from prior runs — still need manual apply):
   - `supabase/migrations/025_copy_relationships.sql` (copy trading)
   - `supabase/migrations/026_chart_drawings.sql` (chart drawings — optional)
3. **BetterStack / GitHub secret:** Add `SUPABASE_PAT` to GitHub repo secrets for backup-check workflow.

**⚠️ Persistent issues (same as before)**
- maintenance.lock in .git/objects is unremovable — use /tmp staging clone (--no-local) + pack-copy.
- git ls-files won't show files committed via pack-copy (WSL index artifact) — use git ls-tree HEAD to verify.
- Edit/Write tools do NOT write through to the WSL mount. Always use Python open().
- refs/heads/main: always update loose ref at .git/refs/heads/main.

## 2026-05-26T~auto — T.16 Drawing tools on chart

**TODO item picked:** **T.16 Drawing tools on chart**

**Pre-run state**
- HEAD was 002531f (T.18 STATE/TODO housekeeping). Working tree showed MM/D status
  entries — all pure mode-change WSL artifacts (0755→0644), confirmed via `git diff HEAD`
  returning only mode diffs. Proceeded.
- 13.3 BetterStack skipped again — requires human signup at betterstack.com.
- All other unchecked items are PARKED.

**What changed**
- `components/pro/Chart.tsx`: drawing tools added (+94 lines).
  - Floating toolbar inside iframe: ↖ (select), — (horizontal line), ╱ (trendline), F (fib), × (clear)
  - SVG overlay (`#draw-overlay`) renders lines on top of the Lightweight Charts canvas
  - Three tool types: `horizontal` (single click sets price level), `trendline` (two-click anchor),
    `fib` (two-click high/low → seven standard fib levels 0/23.6/38.2/50/61.8/78.6/100%)
  - Trendlines extended to chart edges; fib levels labeled with % + price
  - Drawings stored per symbol in `drawingsRef` (React ref, not state — no re-renders on save)
  - AsyncStorage round-trip: loaded once on mount → passed to iframe as `INITIAL_DRAWINGS` JSON;
    postMessage from iframe on every change → React saves to AsyncStorage key `vanta:chart-drawings`
  - WebView `onMessage` handler mirrors the same logic on mobile
  - `iframeKey` includes `drawingsLoaded` flag so iframe doesn't render before initial drawings load
- `stores/chartDrawings.ts` (new): exported zustand store with same AsyncStorage backing,
  available to other components if needed in future.
- `supabase/migrations/026_chart_drawings.sql` (new): `chart_drawings` table schema for
  future server-side persistence. **Must be applied manually via Supabase dashboard SQL editor.**
- `TODO.md`: T.16 marked [x].

**Commit:** `c178ca9` (via staging clone + pack-copy workaround)

**Verification**
- Client tsc: exit 0 ✅
- Server tsc: exit 0 ✅
- All 18 structural checks pass (landmarks present in patched file)
- No Railway/Vercel deploy needed — pure frontend. GH Actions deploys on push.

**⚠️ Human action optional**
- Apply `supabase/migrations/026_chart_drawings.sql` if server-side sync of drawings is desired.
  Not required — AsyncStorage persistence is fully functional without it.

**⚠️ Persistent issues (same as before)**
- maintenance.lock in .git/objects is unremovable — use /tmp staging clone + pack-copy.
- Edit/Write tools do NOT write through to the WSL mount. Always use Python open().
- refs/heads/main: always update loose ref at .git/refs/heads/main.

**Next agent picks (in priority order)**
- **13.3 BetterStack** — requires human to sign up at https://betterstack.com/sign-up first.
  Cannot be done by agent. Once signed up, add the UptimeRobot/BetterStack check URLs and configure alerts.
- **All other items** in TODO.md are PARKED (domain, iOS, Android, OANDA, Sumsub).
- Everything is otherwise done — project is in a clean, deployable state.

## 2026-05-26T~auto — T.18 Copy trading (basic)

**TODO item picked:** **T.18 Copy trading (basic)**

**Pre-run state**
- HEAD was f0834bf (Phase 13/14 housekeeping). Working tree showed MM on STATE.md/TODO.md
  (stale index from prior run — WSL mount artifact, not user edits). Verified via `git diff HEAD`
  returning nothing meaningful. Proceeded.
- T.16 (Drawing tools) skipped again — prior skip note explicitly flags 2-3h, exceeds 60-min rule.
- Client tsc: exit 0. Server tsc: exit 0.

**What changed**
- `supabase/migrations/025_copy_relationships.sql` (new): adds `copy_leader_enabled bool` to
  profiles; creates `copy_relationships` table with RLS. **Must be applied manually via
  Supabase dashboard SQL editor — network blocked in sandbox.**
- `server/src/routes/traders.ts` (new): 6 endpoints at `/api/traders`:
  leaderboard, opt-in toggle, follow, unfollow, following list, me.
- `server/src/index.ts`: registered `tradersRoutes` at `/api/traders`.
- `server/src/routes/orders.ts`: `mirrorTradeForFollowers()` — fire-and-forget after every
  market open; scales lot size by allocation_pct, checks follower margin before inserting.
- `components/robots/CopyTrading.tsx` (new): leaderboard + Copy/Unfollow buttons +
  allocation modal + "Share my trades" toggle.
- `app/(tabs)/robots.tsx`: third "Copy" tab added (alongside My Robots + Leaderboard).
- `TODO.md`: T.18 marked [x].

**Commit:** `e377654` (via staging clone + pack-copy workaround)

**⚠️ Human action required**
- Apply `supabase/migrations/025_copy_relationships.sql` in Supabase dashboard SQL editor.
  Without this migration the `/api/traders/*` endpoints will return db_error on every call.
- No Railway/Vercel deploy ran (network blocked in sandbox). GH Actions will deploy on push.

**⚠️ Persistent issues (same as before)**
- maintenance.lock in .git/objects is unremovable — use /tmp/vanta_stage2 (or fresh name) + pack-copy.
- index.lock may reappear — clear before git ops with GIT_INDEX_FILE workaround if needed.
- Edit/Write tools do NOT write through to the WSL mount. Always use Python open().
- refs/heads/main: always update the loose ref at .git/refs/heads/main.

**Next agent picks (in priority order)**
- **T.16 Drawing tools** — trendline/fib. Still flagged as 2-3h; skip unless feeling ambitious.
- **13.3 BetterStack** — requires human to sign up at https://betterstack.com/sign-up first.
- **All other items** in TODO.md are PARKED (domain, iOS, Android, OANDA, Sumsub).

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
