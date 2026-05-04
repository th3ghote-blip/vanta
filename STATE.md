# STATE — handoff notes for the next agent

> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.

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
