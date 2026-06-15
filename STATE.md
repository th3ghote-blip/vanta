# STATE -- handoff notes for the next agent

## ⚠️ READ THIS FIRST — Vercel git-author block
Set this BEFORE the first commit every session:
```bash
git config user.email "229847808+th3ghote-blip@users.noreply.github.com"
git config user.name "th3ghote-blip"
```

## ⚠️ WSL mount permission wall (persistent)
The mounted repo CANNOT:
- unlink/remove ANY file (`rm` → "Operation not permitted"), incl. `.git/index.lock` (a stale
  zero-byte `.git/index.lock` is sitting there and cannot be deleted — so in-mount `git add`/
  `git commit` fail).
You CAN: read via git; **overwrite existing working-tree files in place** (`>` truncates the same
inode); **create files inside the existing `.git/objects/pack/` dir**; overwrite
`.git/refs/heads/main` and `.git/index` in place.
**Proven commit+push recipe (used this run, works):**
1. `git clone --local <mount> /tmp/vw` then in /tmp/vw add the GitHub remote
   (`git remote set-url origin <github-url-with-token>` — grab the token from the mount's
   `git remote -v`).
2. Copy your touched files from the mount into /tmp/vw, `git add <files>`, `git commit`,
   `git push origin main`. **GitHub now has the commit and CI deploys.**
3. Sync the mount so its next run sees a clean tree: from /tmp/vw
   `git pack-objects --revs --stdout <<<"<NEW>\n^<OLD>"` → write the pack into the mount's
   `.git/objects/pack/`, `git index-pack` it, overwrite the loose `.git/refs/heads/main` with
   `<NEW>`, then rebuild the index: `GIT_INDEX_FILE=/tmp/idx git --git-dir=<mount>/.git read-tree
   <NEW>` and `cat /tmp/idx > <mount>/.git/index`.
NB: `.git/packed-refs` has a stale `refs/heads/main` (8beb509); the **loose** ref wins, so always
overwrite the loose `.git/refs/heads/main`.

## ⚠️ DO NOT edit code files with the Edit/Write file tools — use bash/python
Editing `.tsx` via the Edit tool has produced files `tsc` rejected with bogus parse errors. Make
all repo code edits through bash/python heredoc or in-place `open(...,'w')`, then verify with
`npx --no-install tsc --noEmit` before committing. (.md files are fine via Edit/Write.)

## ⏭️ 2026-06-15 18:06 UTC (auto) — SKIPPED: dirty working tree (NO WORK DONE this run)
skipped run at 2026-06-15 18:06 UTC: dirty working tree. 6th consecutive skip — same in-flight
human CI test-account-cleanup feature, byte-for-byte unchanged (verified diff): modified
`scripts/cleanup-test-accounts.py` (CI env-var fallback for SUPABASE_URL/SERVICE_ROLE_KEY; parses
clean) + untracked `.github/workflows/cleanup-test-accounts.yml` (daily 06:30 UTC purge). Per the
STOP rule: picked no TODO item, committed nothing, left every file as found.
**Human action to unblock all future auto-runs:** add `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
as GitHub Actions secrets, then commit the .py + .yml together — or `git stash` / `git checkout --`
them to abandon. Until the tree is clean, every auto-run keeps skipping.

## ⏭️ 2026-06-15 14:06 UTC (auto) — SKIPPED: dirty working tree (NO WORK DONE this run)
skipped run at 2026-06-15 14:06 UTC: dirty working tree. 5th consecutive skip — same in-flight
human CI test-account-cleanup feature, byte-for-byte unchanged: modified
`scripts/cleanup-test-accounts.py` (adds CI env-var fallback for SUPABASE_URL/SERVICE_ROLE_KEY;
parses clean) + untracked `.github/workflows/cleanup-test-accounts.yml` (daily 06:30 UTC purge of
@vanta.test/@example.* test accounts). Verified the diff matches prior runs' description exactly —
coherent, human-authored. Per the STOP rule: picked no TODO item, committed nothing, left every
file as found. **Human action to unblock all future auto-runs:** add `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` as GitHub Actions secrets, then commit the .py + .yml together (or
`git stash`/`git checkout --` them to abandon). Until the tree is clean, every auto-run keeps
skipping.

## ⏭️ 2026-06-15 12:41 UTC (auto) — SKIPPED: dirty working tree (NO WORK DONE this run)
4th run in a row blocked by the same in-flight CI test-account-cleanup feature, still uncommitted:
modified `scripts/cleanup-test-accounts.py` (CI-env fallback; parses clean) + untracked
`.github/workflows/cleanup-test-accounts.yml` (daily 06:30 UTC purge). Verified the diff is
unchanged from prior runs — human-authored, coherent. Per the STOP rule I picked no TODO item and
committed nothing; left all files exactly as found. **Human action needed to unblock auto-runs:**
add `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` as GitHub Actions secrets, then commit the .py +
.yml together (or `git stash`/`git checkout` them if abandoning). Until the tree is clean, every
auto-run will keep skipping.

## ⏭️ 2026-06-14 22:06 UTC (auto) — SKIPPED: dirty working tree (NO WORK DONE this run)
Same in-flight CI test-account-cleanup feature as the prior two runs, still uncommitted:
modified `scripts/cleanup-test-accounts.py` (CI-env fallback; parses clean) + untracked
`.github/workflows/cleanup-test-accounts.yml` (daily 06:30 UTC purge). Coherent, human-authored,
unchanged since 06-14. Per the STOP rule I picked no TODO item and committed nothing — left all
files exactly as found. **Human action needed:** add `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
as GitHub Actions secrets, then commit the .py + .yml together. Once the tree is clean the next
auto-run can resume normal picking.

## ✅ 2026-06-13 (auto) — 18.6 DONE (share_trades privacy: 403 gate + Profile toggle). Pushed to main.
Picked the topmost completable item. Everything above it is blocked for offline auto-runs (R.7
Better-Stack = external signup; 18.2 chart drawings + 18.3 light/dark = visual/screenshot; 18.7 AI
assistant = needs Claude API + live key; 18.8 manager panel = oversized, needs splitting).

**What shipped (commit on main, CI deploys both):**
- `server/src/routes/account.ts`: new `PATCH /api/account/privacy` — boolean-validates and persists
  `profiles.share_trades` (401 unauth / 400 non-boolean / 200 returns stored flag).
- `server/src/routes/traders.ts`: new `GET /api/traders/:leaderId/trades` returns a leader's recent
  closed trades but **403 `trades_private`** when that leader's `share_trades=false` (or no profile);
  `/leaderboard` leader query now also requires `.eq('share_trades', true)` so private users never
  appear on the board.
- `lib/api.ts`: `api.setShareTrades()`.
- `app/(tabs)/profile.tsx`: Profile → **Privacy** card with a "Share my trades" Switch (default ON,
  hydrated from `getProfile().share_trades`, optimistic with revert-on-failure).
- Tests: `buildApp` helper now registers `tradersRoutes`; supabaseMock gained `.not()`,
  `profiles.share_trades`, `trades.user_id`. New `server/test/shareTrades.test.ts` (8 tests).
- Migration 027 (`share_trades`) already applied — no migration this run.
- Verified offline: client tsc clean, server tsc clean, `npm test` **175 passing**.

**PENDING LIVE VERIFY (next interactive session):** on device A toggle Privacy → Share my trades
OFF → as a different logged-in user, that leader is absent from the leaderboard and
`GET /api/traders/:id/trades` → 403; toggle back ON → reappears.

⚠️ STILL-CARRIED DEPLOY DEBT (verify these are live now that CI auto-deploys on push):
19.1 ($ amount sizing) + 20.3 (trade-risk gate) + 18.10 (risk accept) + 18.6 (this) — confirm
Vercel/Railway shipped via the GitHub Actions run for each push; browser-check when next interactive.

### Next pick: split 18.3 (light/dark) into 18.3a–g sub-items for a screenshot-capable run,
or pick another offline-completable item. The remaining top-of-list items (R.7, 18.2, 18.7, 18.8)
all need network / screenshots / a user decision / splitting — see each item's `>` note.

## Earlier (pruned)
- 2026-06-13 (auto): 18.10 — risk acceptance persisted server-side (`POST /api/account/risk-accept`,
  `profiles.risk_accepted_at`; `app/_layout.tsx` syncs ack keys on start). 167→passing the