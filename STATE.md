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

See the 16.3 run (2026-05-25) for the exact Python+bash sequence.

---

## 2026-05-28T~auto — QA-2.4 Copy trading mirror logic tests

**TODO item picked:** **QA-2.4 Copy trading mirror logic tests** (TESTING.md)

**Pre-run state**
- Working tree had uncommitted changes from a prior agent run that tested but
  didn't commit. Changes were: export of `_copyTradeInternals` from orders.ts,
  copy_relationships support in supabaseMock.ts, and copyTrading.test.ts (new).
  TESTING.md already had QA-2.4 marked [x]. All 143 tests passed before commit.
  Treated as prior-agent incomplete work (not user edits) and committed it.

**What changed**
- `server/src/routes/orders.ts`: exported `_copyTradeInternals.mirrorTradeForFollowers`
  for hermetic testing without route wrapper overhead.
- `server/test/helpers/supabaseMock.ts`: added `DbCopyRelationship` interface,
  `copy_relationships` table, and `seed.copyRelationship()` helper.
- `server/test/copyTrading.test.ts` (new): 5 tests covering:
  - allocation_pct=50 → follower gets 0.05 BTC (half of leader 0.1 lot)
  - allocation_pct=100 → mirrors at full volume
  - Insufficient margin → mirror skipped, no error thrown
  - No followers → nothing inserted
  - SL/TP inherited by mirror trade
- `TESTING.md`: QA-2.4 already marked [x] by prior agent; no change needed.

**Verification**
- Server tsc: exit 0 ✅
- All 143 tests pass (9 test files) ✅
- No backend or frontend deploy needed — pure test infrastructure.

**⚠️ Persistent issues (same as before)**
- index.lock is unremovable — always use staging clone workflow.
- Edit/Write tools do NOT write through to the WSL mount. Always use Python
  `open(..., 'w')` for file writes.
- refs/heads/main may get a stray warning line prepended — fix before commits.

**Next agent picks (in priority order)**
- **BetterStack R.7/13.3** — requires human signup at https://betterstack.com/sign-up.
  Once signed up, ping `/health` and `/api/quotes` every 3-5 min with email alert.
- **All Phase 10 items** — PARKED, require domain purchase (vanta.markets ~$30/yr).
- **9.3 TestFlight** — PARKED, requires Apple Developer account ($99/yr).
- **9.4 Play Store** — PARKED, requires Google Play account ($25).
- **5.3 Sumsub** — PARKED, requires sales call + contract.
- **8.1 OANDA** — PARKED, requires user-provided API token.
- If user takes any of the above external steps, the corresponding items unblock.
- Phase 17 backlog items are optional future features — only pick if explicitly asked.

