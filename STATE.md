# STATE — handoff notes for the next agent

> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.

---

## 2026-05-05T10:41Z — Skipped run: dirty working tree (CRLF drift)

**Agent:** scheduled cowork auto-work pass
**Action taken:** none — exited per the "dirty working tree" hard rule. Only modified this STATE.md entry.

**What I saw:** `git status` on `main` shows two modified files I didn't touch:
- `.gitignore` — last two lines (` ` and `.vercel`) re-saved with CRLF (`\r\n`) instead of LF
- `server/.gitignore` — single line `.vercel` re-saved with CRLF

The diffs are pure line-ending changes (verified with `git diff | cat -A` — `^M$` markers on the new sides). No content drift. This is almost certainly a Windows editor or sync process re-writing these files with CRLF line endings, not an in-flight user edit.

**Why I still skipped:** the rule is "dirty tree = stop, leave a note, exit." Erring conservative. If this recurs every run it'll permanently block scheduled work.

**Suggested fix for the user (one-time, then runs unblock):**
```
cd /c/Claude/vanta
# Option A — accept the CRLF and move on:
git add .gitignore server/.gitignore && git commit -m "chore: normalize .gitignore line endings"
# Option B — restore LF and add a .gitattributes to keep them LF:
git checkout -- .gitignore server/.gitignore
printf "*.gitignore text eol=lf\n" >> .gitattributes
git add .gitattributes && git commit -m "chore: pin .gitignore to LF endings"
```

Alternatively, set `git config core.autocrlf false` in this repo if you'd prefer no automatic conversion at all.

**Next agent:** if the tree is clean, start with Phase 1.1 (server worker for SL/TP/stop-out) per the prior handoff.

---

## 2026-05-05 — Precheck verified end-to-end

Backed up the git restoration with full agent-precheck verification:
- `git status` clean on `main`, 3 commits (initial + restore + tsconfig fix)
- Client `tsc --noEmit` silent (was previously sweeping in `server/` and erroring on top-level await — fixed by adding `exclude: ["server", ...]` to root `tsconfig.json`)
- Server `tsc --noEmit` silent
- Backend `/health` returns 200 OK
- Frontend serves 200 at vanta-jade.vercel.app
- Supabase Management API (PAT in `server/.env` as `SUPABASE_PAT`) verified working

**Known bug not blocking the agent (worth a future task):** account `80000001` has balance `$545,524.28` — the old buggy contract-size math (treating BTC as 100k contract size) was applied to a close before the fix. Account `80000002` is correct at $10k. Lower-priority cleanup.

**Next agent:** start with Phase 1.1 (server worker for SL/TP/stop-out).

---

## 2026-05-05 — Git restored, agent unblocked

**Action taken:** Initialized git repo at `/c/Claude/vanta`. `main` branch. User identity configured locally as `Vanta Dev <vanta-dev@local>` (change later if you want commits attributed to a real account).

**Initial commit:** `20b4420` — covers all 73 tracked files (entire current state of scaffold + backend + docs). Secrets verified ignored: `.env`, `server/.env`, `.vercel/`, `node_modules/`, `dist/`, `.expo/`.

**No remote configured.** Work happens locally for now. If you want a GitHub/GitLab remote, add one with `git remote add origin <url>` and push. Not required for the cowork loop.

**Next agent:** working tree is clean on `main`. Run the standard precheck and proceed with **Phase 1.1 — Server worker for stop-loss / take-profit / stop-out** from `TODO.md`.

---

## 2026-05-05T00:00Z — Skipped run (repeat): no git repository

**Agent:** scheduled cowork auto-work pass
**Action taken:** none — exited without doing work.

**Status:** Same condition as the prior entry below. Re-checked: `/c/Claude/vanta` has no `.git/` directory; `git status` returns `fatal: not a git repository`. No files were modified except this STATE.md entry.

**Reminder for the user:** until git is restored, every scheduled run will keep skipping. See the entry below for full diagnosis and the suggested fix (`git init` + initial commit, or reclone from remote and migrate uncommitted work). Once git is back, the next run will pick up the topmost unchecked item — currently **1.1 Server worker for stop-loss / take-profit / stop-out**.

---

## 2026-05-04T18:06Z — Skipped run: no git repository

**Agent:** scheduled cowork auto-work pass
**Action taken:** none — exited without doing work.

**Why:** `/c/Claude/vanta` has no `.git` directory. `git status` returns `fatal: not a git repository`. The TODO.md workflow requires `git status` (precheck), `git add <paths>` (staging), and `git commit` (history) for every completed item. Without a repo I can't:
1. Verify the working tree is clean before starting (the mandatory precheck).
2. Commit my changes per the `auto: <title>` convention.
3. Leave a recoverable history for the next agent.

**What I checked:**
- `ls -la /c/Claude/vanta` — only `.gitignore` is present, no `.git/` directory.
- `find ... -maxdepth 3 -name "*.git*"` — only `.gitignore` files (project + nested in node_modules).
- No `.git` in `server/` either.
- `node_modules/` is intact and `package.json` looks normal, so this isn't a fresh-clone-in-progress.

**Possible causes (for the user to investigate):**
- The repo was deleted or never initialized in this workspace.
- A previous run or manual operation removed `.git/` (e.g. `rm -rf .git`).
- The folder was copied from another machine without `.git/`.
- The repo lives at a different path and this is a working copy.

**What the user should do:**
- If there's a remote (GitHub/GitLab), reclone into a temp dir and copy `.git/` over, OR clone fresh and migrate any uncommitted work.
- If there's no remote yet: `cd /c/Claude/vanta && git init && git add . && git commit -m "initial commit"` — but verify what should/shouldn't be committed first (the existing `.gitignore` should handle node_modules, .env, etc.).
- Confirm Railway/Vercel deploy sources don't depend on git history that's now missing.

**Next agent:** do NOT proceed with TODO items until git is restored. Re-running this scheduled task will keep skipping.

**Nothing was modified except this STATE.md entry.**

---

## 2026-05-04 — Initial roadmap handoff

**Current state:** Vanta is live in production. MT4-style auth working end-to-end. Pro mode trading with live charts, live order book, real Coinbase + Twelve Data feeds. Quick mode UI scaffolded but not wired. Robots UI scaffolded, compile endpoint working, execution engine is a stub.

**Live URLs:**
- Frontend: https://vanta-jade.vercel.app
- Backend: https://vanta-server-production.up.railway.app
- Supabase project ref: `auavcfwytrwurawcvrsc`

**Test account:**
- Login: `80000001`
- Password: `smw5WjSWwKZ7Dh`
- Has $10k demo balance + 1 open BTC trade

**Recently fixed bugs (don't reintroduce):**
- Contract size logic was treating BTCUSD as forex (100k contract size). Fixed via `lib/contracts.ts` shared between client and server. Crypto = 1 unit per lot.
- Yahoo Finance was failing on Railway with "fetch failed" — replaced entirely with Twelve Data for non-crypto.
- Binance WS gets HTTP 451 from Railway (geo-blocked) — using Coinbase Advanced Trade WS instead. Don't try to bring Binance back without a proxy.
- PositionsTable.tsx was deleted because Metro was bundling both old and new code. Don't recreate it — TradeBook.tsx is the replacement.
- Sign-out wasn't navigating; fixed with `router.replace('/(auth)/login')` + tabs route guard.
- Email confirmation was blocking login; we use force-confirmed accounts for now. Resend is configured but only sends to th3ghote@gmail.com (testing mode) until a domain is verified.

**Migrations applied:**
- 001_init.sql ✓
- 002_signup_trigger.sql ✓
- 003_login_numbers.sql ✓
- 004_login_attempts.sql ✓

**Pending migrations to apply with later phases:**
- 005_streaks.sql (Phase 2.6)
- 006_public_robots.sql (Phase 3.5)
- 007_admin.sql (Phase 4.3)
- 008_price_alerts.sql (Phase 6.4)
- 010_login_streak.sql (Phase 11.2)
- 011_achievements.sql (Phase 11.3)

**Tooling/credentials all set:**
- `SUPABASE_PAT` in `server/.env` → `scripts/apply-migration.py` works
- Railway CLI logged in
- Vercel CLI logged in (team `andrew-nifields-projects-0604ec39`)

**Known TODOs not in main roadmap:**
- The expo-image dependency was added but not used; can remove from package.json
- `expo-image-picker` and `expo-camera` need installing for Phase 5.1
- The `assets/` folder is empty; needs proper PNGs for app icons before mobile builds (Phase 9.2)
- App store assets, screenshots, marketing copy — all TODO for Phase 9.3+

**Agent gotcha:**
- Do NOT impersonate users in browser (Claude in Chrome). User logs in on their own machine. Use curl/the Management API for verification.
- Vercel `vercel deploy` from `/server/` directory creates a new project — always run from `/c/Claude/vanta`.
- If you see `STATE.md` getting too long, archive sections older than 30 days into `STATE-archive.md`.
