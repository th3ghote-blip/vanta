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


---

## 2026-06-02T~auto — 18.5 Robot engine unit tests

**TODO item picked:** **18.5 Robot execution engine unit tests** (Phase 18; order-agnostic per header).

**Pre-run state**
- `git-precheck.sh`: clean, branch=main, author OK. HEAD = `0c82263`.
- Client tsc: exit 0. Server tsc: exit 0. (Live curl checks not run — sandbox network blocked, as always.)
- NOTE: git log shows 18.9 + 18.13 were already landed in code (commit `7f76011`) but their
  TODO checkboxes are still `[ ]`. Did NOT touch them this run (one item per run; not fabricating).
  Next agent: verify 18.9/18.13 implementations against acceptance criteria and just mark them [x]
  if they hold — likely free housekeeping wins.

**What changed**
- `server/test/robotEngine.test.ts` (new, 13 tests): covers the engine internals —
  - `shouldFire` interval (fires after interval / not too soon / zero-interval guard)
  - `shouldFire` cron `"0 9 * * 1-5"` (fires 09:00 Mon; not 09:01; not Saturday) + defensive unknown-type
  - `processRobot` trade+`always` → opens trade, logs `robot_runs.trade_opened`, increments `total_trades`
  - `processRobot` `max_concurrent=1` with an existing open robot trade → no new trade, logs `trade_failed`/`max_concurrent`
    (NOTE: engine logs action `trade_failed` not `skipped`; test asserts actual behavior)
  - `processRobot` `kind='tip'` → `sendPush` called, logs `tip_sent`, no trade
  - `openRobotTrade` direct → inserts `reason='robot'` trade, correct symbol/side/volume; fails cleanly on missing quote
  - `tick` → only `status='active'` robots fire; paused robot produces no `robot_runs` row
- `server/src/ai/robotEngine.ts`: added `export const _robotInternals = { shouldFire, matchesCron, matchField, matchesMarketEvent, processRobot, openRobotTrade, tick }` (test-only export, zero runtime impact — mirrors `_riskInternals` / `_ordersTriggerInternals`).
- `server/test/helpers/supabaseMock.ts`: backward-compatible enhancements so the engine's queries work under the mock —
  (1) `select(cols, { count:'exact', head:true })` now returns a `count`; (2) the `robots` embed (`accounts!inner`) now attaches the full account row (id/balance/free_margin/margin_used/leverage) and drops robots with no matching account (inner-join semantics).

**Verification**
- `npx vitest run test/robotEngine.test.ts`: 13/13 pass ✅
- Full suite `npx vitest run`: 160/160 pass (was 147; +13), 11 files ✅
- Server tsc: exit 0 ✅. Client tsc: exit 0 ✅.

**Deploy**
- None run — sandbox network blocked. Change is test-only + a no-op export; no runtime behavior change.
  GH Actions deploys on push. (No migration, no env, no frontend touched.)

**Commit:** see git log — `auto: 18.5 robot engine unit tests`.

**Persistent issues**
- File writes done via Python `open()` through bash (Edit/Write WSL-mount caveat from prior runs).
  git ops were clean this run — no lock/staging workaround needed.

**Next agent picks**
- Verify + check off **18.9** and **18.13** (already in code per commit 7f76011).
- Other Phase 18 items: 18.1, 18.2, 18.3, 18.10, 18.11, 18.12, 18.8, 18.7, 18.6, 18.4 — pick any
  fully completable in ~60 min. 18.6 needs a migration (network-blocked → write SQL + commit, user applies).
  18.7/18.8 are large. 18.1/18.3/18.13 are pure frontend UI.

