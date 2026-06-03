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

## 2026-06-03T~auto — 18.1 Order entry simplification

**TODO item picked:** **18.1 Order entry simplification** (Phase 18). Topmost unchecked
item whose deps are met; frontend-only, no migration, completable offline.

**Pre-run state**
- `git status` showed phantom STAGED+unstaged changes (deploy.yml, e2e.yml, STATE.md,
  TODO.md, TradeBook.tsx, robotEngine.ts, supabaseMock.ts, robotEngine.test.ts). Verified
  with a clean `GIT_INDEX_FILE` (`git read-tree HEAD; git diff HEAD` → EMPTY): every file
  on disk is byte-identical to HEAD. It is leftover index junk from prior runs' commit
  workaround, NOT a user mid-edit → safe to proceed. HEAD = ce8a6be.

**What changed** (`components/pro/OrderEntry.tsx` only)
- Volume field: renamed away from "Stake ($/pt)" / "Volume (lots)" to a single **"Volume"**
  label with an inline **Lots / $/pip** segmented toggle (new `SizeButton`) that flips the
  persisted `usePrefsStore.spreadBet` pref — same setting as Profile → Display.
- Summary line collapsed to **one short sentence**: `$X notional · $Y margin`, with
  `· risking ~$Z` (loss-coloured) appended when a stop-loss is set. Lots × price · leverage
  · $/pip moved behind a tap **"Details"** toggle (`showDetails`).
- **"risking ~$X"** indicator: `|refPrice − SL| × volume × contractSize(symbol)` (side-agnostic;
  imported `contractSize` from `lib/contracts`).
- **Trail Distance** field moved behind an **"Advanced"** toggle (`showAdvanced`), market only.
- `Field` now omits the label element when `label===""`.

**Verification**
- client `npx tsc --noEmit` → exit 0, silent. ✅
- server `npx tsc --noEmit` → exit 0, silent. ✅
- Visual acceptance (first-time user can place a BTC market buy; summary is one sentence)
  is Vercel-side — can't screenshot in sandbox. Activates on next push (R.1).

**Deploy:** none possible in sandbox (no network). Activates when the commit is pushed (R.1 GH Actions).

**Commit:** `auto: 18.1 order entry simplification`. Committed via private-index +
write-tree/commit-tree + loose-ref update (loose object writes SUCCEED here — only a benign
`unable to unlink tmp_obj` warning; the object is still written).

**⚠️ NEW ENVIRONMENT GOTCHA — per-inode mount cache desync (cost me most of this run)**
- The bash sandbox mount (`/sessions/*/mnt/vanta`) served a STALE, TRUNCATED copy of
  `OrderEntry.tsx` (frozen at 519 lines, cut mid-`<Text>`, mtime stuck at yesterday) even
  though the file tools (Read/Edit/Write) saw the correct, complete 712-line file. tsc/babel
  errors were ALL artifacts of that truncated cache, not real code errors.
- Brand-NEW files written by the file tools DO propagate to the mount immediately; only the
  existing `OrderEntry.tsx` inode was stuck. **Fix that worked:** write authoritative content
  to a new path via the Write tool, then in bash `cat newpath > OrderEntry.tsx` to overwrite
  the stuck inode's bytes (busts the cache). After that bash saw the real file and tsc passed.
- **Next agent:** if bash-side tsc reports JSX "no closing tag"/truncation errors that make no
  sense vs what Read shows, suspect this mount cache. Re-Read via file tool; if disk is fine,
  cache-bust with the new-file→`cat >` trick before trusting bash. Do all commit-time content
  mutations IN BASH (sed/cat/heredoc) so git reads exactly what you intend.
- `rm` on the mount still fails ("Operation not permitted"). Two harmless untracked temp files
  may remain: `components/pro/OrderEntry.fresh.tsx` and `.sync_probe_18_1.txt`. They were NOT
  `git add`ed and are not in the commit. A human can delete them from Windows; or ignore.

**Next agent — remaining Phase 18:** 18.2, 18.3, 18.10, 18.11, 18.12, 18.8, 18.7, 18.6, 18.4.
18.6/18.10 need migration 018 (network-blocked → write SQL + commit, user applies). 18.7/18.8
are large. 18.3/18.11 are frontend. 18.12 (security audit) is a good offline docs+code-read pick.

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