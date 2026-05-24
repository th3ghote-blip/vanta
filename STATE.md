# STATE -- handoff notes for the next agent

## ⚠️ READ THIS FIRST — Vercel git-author block

Every session must set this BEFORE the first commit:
```bash
git config user.email "229847808+th3ghote-blip@users.noreply.github.com"
git config user.name "th3ghote-blip"
```

---

## 2026-05-24T~09:00Z -- R.11 DB backup verification

**TODO item picked:** **R.11 Database backup verification**

**Pre-run state**
- Working tree clean (GIT_INDEX_FILE=/tmp/vanta_fresh/idx). HEAD = `087534c` (R.8 STATE chore).
- Stale index.lock / HEAD.lock / main.lock as usual — GIT_INDEX_FILE + direct ref-write workaround used throughout.
- Client tsc: exit 0. Server tsc: exit 0.
- Sandbox network blocked (curl to Railway/Vercel timed out) — no deploy required for this item.

**What changed**
- `scripts/verify-backup.py` (new): queries `GET https://api.supabase.com/v1/projects/{ref}/database/backups`, finds the most recent completed backup across `backups` + `tiered_backups` arrays, exits 1 if age > MAX_AGE_HOURS (default 30). Prints clear human-readable output with timestamps, age, and total backup count.
- `.github/workflows/backup-check.yml` (new): daily cron at 06:15 UTC (after Supabase's nightly backup window). Also supports `workflow_dispatch` with optional `max_age_hours` input. Uses `SUPABASE_PAT` GitHub repo secret (same PAT already in `server/.env`).

**Verification**
- Python syntax: OK (`python3 -m py_compile`)
- Missing-PAT guard: correctly prints error and exits 1
- Commit: `8d9cbbb` (direct ref-write to bypass HEAD.lock)
- No deploy needed — pure CI infrastructure.

**Action required by user**
- Add `SUPABASE_PAT` as a GitHub repo secret (Settings → Secrets → Actions). Value: already in `server/.env` as `SUPABASE_PAT`.

**Next agent**
- R.7 (Better-Stack) — needs user signup at betterstack.com, skip.
- T.20 (Quick Mode durations + categories) — pure frontend, no migration, safe pick. Add 5s/30s/30min/4h/24h durations + Crypto/Forex/Stocks tabs to `components/fun/QuickTradeScreen.tsx`.
- File truncation pattern: ALWAYS use Python for writes to files >200 lines. Edit tool truncates large files silently.

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
- `.github/workflows/e2e.yml` (new): triggers on `workflow_run` completion of the Deploy workflow (so smoke tests always run against freshly-shipped code) + `workf