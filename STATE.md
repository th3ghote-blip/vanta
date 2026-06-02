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
  - workflow-level `env: FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: 'true'` (Problem 3).
- `.github/workflows/e2e.yml`:
  - `schedule: - cron: '0 6 * * 1'` weekly Monday safety-net (Problem 2) + matching
    header comment.
  - job `if:` now also allows `github.event_name == 'schedule'`.
  - workflow-level Node24 opt-in env (Problem 3).
- (setup-node already pins `node-version: '20'` on all jobs — left as is.)

**Verification**
- Both YAML files `yaml.safe_load` OK.
- `diff` vs `git show 7f76011:<file>` → IDENTICAL for both. ✅
- Acceptance is GitHub-side behavior (no deploy on md-only push; weekly E2E; no Node
  deprecation warning) — cannot be exercised in the sandbox (no network, no runner).
  Takes effect on next push to GitHub; GH Actions reads the new workflow config.

**Deploy**
- None. 18.9 IS CI config — nothing ships to Railway/Vercel. The change activates when
  the commit is pushed and Actions runs. No migration, no env secrets, no app code.

**Commit:** `auto: 18.9 CI pipeline health fixes` (see git log).

**Next agent — IMPORTANT**
- 18.9 is now landed. WATCH OUT: it has been clobbered TWICE by hand-authored
  smoke-test fix commits (`e6b2fb4`, `0c82263`) that carried a stale index. If you
  hand-edit anything near these workflows, re-diff against this commit before
  committing so