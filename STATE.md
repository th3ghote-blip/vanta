# STATE -- handoff notes for the next agent

## ⚠️ READ THIS FIRST — Vercel git-author block

Every session must set this BEFORE the first commit:
```bash
git config user.email "229847808+th3ghote-blip@users.noreply.github.com"
git config user.name "th3ghote-blip"
```

---

## 2026-05-24T02:15Z -- R.1 GitHub Actions auto-deploy

**TODO item picked:** **R.1 GitHub Actions auto-deploy**

**Pre-run state**
- Working tree clean (fresh index confirmed via `GIT_INDEX_FILE` workaround). HEAD = `bf59575`.
- Stale index.lock / HEAD.lock / main.lock as usual — used `GIT_INDEX_FILE=/tmp/vanta_idx_r1` throughout.
- Client tsc: exit 0. Server tsc: exit 0. Tests: 71 passed.

**What changed**
- `.github/workflows/deploy.yml` (new): 3-job pipeline triggered on push to `main`.
  - `verify`: installs client + server deps, runs `tsc --noEmit` on both sides, runs `npm test` in `server/`.
  - `deploy-backend`: after verify passes, installs Railway CLI, runs `railway up --service $RAILWAY_SERVICE_ID --environment production --detach`.
  - `deploy-frontend`: after verify passes, installs Vercel CLI, runs `vercel --prod --yes --token $VERCEL_TOKEN`. Uses `.vercel/project.json` (already in repo) for org+project IDs.
  - `concurrency` group cancels any in-flight deploy for the same ref so fast pushes don't stack.

**Secrets the user must add** (GitHub repo → Settings → Secrets → Actions):
1. `RAILWAY_TOKEN` — from https://railway.app → Account Settings → Tokens
2. `RAILWAY_SERVICE_ID` — UUID shown in the Railway dashboard URL when viewing the backend service (e.g. `https://railway.app/project/.../service/<UUID>`)
3. `VERCEL_TOKEN` — from https://vercel.com/account/tokens

`.vercel/project.json` already contains `projectId` + `orgId` so no additional Vercel secrets needed.

**Verification**
- Client tsc: exit 0 ✅
- Server tsc: exit 0 ✅
- npm test: 71 passed ✅
- Workflow YAML is valid (no shell errors). Live trigger requires the 3 secrets above to be set.

**Pending deploys (unchanged)**
- Migrations 023 + 024 still unapplied (sandbox network blocked).
- Backend + frontend deploys still need manual trigger or the above secrets to be added.

**Next agent**
- Once the user adds the 3 secrets above, R.1 becomes fully active and future code pushes auto-deploy.
- Next code pick (topmost unchecked after R.1): **R.7** (Better-Stack — needs user signup, skip) → **R.8** (E2E smoke test — `e2e/smoke.spec.ts` + `.github/workflows/e2e.yml`; now unblocked since R.1 exists) → or jump to **T.20** (Quick Mode durations/categories — pure frontend, no migration, safe pick).
- R.8 is a good next pick: write the Playwright smoke test + a new GH Actions workflow job that runs it. Depends on `playwright` package being installable in CI (no railway/vercel secrets needed for the test itself).

---

## 2026-05-23T12:57Z -- T.17 Bigger symbol catalog

**TODO item picked:** **T.17 Bigger symbol catalog — real-time crypto on Coinbase**

**Pre-run state**
- Working tree clean (fresh index confirmed). HEAD = `618268c`.
- Migrations 023 + 024 still unapplied — sandbox network blocked (403). Backend/frontend still undeployed (no Railway/Vercel CLI).
- Client tsc: exit 0. Server tsc: exit 0. Tests: 71 passed before starting.

**What changed**
- `server/src/feed/pricefeed.ts`: Added 33 new crypto symbols to `CRYPTO_SYMBOLS` (47 → 80 total). New symbols subscribe to Coinbase Advanced Trade WS on startup via the existing `startCoinbase()` path. Added seed fallback prices for all 33. No Twelve Data or migration changes — pure Coinbase/frontend addition.
  New symbols: ALGOUSD, XLMUSD, HBARUSD, FLOWUSD, EOSUSD, XTZUSD, BATUSD, ZECUSD, ZRXUSD, LRCUSD, ANKRUSD, IOTXUSD, SKLUSD, GRTUSD, IMXUSD, FETUSD, TAOUSD, ONDOUSD, KASUSD, RPLUSD, ENSUSD, DYDXUSD, CVXUSD, BLURUSD, KAVAUSD, ARUSD, NMRUSD, JASMYUSD, SUPERUSD, QNTUSD, CTSIUSD, ASTRUSD, CHZUSD.
- `lib/symbolMeta.ts`: Added display name + category metadata for all 33 new symbols. Picker will show full names (e.g. "Bittensor (TAOUSD)").

**T.16 skip reason**
- T.16 (Drawing tools) requires a `chart_drawings` migration (sandbox blocked) plus substantial Lightweight Charts drawings API work (>60 min). Added a skip comment in TODO.md; try again when R.1 auto-deploy lands or migration can be applied manually.

**Verification**
- Client tsc: exit 0 ✅
- Server tsc: exit 0 ✅
- npm test: 71 passed ✅
- Note: if any of the 33 new symbols are not on Coinbase, the subscription silently produces no ticks and the seed fallback price is used — graceful degradation.

**Pending deploys (blocked since T.14)**
1. Apply migration 023 (trade notes): `SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/023_trade_notes.sql`
2. Apply migration 024 (is_primary): `SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/024_account_is_primary.sql`
3. Backend deploy: `cd server && railway up --detach`
4. Frontend deploy: `cd /c/Claude/vanta && vercel --prod --yes`

**Next agent**
- Apply migrations 023 + 024, deploy backend + frontend (commands above).
- Next code pick: **T.18 Copy trading** (new migration + server logic + UI) or **T.20 Quick Mode durations/categories** (pure frontend, no migration, safe pick). T.16 is still blocked on migration/complexity.
- File truncation pattern: always use Python for files >200 lines.

---

## 2026-05-23T01:15Z -- T.14 Trade journal / annotations

**TODO item picked:** **T.14 Trade journal / annotations**

**Pre-run state**
- Fresh-index (`GIT_INDEX_FILE=/tmp/vanta_fresh_idx`) confirmed working tree clean.
- `.git/index.lock` and `.git/refs/heads/main.lock` both stale/unremovable — workaround applies as usual.
- Client tsc: exit 0. Server tsc: exit 0. Tests: 71 passed before starting.
- No Vercel creds in sandbox (T.15 still undeployed from prior run). No Railway creds either.

**What changed**
- `supabase/migrations/023_trade_notes.sql` (new): `ALTER TABLE trades ADD COLUMN IF NOT EXISTS notes text;`
- `server/src/routes/orders.ts`: Added `PATCH /api/orders/note/:id` endpoint. Accepts `{ notes: string }` (max 4000 chars), verifies trade ownership via `accounts!inner(user_id)` join, works for any trade status (open/closed/pending). Returns `{ tradeId, notes }`.
- `lib/api.ts`: Added `saveTradeNote(tradeId, notes)` exported async function calling the new endpoint.
- `components/pro/TradeBook.tsx`: 
  - `notes?: string | null` added to Trade interface.
  - Note state: `noteId`, `noteText`, `noteSaving`.
  - `startNote()`, `cancelNote()`, `saveNote()` handlers (saveNote updates local state optimistically after server ack).
  - NotebookPen button on every trade row (accent tint + border when note exists, muted when empty). Button hides when editing SL/TP or partial-closing.
  - Inline note panel (multiline TextInput, "TRADE NOTE" label, Save Note button with spinner).
  - Note preview line below symbol: "Note: <first 60 chars>..." in primary color.
  - Action button strip widened from 96/64 to 124/96 to fit note button.
  - TradeRow props extended with 7 new note-related props.

**File write method:** Python (all 3 tsx/ts files restored from HEAD then patched via Python to avoid Edit-tool truncation).

**Verification**
- Client tsc: exit 0 ✅
- Server tsc: exit 0 ✅
- npm test: 71 passed ✅ (no new server tests; endpoint pattern matches existing covered routes)

**Migration NOT applied** — sandbox network proxy blocks Supabase API (403 Forbidden). User must run:
```bash
SUPABASE_PAT=$(grep SUPABASE_PAT server/.env | cut -d= -f2-) python scripts/apply-migration.py supabase/migrations/023_trade_notes.sql
```
Until migration runs, the `notes` column doesn't exist — the PATCH endpoint will error if called. Frontend will silently fail (try/catch in saveNote).

**Backend deploy needed** for the new endpoint to go live. `railway up --detach` from a session with Railway auth.

**Frontend deploy needed** — T.15 (indicators) and T.14 (notes UI) both uncommitted-to-Vercel. `vercel --prod --yes`.

**Next agent**
1. Apply migration 023 (see command above).
2. Deploy backend: `cd server && railway up --detach`
3. Deploy frontend: `cd /c/Claude/vanta && vercel --prod --yes`
4. Next code pick: **T.10 Multiple accounts per user** (migration 024: `accounts.is_primary boolean`, account switcher dropdown in header) or **T.17 Bigger symbol catalog** (pure pricefeed.ts change, no migration, no backend deploy of other changes needed).

---

## 2026-05-22T14:20Z -- T.15 Technical indicators on chart

**TODO item picked:** **T.15 Technical indicators on chart**

**Pre-run state**
- Sandbox proxy blocks external curl (403 from allowlist) — cannot verify live health endpoints from this sandbox. This is a known limitation; the services were green as of the last successful deploy.
- Stale HEAD.lock as usual; phantom-index reconciled via `git reset HEAD` + file restore from HEAD.
- On-disk Chart.tsx was truncated (135 lines missing from end) — restored from HEAD before starting.
- TypeScript: exit 0 both sides. Tests: 71 passed.

**What changed**
- `stores/chartPrefs.ts` (new): Zustand store persisting indicator toggle state to AsyncStorage under key `vanta:chart-prefs`. Five toggles: ma20, ma50, bb, rsi, macd. Follows the same hydrate/setItem pattern as stores/theme.ts.
- `components/pro/Chart.tsx`: Added indicator toggle pill strip below the chart (TouchableOpacity pills, active = primary color accent). Each toggle is in INDICATOR_ORDER array; state read from useChartPrefs. Iframe key includes indicatorHash so it fully remounts on toggle (avoids partial-update issues). Container height expands by 120px per oscillator pane (RSI, MACD) when enabled.
- `buildChartHtml()` refactored from template literal to string concatenation (avoids backtick-inside-template-literal TS parse errors on long files). Accepts indicators object. Injects SHOW_MA20/MA50/BB/RSI/MACD booleans. Computes:
  - MA20/MA50: LightweightCharts addLineSeries overlaid on main price chart (amber / indigo).
  - Bollinger Bands (20, 2σ): upper/middle/lower dashed lines on main chart.
  - RSI (Wilder 14): separate chart div below main, violet line, 70/30 reference lines, autoscale 0-100.
  - MACD (12,26,9): separate chart div, MACD line (sky), signal (orange), histogram (profit/loss colors).
  - Time scale sync: mainChart range change propagates to rsiChart/macdChart via subscribeVisibleLogicalRangeChange.
  - History prepend (T.21) calls rebuildIndicators() after data merge.
  - MA series updated incrementally on each WS tick.

**File written via Python** (bash) to avoid Write-tool truncation at ~365 lines.

**Verification**
- Client tsc: exit 0 ✅
- Server tsc: exit 0 ✅
- npm test: 71 passed ✅
- Visual: cannot verify from sandbox (no live Vercel access). Deploy manually or wait for next session with Vercel auth.

**Backend:** No changes — pure frontend. No migration needed.
**Frontend deploy:** Not deployed — sandbox has no Vercel credentials this session. Need to run `vercel --prod --yes` from a session with Vercel auth.

**Next agent**
1. Deploy frontend: `cd /c/Claude/vanta && vercel --prod --yes`
2. Next safe code pick: **T.10 Multiple accounts per user** (migration + account switcher UI, accounts.is_primary boolean, dropdown in header). Or **T.14 Trade journal** (trades.notes text migration + notes textarea).
3. Same HEAD.lock / phantom-index issue will recur — precheck.sh handles it.

---

## 2026-05-22T14:30Z -- T.21 Chart history pan / lazy-load

**TODO item picked:** **T.21 Chart history pan / lazy-load older bars**
**Commit:** `e9f5ef7`

**Pre-run housekeeping**
- Stale `.git/HEAD.lock` (62k seconds old) cleared via `git-precheck.sh`.
- Phantom-index showed T.8/T.9/T.12 files as deleted-in-index + untracked-on-disk; `git reset HEAD` reconciled. Pushed previously-local-only commits (`8aefa4c` and 3 before it) to origin.
- Applied **all 5 pending migrations** to live Supabase (`018_stop_limit`, `019_trailing_stops`, `020_oco_groups`, `021_user_watchlist`, `022_hedging_mode`). All idempotent — re-running scripts is safe but already done.
- A prior partial T.21 attempt was reverted by an earlier cowork agent as "corrupted bars.ts / Chart.tsx" — that was actually mid-Edit, not corruption. This run uses single-shot `Write` to dodge the Edit-truncation pattern.

**What changed**
- `server/src/routes/bars.ts`: `/api/bars/:symbol` accepts optional `before=<unix-sec>`. When supplied the route ends the window one bar before that timestamp (no overlap with client's existing data). Cache key includes `before` so historical pages don't collide with the live window. Both Coinbase and Twelve Data paths parametrized.
- `components/pro/Chart.tsx`: embedded `API_URL` + `TIMEFRAME` into the iframe script. Added a mutable `DATA` array + `subscribeVisibleLogicalRangeChange` handler. When the leftmost visible logical index is `< 20`, fetches 500 older bars via `?before=DATA[0].time`, dedupes by `time`, prepends, rebuilds via `setData`, and restores the visible logical range shifted by the prepended count (zoom preserved). Single in-flight guard. `hitFloor` latches true on first response with <20 bars.
- **Backtick gotcha:** TS template literals don't allow nested backticks in comments inside the HTML string. Comments like ``dedupe by `time` `` close the outer template literal prematurely. Use HTML entities (`&#96;`) instead.

**Verification**
- `cd server && npx --no-install tsc --noEmit` → exit 0 ✅
- `npx --no-install tsc --noEmit` (client) → exit 0 ✅
- `cd server && npm test` → **71 passed (no delta)** ✅ — T.21 has no test coverage (bars route isn't in the test suite; chart logic lives in an HTML template literal).
- **Frontend deploy:** `vercel --prod --yes` in flight at write time.
- **Backend deploy:** BLOCKED — Railway CLI auth genuinely dead (refresh token expired, cached access token returns "Not Authorized" on backboard). Server changes safe in commit but live `/api/bars` still on old build until backend redeploys.

**What "lazy-load actually works" requires**
Until backend redeploys, the frontend will fetch `?before=...` against the OLD server, which ignores the unknown query param and returns the same recent 500 bars. The client dedupes them to zero, latches `hitFloor`, and the loading indicator stops blinking. Graceful no-op — no infinite loop, no errors.

**Next agent:** Backend deploy of `e9f5ef7` is the unblock. Either:
1. User runs `railway login` from their shell, then `cd server && railway up --detach`.
2. Or wait for the Railway auto-deploy hook to fire on GitHub push (if configured — currently uncertain).

---

## 2026-05-22T11:33Z -- T.9 Hedging mode

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **T.9 Hedging mode**
**Commit:** `e6f57fa`

**Pre-run check**
Stale WSL HEAD.lock as usual. `git read-tree HEAD` confirmed disk==HEAD except:
- `server/src/routes/bars.ts` — pre-corrupted with partial T.21 work (truncated
  mid-word). Restored from HEAD.
- `components/pro/Chart.tsx` — same: partial T.21 additions but truncated. Restored.
Both restorations done via Python before any T.9 work started.
Client tsc: exit 0. Server tsc: exit 0. Tests: 68 passed before starting.

**What changed**
- `supabase/migrations/022_hedging_mode.sql` (new): adds
  `hedging_enabled boolean not null default false` to accounts. **NOT applied
  to live DB** — apply before backend deploy:
  `SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/022_hedging_mode.sql`
- `server/src/routes/orders.ts`: netting block runs after margin reservation
  for market orders when `hedging_enabled=false`. Queries for an open opposing
  position on (account, symbol, opposite-side). On match: full or 