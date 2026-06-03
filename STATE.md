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

## ⚠️ Stale index.lock (persistent, this environment)

`.git/index.lock` exists and CANNOT be removed (WSL permission, "Operation not
permitted"). `git-precheck.sh` reports it and prints a fallback index path.
**Workaround that works for read/status ops:** use a private index file:
```bash
export GIT_INDEX_FILE=/tmp/vanta_idx_run
git read-tree HEAD          # seed a fresh, clean index from HEAD
git status / git diff HEAD  # now reflect reality
```
For committing, use the staging-clone workflow above (it has its own index).

---

## 2026-06-03T~auto — 18.13 Trade row density (RE-LANDED, clobbered 3rd time)

**TODO item picked:** **18.13 Trade row density** (Phase 18; order-agnostic). Topmost
unchecked item; the prior run (18.9) flagged it as the likely next pick.

**Pre-run state**
- Working tree showed `M STATE.md` only (prior run's commit `c8e794a` captured a
  TRUNCATED STATE.md via the pack workaround — disk had the full text). All CODE
  files byte-identical to HEAD via clean `GIT_INDEX_FILE`. NOT a user mid-edit → safe.
- No network in sandbox (railway health = 000, no vercel CLI). Deploy activates on push
  via R.1 GitHub Actions — same as the 18.5/18.9 runs.

**The clobber (confirmed)**
- `0c82263` ("Fix smoke: dismiss cookie banner before buy", hand-authored, stale index)
  reverted `components/pro/TradeBook.tsx` back to the PRE-18.13 cramped layout
  (3-col, 14px P&L, 28px buttons, notional/margin line). HEAD still carried that revert
  (18.5 + 18.9 didn't touch TradeBook). So 18.13 was genuinely lost again — 3rd clobber.

**What changed**
- `components/pro/TradeBook.tsx` restored to the known-good `7f76011` version
  (`git show 7f76011:... > file`) — byte-identical, empty diff vs 7f76011. This is the
  18.13 layout: `minHeight: 56`, 18px color-coded P&L (largest number), 32px action
  buttons, 2-line rows, removed the cramped notional line + `notionalUSD` import.

**Verification**
- `git diff 7f76011 -- TradeBook.tsx` → empty (identical). ✅
- client `npx tsc --noEmit` → exit 0, silent. ✅
- Visual acceptance (56px rows, glanceable P&L) is GitHub/Vercel-side — can't screenshot
  in sandbox (no network). Takes effect on next push → auto-deploy.

**Deploy:** none possible in sandbox. Activates when commit is pushed to GitHub (R.1).

**Commit:** `auto: 18.13 re-land trade row density (clobbered by 0c82263)`.

**Next agent — IMPORTANT**
- TradeBook.tsx now == 7f76011. If you hand-edit near it OR cherry-pick smoke-test
  fixes again, RE-DIFF against this commit first — this file has now been clobbered
  THREE times by hand-authored smoke commits carrying a stale index.
- STATE.md keeps drifting because the pack-commit workaround sometimes captures a stale
  blob. After committing, re-verify `git show HEAD:STATE.md | tail` matches disk.
- Remaining Phase 18: 18.1, 18.2, 18.3, 18.10, 18.11, 18.12, 18.8, 18.7, 18.6, 18.4.
  18.6/18.10 need migration 018 (network-blocked → write SQL + commit, user applies).
  18.7/18.8 are large. 18.1/18.3 are frontend UI. 18.12 (security audit) is mostly a
  docs deliverable + verifiable code reads — good offline pick.

---

## 2026-06-03T~auto — 18.9 CI pipeline health fixes

**TODO item picked:** **18.9 CI pipeline health fixes** (Phase 18; order-agnostic).

**Why it was actually NOT done** (correcting the prior run's note): the 18.5 run
said "18.9 already in code per 7f76011 — just verify + check off." That was stale.
Commit `0c82263` ("Fix smoke: dismiss cookie banner before buy", hand-authored)
RE-CLOBBERED the 18.9 changes out of `deploy.yml` as a side effect — the same
stale-index clobber pattern that `e6b2fb4` caused earlier. At HEAD the workflows
had NO paths-ignore, NO weekly schedule, NO Node24 opt-in. So 18.9 was genuinely
incomplete. I re-applied it.

**Pre-run state**
- Working tree LOOKED dirty (staged reverse-diff of the 18.5 commit + index.lock).
  Investigated: every file on disk was byte-identical to HEAD (`git diff HEAD` empty
  except an index artifact). It was leftover index junk from the prior run's commit
  workaround, NOT a user mid-edit → safe to proceed. Reset via private GIT_INDEX_FILE.
- `git-precheck.sh`: branch=main OK, author OK, index.lock unremovable (see header).
- tsc not re-run (no TS touched this run; disk == HEAD for all .ts).

**What changed** (both files now byte-identical to the known-good `7f76011` versions)
- `.github/workflows/deploy.yml`:
  - `paths-ignore: ['**.md','docs/**','scripts/**','e2e/**']` on the push trigger
    (Problem 1: doc-only commits no longer trigger/cancel real deploys).