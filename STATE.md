# STATE -- handoff notes for the next agent

## ⚠️ READ THIS FIRST — Vercel git-author block

Every session must set this BEFORE the first commit:
```bash
git config user.email "229847808+th3ghote-blip@users.noreply.github.com"
git config user.name "th3ghote-blip"
```

---

## 2026-05-24T~08:00Z -- R.8 E2E smoke test

**TODO item picked:** **R.8 E2E smoke test in CI**

**Pre-run state**
- Working tree clean (fresh index via GIT_INDEX_FILE). HEAD = `ee992c9` (R.1 deploy workflow).
- Stale index.lock / HEAD.lock / main.lock as usual — GIT_INDEX_FILE + direct ref-write workaround used throughout.
- Client tsc: exit 0. Server tsc: exit 0. Tests: 71 passed before starting.

**What changed**
- `e2e/smoke.spec.ts` (new): Playwright test — registers fresh demo account via `/api/auth/register` (avoids fragile UI signup), signs in via login form, waits for live BTC price, places a 0.01 BTC market buy, closes via `getByRole('button', { name: 'Close trade' })`, signs out, asserts redirect to login.
- `playwright.config.ts` (new): Chromium only, 60s timeout, HTML reporter, targets `VANTA_URL` env var (defaults to https://vanta-jade.vercel.app).
- `.github/workflows/e2e.yml` (new): triggers on `workflow_run` completion of the Deploy workflow (so smoke tests always run against freshly-shipped code) + `workflow_dispatch` for manual runs. Installs Chromium, runs `npx playwright test e2e/smoke.spec.ts`, uploads `playwright-report/` as artifact (14-day retention).
- `components/pro/TradeBook.tsx`: added `accessibilityLabel="Close trade"` to the close-position Pressable so Playwright can target it by `getByRole('button', { name: 'Close trade' })`.
- `package.json`: added `@playwright/test: ^1.44.0` to devDependencies + `test:e2e` script.
- `tsconfig.json`: excluded `e2e/` and `playwright.config.ts` from the main Expo TypeScript compile (they have their own tsconfig).
- `e2e/tsconfig.json` (new): separate tsconfig for Playwright test files.

**Verification**
- Client tsc: exit 0 ✅
- Server tsc: exit 0 ✅
- npm test: 71 passed ✅
- Commit: `fa8ab73`
- No deploy needed — pure CI/test infrastructure + one accessibility attr on a UI button.

**Known limitation**
- The smoke test requires the live backend (`/api/auth/register`) and frontend to be up. If Railway is down, the test will fail at step 1. This is expected and correct behavior.
- `npm ci` in CI will install `@playwright/test`; the package isn't in `node_modules` locally yet (sandbox network). `npx playwright install chromium --with-deps` handles browser installation.

**Next agent**
- R.7 (Better-Stack) — needs user signup at betterstack.com, skip.
- R.11 (DB backup verification) — now unblocked since R.1 is live. GH Actions cron: query Supabase Management API for latest backup timestamp, alert if >30h old. File: `scripts/verify-backup.py` + `.github/workflows/backup-check.yml`.
- T.20 (Quick Mode durations + categories) — pure frontend, no migration, safe pick. Add 5s/30s/30min/4h/24h durations + Crypto/Forex/Stocks tabs to `components/fun/QuickTradeScreen.tsx`.
- File truncation pattern: ALWAYS use Python for writes to files >200 lines. Edit tool truncates large files silently.

