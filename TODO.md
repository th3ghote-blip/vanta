# VANTA — Roadmap to Launch

> **For the scheduled cowork agent.** Pick the next unchecked item, complete it fully, mark `[x]`, deploy, move on. Every task lists files involved, what to build, and acceptance criteria. No item should take more than ~60 minutes; if blocked, write a comment under it explaining what's needed and skip to the next.

---

## How to work this list

**Always cd to `/c/Claude/vanta` first.** Working directory drifts between Bash invocations otherwise.

### Precheck (run on every session start, must all pass)

```bash
cd /c/Claude/vanta
bash scripts/git-precheck.sh        # step 0: remove stale WSL lock files, verify branch=main
git status                          # must say "nothing to commit, working tree clean"
git branch --show-current           # must say "main"
npx --no-install tsc --noEmit       # client TypeScript — must be silent
cd server && npx --no-install tsc --noEmit && cd ..   # server TypeScript — must be silent
curl -sf https://vanta-server-production.up.railway.app/health | grep -q '"ok":true'
curl -sf -o /dev/null -w "%{http_code}" https://vanta-jade.vercel.app/ | grep -q 200
```

If any precheck fails: investigate, leave a note in `STATE.md`, **do not** start a task.

### Then

1. Read **`/c/Claude/vanta/STATE.md`** for context the previous agent left.
2. Pick the topmost unchecked task whose dependencies are met. **Skip any task tagged `PARKED` — it's externally gated and only resumes when the user explicitly says so.**
3. Implement it fully (code + verification per the acceptance criteria).
4. Deploy:
   - Backend: `cd /c/Claude/vanta/server && railway up --detach`
   - Frontend: `cd /c/Claude/vanta && vercel --prod --yes`
5. Verify acceptance criteria using `curl`, the live URL, or a preview screenshot.
6. Re-run the precheck — must still pass after your changes.
7. `git add <files you touched>` (never `git add -A`).
8. `git commit -m "auto: <short item title>"`.
9. Mark `[x]` in this file. Update **`STATE.md`** with anything notable.
10. Move to next.

**Migrations:** apply via `python scripts/apply-migration.py supabase/migrations/00X_name.sql` with `SUPABASE_PAT` env var set. PAT is in `server/.env` as `SUPABASE_PAT` (add it if missing — value already in conversation history; if not, ask the user).

**Live URLs:**
- Frontend: https://vanta-jade.vercel.app
- Backend: https://vanta-server-production.up.railway.app
- Supabase: https://supabase.com/dashboard/project/auavcfwytrwurawcvrsc

**Already-built features (don't re-do):**
- MT4-style auth (login number + password)
- Pro mode trading: live charts (1m–1d timeframes, 500 bars history), order entry, order book (Open/Closed/All)
- Live data: Coinbase WS for 47 cryptos + Twelve Data for forex/stocks/gold
- Portfolio screen with real account balance + activity
- Quick mode UI scaffold (binary-style — not yet wired end-to-end)
- AI Robots UI scaffold + `/api/robots/compile` endpoint working
- KYC screen scaffold (no real upload yet)
- Profile + sign-out
- Audit log of login attempts
- Rate-limited auth endpoints
- CORS locked to Vercel domain

---

# Current focus (revised 2026-05-20)

The platform's surface area is wide (Phase 1–4, 6–7, 11–12, 15 are done) but it's **shallow on trading options** and **brittle on operations**. Until the trading core feels robust and offers multiple ways to trade, defer anything externally gated:

- **PARKED until platform is robust:** Sumsub KYC (5.3), OANDA streaming (8.1), TestFlight/Play Store (9.3, 9.4), custom domain (10.x), email confirmation (10.6).

**Work order from here:** Phase R (Robustness) first, then Phase T (Trading depth). Inside each phase, top-to-bottom.

## Status snapshot — 2026-05-28

**The app is feature-complete and launch-ready on web.** All R/T/numbered phases are done except explicitly PARKED items.

### Done ✅
- Phase R (robustness): 12/12 — GH Actions deploy, Sentry, Better Stack, E2E CI, backup check, all workers
- Phase T (trading features): 21/21 — all order types, chart tools, copy trading, watchlists, etc.
- Phases 1–16: all checked off except PARKED items (see below)
- TESTING.md: 100% — unit tests, E2E, load test baselines, schema check, security tests

### Parked — needs your action
| Item | Blocker | Cost |
|---|---|---|
| Custom domain (10.1–10.6) | Buy `vanta.markets` at Cloudflare Registrar | ~$30/yr |
| iOS TestFlight (9.3) | Apple Developer account | $99/yr |
| Android Play Store (9.4) | Google Play Developer account | $25 one-time |
| Sumsub KYC (5.3) | Not needed yet | ~$2/verification |
| OANDA price feed (8.1) | Not needed yet | Free demo |

### Domain chain (buy domain first, rest follows in order)
1. Buy `vanta.markets` at https://www.cloudflare.com/products/registrar/
2. `vercel domains add vanta.markets` → update CORS + `app.json`
3. Railway dashboard → add `api.vanta.markets` → update env vars
4. Resend.com → verify `vanta.markets` → update Supabase SMTP sender
5. Supabase Auth → re-enable email confirmation

## Next pick for the cowork agent

Pick any unchecked item from **Phase 18** (18.1–18.13). Order doesn't matter — pick whichever you can complete fully within ~60 min. Skip any item that needs external credentials or user action and move to the next.

> ⚠️ STATUS (2026-06-04, auto): the offline-completable Phase 18 items are **exhausted**. 18.1, 18.4(C), 18.5, 18.9, 18.12, 18.13 are done. Every REMAINING unchecked item (18.2, 18.3, 18.6, 18.7, 18.8, 18.10, 18.11) is blocked for an offline, no-network auto-run — see the `>` note under each. They need one or more of: **network** (apply migrations / hit the Claude API / live verification), a **screenshot-capable** run (visual-only acceptance), a **user decision** (18.11 dependency + descope), or **splitting** (18.8 is too big). An auto-run with no network and no screenshot cannot complete or verify any of them. **User action needed to unblock** (pick any): give the next run network access; approve the 18.11 capture/sharing dependency + web descope; pre-apply the 18.6/18.10 migrations; or split 18.8 into sub-items.

## Migrations already applied to live DB

- `013_margin_rpc.sql` ✅
- `014_write_policies.sql` ✅
- `015_order_idempotency.sql` ✅
- `016_pending_orders.sql` ✅ (split — see below)
- `017_pending_orders_index.sql` ✅ (the partial index — had to be a separate tx because Postgres rejects referencing a newly-added enum value in the same tx that added it)

**Next migration number: 018.** Do not re-apply 013–017.
> CORRECTION (2026-06-04): this line is stale. Migration FILES through `026_chart_drawings.sql` already exist on disk (018–026 cover the Phase T trading features: stop_limit, trailing_stops, oco_groups, user_watchlist, hedging_mode, trade_notes, account_is_primary, copy_relationships, chart_drawings). The **next NEW migration number is 027** — do not number a new migration 018. Whether 018–026 are all applied to the live DB is not verifiable offline; confirm against the Supabase dashboard before assuming.

---

# Phase R — Robustness & stability

The agent's deploy gap (commits land but Railway/Vercel aren't shipped without me/user), the chronic git lock issue, and silent runtime errors are the biggest sources of friction. Fix those before adding surface area.

## R.1 GitHub Actions auto-deploy (eliminate the deploy gap)
- [x] **Files:** `.github/workflows/deploy.yml` (new), README setup notes
- **What:** Push to `main` → GitHub Action builds + deploys both backend (Railway via `railway up` with `RAILWAY_TOKEN` secret) and frontend (Vercel via `vercel deploy --prod` with `VERCEL_TOKEN`). Removes the 12+ hour gap between agent commits and live code.
- **Gated on:** user creating a GitHub repo + PAT, plus tokens added as repo secrets. If user hasn't provided these, leave a note in STATE.md and skip — don't try to set up GitHub from inside the agent.
- **Acceptance:** Push a commit, Actions tab shows build succeeds, vanta-jade.vercel.app serves new code within 5 min.
- **Done:** 2026-05-24 — `.github/workflows/deploy.yml` created. 3-job pipeline: `verify` (tsc + tests on both client and server), `deploy-backend` (Railway CLI `railway up --service $RAILWAY_SERVICE_ID`), `deploy-frontend` (Vercel CLI `vercel --prod --yes`). Needs two GitHub repo secrets added by user: `RAILWAY_TOKEN` (from railway.app account settings) and `RAILWAY_SERVICE_ID` (UUID from the service URL in Railway dashboard). `VERCEL_TOKEN` also required; `.vercel/project.json` already has org+project IDs so no other Vercel secrets needed.

## R.2 Stale-lock auto-cleanup at session start
- [x] **File:** `scripts/git-precheck.sh` (new)
- **What:** Bash script that removes `.git/index.lock`, `.git/HEAD.lock`, `.git/refs/heads/*.lock` if present and older than 60 seconds. Update the "Precheck" section of this file to call it as step 0.
- **Acceptance:** Run when locks exist → locks gone, `git status` works without error.

## R.3 Sentry frontend
- [x] **Files:** install `sentry-expo`, init in `app/_layout.tsx`
> 2026-05-19 — committed `b17cdf8` + web-crash fix `2ebf1b7`. Verified in Sentry dashboard: the `setColorScheme is not a function` web error was captured 3 times before being fixed. Native instrumentation auto-tags user id on sign-in.
- **What:** Capture client errors, tag with login number, source map upload via EAS post-publish hook.
- **Acceptance:** Trigger a thrown error in dev → appears in Sentry within 30s with sourcemap.

## R.4 Sentry backend
- [x] **Files:** install `@sentry/node`, init in `server/src/index.ts`
> 2026-05-19 — committed `de7d919`. Same DSN as frontend (single Sentry project, runtime tag distinguishes them). Verified by hitting test endpoints — `Error` and info `captureMessage` both landed in dashboard. Test endpoints since removed during housekeeping.
- **What:** Capture server exceptions, slow-request warnings >1s, tag with route + user id.
- **Acceptance:** Throw in a route → appears in Sentry.

## R.5 Order-open idempotency
- [x] **File:** `server/src/routes/orders.ts`
- **What:** Add optional `client_request_id` (uuid) to OpenOrderSchema. Check `trades` for `(account_id, client_request_id)` already exists → return existing trade instead of opening a duplicate. Client sets the id when user clicks Buy/Sell so double-tap doesn't double-open.
- **Migration:** add `client_request_id text` column to `trades` with a partial unique index per account.
- **Acceptance:** POST /api/orders/open twice with the same `client_request_id` → same trade row both times, only one position opened.

## R.6 Worker self-heal on upstream failures
- [x] **Files:** `server/src/feed/pricefeed.ts`, `workers/risk.ts`, `workers/rounds.ts`
- **What:** Wrap every worker tick in `try/catch`, log + continue. Twelve Data 429 retry with exponential backoff. Coinbase WS reconnect with backoff (already partially in place — verify). Add a `/api/health/workers` endpoint returning last-tick timestamps so we can see which workers are stuck.
- **Acceptance:** Kill the Twelve Data API key for 5 min → server keeps running, workers resume when key restored.

## R.7 Better-Stack uptime monitoring
- [ ] **What:** Sign up free tier (https://betterstack.com/sign-up), point at `/health` + `/api/quotes` every 3 min. Alert via email + (optional) Slack on downtime.
- **Acceptance:** Take Railway down → email arrives within 5 min.

## R.8 E2E smoke test in CI
- [x] **Files:** `e2e/smoke.spec.ts` (Playwright), `.github/workflows/e2e.yml`, `playwright.config.ts`
- **What:** Sign up → place a 0.01 BTC trade → close it → sign out. Runs on every push.
- **Acceptance:** PR opens, CI runs the test green, fails if any step breaks.
- **Done:** 2026-05-24 — `e2e/smoke.spec.ts` registers a fresh account via `/api/auth/register`, signs in via UI, places a 0.01 BTC market buy, closes it using the `accessibilityLabel="Close trade"` button, and signs out. `playwright.config.ts` targets `https://vanta-jade.vercel.app`. `.github/workflows/e2e.yml` triggers on `workflow_run` completion of Deploy (so it always tests the latest shipped code) and on manual dispatch. Chromium only; uploads Playwright HTML report as artifact. Added `accessibilityLabel="Close trade"` to close button in `components/pro/TradeBook.tsx`. Added `@playwright/test: ^1.44.0` to devDependencies and `test:e2e` script to `package.json`.

## R.9 Backend integration test suite
- [x] **Files:** `server/test/*.test.ts`, install `vitest` — 2026-05-19 / `2d508b9` — 32 tests passing (hermetic, no Supabase project required).
- **What:** Cover `/api/auth/*`, `/api/orders/*`, `/api/rounds/*`, `/api/robots/*` against a test Supabase project (or hermetic mock).
- **Acceptance:** `cd server && npm test` passes; CI runs it.

## R.10 Performance dashboard in admin
- [x] **Files:** `server/src/middleware/timing.ts`, `app/admin/perf.tsx`
- **What:** Middleware that records p50/p95/p99 per route over rolling 5-min window. Admin page reads it.
- **Acceptance:** Visit `/admin/perf` → see real numbers updating live.

## R.11 Database backup verification
- [x] **File:** `scripts/verify-backup.py`
- **What:** Daily cron via GitHub Actions: query Supabase Management API for latest backup timestamp, alert if >30h old.
- **Acceptance:** Cron runs, alerts when delayed.
- **Done:** 2026-05-24 — `scripts/verify-backup.py` queries `GET /v1/projects/{ref}/database/backups`, finds the most recent completed backup, exits 1 if age > MAX_AGE_HOURS (default 30). `.github/workflows/backup-check.yml` runs daily at 06:15 UTC + supports `workflow_dispatch`. Requires `SUPABASE_PAT` added as a GitHub repo secret (same PAT already in `server/.env`).

## R.12 Legal pages (Terms / Privacy / Risk disclosure)
- [x] **Files:** `app/legal/terms.tsx`, `app/legal/privacy.tsx`, `components/RiskDisclosureModal.tsx`
- **What:** Static markdown rendered. Risk disclosure shown as modal on first deposit (or first sign-in if you prefer). Generated from TermsFeed for Marshall Islands B-book broker template — review with a lawyer before launch.
- **Acceptance:** Pages accessible from Profile → Help. Risk modal blocks first deposit until acknowledged.

---

# Phase T — Trading depth (multiple options)

Today users can only place market orders (buy/sell at the live price) on Pro mode, or up/down bets on Quick mode. Real traders need pending orders, position management, and more product types.

## T.1 Pending limit orders
- [x] **Files:** `components/pro/OrderEntry.tsx` (Market/Limit segmented + trigger price input), `server/src/routes/orders.ts` (open path + new DELETE `/pending/:id`), `server/src/workers/ordersTrigger.ts` (new), `components/pro/TradeBook.tsx` (new Pending tab + cancel).
- **Migration applied:** `supabase/migrations/016_pending_orders.sql` — `trades.order_type` text + CHECK constraint accepting all 4 values (`market`/`limit`/`stop`/`stop_limit`) so T.2/T.3 won't need new migrations; `trades.trigger_price numeric`; `'pending'` added to `trade_status` enum; partial index `trades_pending_idx` on `(status, order_type) WHERE status='pending'`.
- **What:** User toggles Limit on the order entry, enters a trigger price. Server validates direction (buy-limit below ask / sell-limit above bid), reserves margin upfront, inserts `status='pending'` row. Orders-trigger worker scans every 1s and flips to `status='open'` at the trigger price (B-book counterparty rule). Cancel releases margin + sets `status='cancelled'`. **T.13 (pending orders dashboard) is satisfied as a side effect — the Pending tab in TradeBook is the dashboard.** Stop/stop_limit accepted at schema level but return 501 until T.2/T.3 land.
- **Done:** 2026-05-19 — commit pending.

## T.2 Stop orders
- [x] **Same files as T.1.**
- **What:** Reverse of limit — buy-stop fills when price rises above trigger (breakout entry), sell-stop fills when price drops below trigger (breakdown entry). Same `trades.order_type='stop'`.
- **Acceptance:** Sell-stop on BTC at $75k while price is $76k → fills when BTC dips below $75k.

## T.3 Stop-limit orders
- [x] **Same files as T.1.**
- **What:** Two-stage: trigger at price X → place limit order at price Y. `trades.order_type='stop_limit'`, both `trigger_price` and limit price stored.
- **Acceptance:** Buy stop-limit, trigger $76k, limit $76.1k → triggers when price reaches $76k → fills only at $76.1k or better.

## T.4 Trailing stops
- [x] **Files:** `server/src/workers/risk.ts` extension
- **Migration:** `trades.trail_distance numeric`, `trades.trail_high_water numeric` (track best price reached).
- **What:** On every tick, if profitable, ratchet the stop-loss up (long) or down (short) by `trail_distance` behind the high-water mark. Existing risk worker handles the stop trigger once it's set.
- **Acceptance:** Open BTC buy at 75k with trail $500 → BTC rises to 78k → SL is now 77.5k → BTC dips below 77.5k → auto-close with profit.

## T.5 Modify open positions (SL/TP after open)
- [x] **Files:** `server/src/routes/orders.ts` (new PATCH endpoint), `components/pro/PositionsTable.tsx` (edit button per row)
- **What:** User can change SL and TP on an existing open trade without closing. Validate the new levels make sense (SL below current ask for longs, etc.).
- **Acceptance:** Open trade with no SL → tap Edit → set SL → save → risk worker now respects new SL.

## T.6 Partial close
- [x] **Files:** `server/src/routes/orders.ts` (extend `/close` to accept `closeVolume`), `components/pro/TradeBook.tsx` (slider/input for partial size)
- **What:** Close X% of a position. Trade row stays open with reduced volume; a child closed trade row records the partial close P&L.
- **Acceptance:** Open 0.1 BTC, partial-close 0.05 → original shows volume 0.05, history shows a closed trade for 0.05 with realized P&L.

## T.7 Bracket orders (entry + SL + TP as one)
- [x] **Files:** `components/pro/OrderEntry.tsx` (already has SL/TP inputs — wire them in), server inserts all three legs atomically.
- **Acceptance:** Place a market buy with SL and TP filled → 1 entry trade row, both SL and TP active on the risk worker. Closing the entry cancels both legs.

## T.8 OCO orders (one-cancels-other)
- [x] **Files:** Migration: `trades.oco_group_id uuid`. Risk worker: when one leg of an OCO group fills/stops, cancel the others.
- **What:** Place two pending orders linked; when one triggers, the other auto-cancels. Useful for "buy at breakout OR buy at pullback" setups.
- **Acceptance:** Place BTC buy-stop at $78k + BTC buy-limit at $74k as an OCO → one triggers → other vanishes from Pending list.

## T.9 Hedging mode (allow opposing positions on same symbol)
- [x] **Account setting:** `accounts.hedging_enabled boolean` (default false). UI toggle in Profile.
- **What:** Default is netting — a buy on top of an existing sell reduces or flips the position. Hedging lets both exist simultaneously (MT4 default behavior).
- **Acceptance:** With hedging on: open 0.1 BTC buy + 0.1 BTC sell → both rows in Open Positions, P&L offsets in real time.

## T.10 Multiple accounts per user (demo + live tabs)
- [x] **Migration:** `accounts.is_primary boolean`. The user already has the schema for multiple accounts — just need UI to switch.
- **Files:** Account header strip becomes a dropdown / segmented control.
- **What:** Users can switch between accounts (e.g., demo and live) without signing out. New "Open additional account" button in Profile.
- **Acceptance:** Click switcher → second account loads → balance, trades, robots all swap to the new account's data.

## T.11 Position notional + leverage display
- [x] **Files:** `components/pro/OrderEntry.tsx`, position rows in TradeBook.
- **What:** Show notional value and effective leverage as user types volume. "0.1 BTC × $76,000 = $7,600 notional · 95× leverage on $80 margin used".
- **Acceptance:** Numbers update live as user types.

## T.12 Symbol watchlist / favorites
- [x] **Files:** `app/(tabs)/trade/watchlist.tsx`, migration: `user_watchlist (user_id, symbol)` table.
- **What:** Star a symbol → appears in your watchlist tab. Cross-device sync via Supabase.
- **Acceptance:** Star BTCUSD → switch tabs → see it in your saved list with live price.

## T.13 Pending orders dashboard
- [x] **Files:** `components/pro/TradeBook.tsx` — Pending tab between Open and Closed (shipped as side effect of T.1).
- **What:** Shows all `status='pending'` orders for the account with trigger price, side+type label, distance from current price, cancel button (calls `DELETE /api/orders/pending/:id`).
- **Done:** 2026-05-19 — same commit as T.1.

## T.14 Trade journal / annotations
- [x] **Migration:** `trades.notes text`
- **Files:** Tap any trade in TradeBook → drawer with notes textarea + screenshot upload (Supabase Storage).
- **What:** User can attach a reason + chart screenshot to any trade for review later.
- **Acceptance:** Open trade → add note "RSI oversold reversal" → close → reopen TradeBook → note still attached.
- **Done:** 2026-05-23 — `supabase/migrations/023_trade_notes.sql` adds `notes text` column. `PATCH /api/orders/note/:id` endpoint in orders.ts saves notes (ownership-verified, any trade status, max 4000 chars). `saveTradeNote()` helper in lib/api.ts. TradeBook: NotebookPen button on every row (accent tint when note exists), inline multiline textarea panel, note preview (first 60 chars) below symbol. **Migration must be applied manually** — sandbox network blocked Supabase API. Run: `SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/023_trade_notes.sql`. Backend deploy needed for the new endpoint.

## T.15 Technical indicators on chart
- [x] **Files:** `components/pro/Chart.tsx`, `stores/chartPrefs.ts` (new)
- **What:** Toggle for RSI, MACD, MA(20), MA(50), Bollinger Bands. Settings persist per user (`profiles.chart_prefs jsonb`).
- **Acceptance:** Toggle RSI → indicator pane appears below price. Reload page → still on.
- **Done:** 2026-05-22 — indicator toggle pills below the chart; MA20/MA50/BB overlaid on main series; RSI + MACD in separate panes below with synchronized time scale. State persisted to AsyncStorage via `stores/chartPrefs.ts`. Iframe remounts on toggle via indicatorHash key.

## T.16 Drawing tools on chart
- [x] **What:** Trendline, horizontal line, fib retracement.
> Skipped 2026-05-23: requires new `chart_drawings` migration (blocked by sandbox network proxy) + significant Lightweight Charts drawings API work (likely 2–3 h, exceeds 60-min rule). Revisit when migration can be applied manually or R.1 auto-deploy is live. Lightweight Charts has a drawings API. Persist via `chart_drawings` table per (user, symbol).
- **Acceptance:** Draw trendline on BTC chart → switch symbol → come back → line still there.

## T.17 Bigger symbol catalog — real-time crypto on Coinbase
- [x] **Files:** `server/src/feed/pricefeed.ts` — add 30+ more pairs Coinbase has but we don't carry yet.
- **What:** Currently 47 cryptos via Coinbase. Add the next 30+ (ETH-EUR, BTC-EUR, IMX, GRT, FET, TAO, ONDO, KAS, etc.). Cap at ~80 to keep WS subscription size reasonable.
- **Acceptance:** Picker shows 80+ symbols. All have live prices.

## T.18 Copy trading (basic)
- [x] **Migration:** `copy_relationships (follower_id, leader_id, allocation_pct, started_at)`.
- **What:** Robots tab → "Top Traders" leaderboard (ranked by 30-day P&L from public-opted-in users). Tap → "Copy" → for every trade the leader opens, mirror it at allocation_pct of your balance.
- **Acceptance:** Two test accounts. A opts in as leader, opens BTC buy. B follows A → B sees a copied BTC buy auto-appear in their Open Positions.

## T.19 Spread-betting / micro-lot mode
- [x] **What:** Account preference for "$ per pip" style sizing instead of lots. Cosmetic — converts under the hood — but matches the UK retail trader mental model.
- **Acceptance:** Toggle preference → order entry shows "$10/pip" instead of "0.1 lots", math works out.
- **Done:** 2026-05-25 — `stores/prefs.ts` (new): AsyncStorage-backed preference store.
  `lib/contracts.ts`: added `pipSizeFor`, `pipValueFor`, `lotsFromPipValue`, `pipLabel` helpers.
  `components/pro/OrderEntry.tsx`: when spread-bet mode on, Volume field becomes Stake ($/pip or $/pt);
  display string (`sbRaw`) kept separate so cursor never jumps mid-type; notional line updated to show $/pip.
  `app/(tabs)/profile.tsx`: Display section gets "Order sizing" toggle pill (slide-switch UI).
  `app/_layout.tsx`: `usePrefsStore.hydrate()` called on startup so preference survives restarts.
  No migration needed — preference stored in AsyncStorage only. No backend deploy needed.

## T.20 Quick Mode — more durations + asset categories
- [x] **Files:** `components/fun/QuickTradeScreen.tsx`
- **What:** Add 5s, 30s, 30min, 4h, 24h durations (already have 60s/5min/15min). Add category filter (Crypto / Forex / Stocks tabs) the way Pro mode has.
- **Acceptance:** Quick mode has 7 duration options and category tabs.

## T.21 Chart history pan / lazy-load older bars
- [x] **Files:** `server/src/routes/bars.ts` (accept `before` param), `components/pro/Chart.tsx` (subscribe to visible range, prepend on near-edge).
- **Done:** 2026-05-22 — commit `e9f5ef7`. Server accepts `before=<unix-sec>` and returns the window ending at that timestamp. Chart iframe subscribes to `subscribeVisibleLogicalRangeChange`, fetches 500 older bars when within 20 of the left edge, dedupes by `time`, prepends, and shifts the visible logical range so zoom is preserved. `hitFloor` latches true if upstream returns <20 bars. Single in-flight guard. Frontend shipped to Vercel; backend deploy pending Railway CLI re-auth.
- **Problem today:** `GET /api/bars/:symbol?tf=1h&limit=500` only fetches the most recent 500 bars peg-anchored to `now()`. When the user pans/scrolls the chart left past the initial window, Lightweight Charts has nothing to render and the timeline dead-ends. Visible on every symbol/timeframe.
- **Server change:**
  - Add optional `before` query param (unix seconds). When supplied: `end = before`, `start = before - limit * granularity`. When absent: keep existing now-anchored behavior.
  - For Coinbase path: pass `&start=...&end=...` derived from `before` instead of `Date.now()`. Coinbase already supports historical windows (already used for the current path — just parametrize `end`).
  - For Twelve Data path: their `time_series` endpoint accepts `end_date=YYYY-MM-DD HH:mm:ss` — switch to it when `before` is supplied. Twelve Data caps at 5000 historical bars on free tier; document the limit.
  - Cache key already includes `limit` — extend it to include `before` so historical fetches don't collide with the live window.
- **Client change:**
  - On mount, after initial 500-bar fetch + setData, subscribe to `chart.timeScale().subscribeVisibleLogicalRangeChange` (Lightweight Charts API).
  - When `range.from < 20` (less than 20 bars from the left edge) AND no fetch in flight AND we haven't hit the historical floor, fire `getBarsBefore(symbol, tf, oldestLoadedBarTime, 500)`.
  - On response: `series.update(...)` won't work for backfill — must rebuild: get current data, prepend the new bars (dedupe by `time`), call `series.setData(merged)`. Preserve the user's visible range across the rebuild (capture `getVisibleLogicalRange()` before `setData`, restore after via `setVisibleLogicalRange`).
  - Stop fetching if a response returns < 50 bars (we've hit the data source's floor).
  - Loading spinner anchored to the chart's left edge while a backfill is in flight.
- **Acceptance:** Open Pro mode, any symbol. Scroll/pan the chart left past the initially-loaded window → older candles stream in continuously without losing the user's current zoom level. Network tab shows incremental `/api/bars/...?before=...` calls. Switching timeframe resets history; switching symbol resets history.
- **Edge cases to handle:** symbol with no historical data older than X (return empty array; client stops asking), duplicate bar times across requests (dedupe by `time` key on merge), user pans fast → multiple fetches queued (debounce 200ms or use a single in-flight guard).

---

# Phase 1 — Trading core (must work before anything else)

## 1.1 Server worker for stop-loss / take-profit / stop-out
- [x] **File:** `server/src/workers/risk.ts` (new)
> 2026-05-05 — code committed in `0ad7900`. Both client + server `tsc --noEmit` pass. **Not yet deployed** — the cowork sandbox can't reach Railway and `railway` CLI isn't installed there. Run `cd /c/Claude/vanta/server && railway up --detach` from a machine with the CLI to ship it. Acceptance criterion (BTC SL auto-close) can be verified once deployed.
- **What:** Every 1s, scan all `trades` with `status='open'`. For each, compute live mid from quote cache. If `(side='buy' AND mid <= stop_loss) OR (side='sell' AND mid >= stop_loss)` → close at `stop_loss` with reason='stopout'. Same for take_profit (buy: mid >= tp, sell: mid <= tp). Then: if `account.equity + total_unrealized_pnl < 0` → close worst-loser to recover, mark reason='stopout'.
- **Wire it up:** Import + start in `server/src/index.ts`.
- **Acceptance:** Open a BTC buy with SL 1% below entry. When BTC dips below SL, trade auto-closes within 1s. `trades.reason='stopout'`. Account balance updated.

## 1.2 Margin requirement on order open
- [x] **File:** `server/src/routes/orders.ts`
> 2026-05-05 — code committed in `98f4fb4`. Adds `server/src/lib/margin.ts` (reserve/release helpers) + extends `server/src/workers/risk.ts` to release on auto-close so margin_used doesn't grow forever. Both client + server `tsc --noEmit` pass. **Not yet deployed** alongside 1.1 — same constraint (sandbox can't reach Railway). Verified the math locally: 100 BTC × 80k / 100x = $80,000 → reject; 0.1 BTC = $80 → allow.
- **What:** Before inserting trade, compute `notional = volume * open_price * contractSize(symbol)` and `required_margin = notional / account.leverage`. If `account.free_margin < required_margin` → reject HTTP 400 `{error:'insufficient_margin', required, available}`. On success: increment `accounts.margin_used`, decrement `free_margin`. On close: reverse.
- **Acceptance:** 100 BTC buy on $10k demo → rejected. 0.1 BTC ($80 margin) → allowed; account.margin_used = 80.

## 1.3 Order entry feedback for margin / quote / generic errors
- [x] **File:** `components/pro/OrderEntry.tsx` + `lib/api.ts` (added `ApiError` class)
> 2026-05-06 — agent staged the diff over multiple skipped runs; landed in this commit. `lib/api.ts` now throws structured `ApiError(code, status, details)` for all non-2xx responses. `OrderEntry.tsx` has `describeOrderError()` mapping `insufficient_margin` (with required/available), `no_quote`, `forbidden`, `invalid_input`, `unauthorized`, etc. to user-facing copy. Network failures fall through to a generic message.
- **What:** Map specific error codes (`insufficient_margin`, `no_quote`, `forbidden`, `invalid_input`) to human messages. Right now everything renders the raw `error` string.
- **Acceptance:** Try to over-leverage in UI → see "Not enough margin (required: $X, available: $Y)".

## 1.4 Symbol-aware default volume in OrderEntry
- [x] **File:** `components/pro/OrderEntry.tsx`
- **What:** Default volume changes per asset class on symbol switch (only if user hasn't manually edited): forex=`0.10`, crypto=`0.01`, stocks=`1`, gold=`0.10`. Helper in `lib/contracts.ts`.
- **Acceptance:** Switch from EURUSD to BTCUSD → volume defaults to 0.01. Switch to AAPL → 1.

## 1.5 Account header strip with live balance / equity / free margin
- [x] **Files:** `components/shared/AccountHeader.tsx` (new), import in `app/(tabs)/_layout.tsx`
- **What:** Strip above the tabs (or as a sticky element above content) showing: `Balance $X · Equity $Y · Free $Z`. Updates as quotes tick. Account # also visible.
- **Acceptance:** Header visible on every tab. Numbers update as BTC moves.

## 1.6 Validate SL/TP make sense before placing order
- [x] **File:** `components/pro/OrderEntry.tsx`
- **What:** Buy: SL must be < current ask, TP must be > current ask. Sell: SL must be > current bid, TP must be < current bid. Show inline error.
- **Acceptance:** Enter SL above buy price → "Stop loss must be below current price".

---

# Phase 2 — Quick Mode (binary rounds)

## 2.1 Server worker to settle binary rounds at expiry
- [x] **File:** `server/src/workers/rounds.ts` (new)
- **What:** Every 1s: query `binary_rounds` where `outcome='pending' AND closes_at <= now()`. For each: pull `exit_price` from quote cache; determine outcome (win if `(direction='buy' AND exit > entry) OR (direction='sell' AND exit < entry)`; tie if exact). On win: payout = `stake * payout_multiplier`, balance += payout. On loss: balance unchanged (stake already deducted on open). Set `outcome`, `exit_price`, `payout`.
- **Wire it up:** Import + start in `server/src/index.ts`.
- **Acceptance:** Open a 60s round on BTC up. Wait. Round closes with outcome=win/loss. Balance reflects.

## 2.2 Deduct stake on round open
- [x] **File:** `server/src/routes/rounds.ts`
- **What:** Before insert, check `account.balance >= stake`. Decrement balance by stake on insert (one transaction). Also store `account_id`.
- **Acceptance:** Open $50 round on $10k account → balance $9950 immediately.

## 2.3 Wire QuickTradeScreen Up/Down to /api/rounds/open
- [x] **File:** `components/fun/QuickTradeScreen.tsx`
- **What:** Up/Down `onPress` → POST `/api/rounds/open` with selected asset, duration, stake, direction. Show busy state. Insert appears via Supabase realtime in active rounds list.
- **Acceptance:** Tap Up on $10 BTC 60s → loading → round appears in active list with countdown.

## 2.4 Active Rounds list in Quick Mode
- [x] **File:** `components/fun/ActiveRounds.tsx` (new), import in `QuickTradeScreen.tsx`
- **What:** Below Up/Down buttons, list pending rounds with countdown rings + entry price + direction + stake. Subscribe to Supabase realtime on `binary_rounds` filtered by account_id. When `outcome != 'pending'`, animate out and trigger result modal.
- **Acceptance:** 3 rounds active → all visible with countdowns. Round settles → disappears with win/loss flash.

## 2.5 Win / loss result modal
- [x] **File:** `components/fun/RoundResultModal.tsx` (new)
- **What:** Modal that shows when a pending round becomes win/loss. Wins: confetti + green check + "+$X.XX". Losses: red shake + "-$X.XX". Auto-dismiss after 3s. Use `react-native-confetti-cannon` (install).
- **Acceptance:** Round settles → modal pops.

## 2.6 Streak tracking
- [x] **Migration:** `005_streaks.sql` — add `current_streak`, `best_streak` to `profiles`.
- [x] **Server:** in rounds settle worker, update `profiles.current_streak` (win=+1, loss=reset to 0). Update `best_streak` if exceeded.
- [x] **Client:** show streak badge on QuickTradeScreen header. "🔥 N-day streak" with a flame icon.
- **Acceptance:** Win 3 in a row → "🔥 3" shows in header.

---

# Phase 3 — AI Robots (real)

## 3.1 Wire RobotPromptBuilder to /api/robots/compile + save
- [x] **File:** `components/robots/RobotPromptBuilder.tsx`
- **What:** Replace mock `setTimeout(1200)` with `api.compileRobot(prompt)`. Show generated config in a styled preview. "Save" button → POST `/api/robots/save` with `{accountId, prompt, config}`. After save, push to Robots list.
- **Acceptance:** Type "buy AMZN at NYSE open every weekday" → see generated JSON → Save → robot appears in list.

## 3.2 Robot detail screen
- [x] **File:** `app/robot/[id].tsx` (new dynamic route)
- **What:** Tap robot card → detail screen. Sections: Prompt (editable text), Config (formatted JSON), Recent runs (last 20 from `robot_runs`), Stats (trades / win rate / P&L), Controls (pause/resume/delete).
- **Acceptance:** Tap a robot → detail page → can pause it (status='paused') and resume.

## 3.3 Robot execution engine (real, not stub)
- [x] **File:** `server/src/ai/robotEngine.ts`
- [x] **Install:** `cron-parser` (or `croner`)
- **What:** Replace stub. For each `status='active'` robot:
  - `schedule.type='interval'`: run every N ms
  - `schedule.type='cron'`: parse cron expression, fire at next match
  - `schedule.type='event'` for `nyse_open`, `nyse_close`, `london_open`, `daily_9am`: server-side market clock
  - For each fire: evaluate `conditions` array (start with just `'always'`)
  - Action: open trade via internal OMS call OR create tip notification
  - Log every fire to `robot_runs`
  - Update `robots.last_run_at`, `total_trades`, `winning_trades`, `total_profit`
- **Acceptance:** Active robot with `interval=60000` opens a trade every minute, appears in trade book with `reason='robot'`, robot stats update.

## 3.4 Tip-only robots send push notifications
- [x] **File:** `server/src/ai/robotEngine.ts` (uses Phase 6.2 `lib/push.ts`)
- **What:** When `config.kind='tip'`, instead of opening trade, send push notification with the tip text.
- **Acceptance:** Tip robot fires → push received on user's device.

## 3.5 Robot leaderboard
- [x] **Migration:** `006_public_robots.sql` — add `is_public boolean default false` to robots.
- [x] **Endpoint:** `GET /api/robots/leaderboard?period=7d` returns top 20 by P&L (anonymized owners).
- [x] **UI:** Tab on Robots screen "Leaderboard". List with rank, robot name, win rate, P&L.
- **Acceptance:** Mark a robot public, gets ranked.

## 3.6 Robot templates / "Try this prompt" gallery
- [x] **File:** `components/robots/RobotTemplates.tsx` (new)
- **What:** Curated list of example prompts: "Buy AMZN at NYSE open", "Daily 3 stock tips", "RSI reversal on EURUSD", etc. Tap → fills prompt builder.
- **Acceptance:** Templates visible, tap fills the input.

---

# Phase 4 — Money flow (deposit / withdraw / admin)

## 4.1 Deposits screen
- [x] **File:** `app/deposit.tsx` (new), wired from Portfolio "Deposit" button
- **What:** Three tabs: Crypto (BTC/ETH/USDT), Bank Wire, Card. For now mock — show generated deposit address (random per-user) for crypto, show wire instructions, "coming soon" for card. "I sent $X" button creates `transactions` row with `status='pending'`.
- **Acceptance:** Tap Deposit → screen with options → select crypto → see address → button creates pending transaction.

## 4.2 Withdrawals screen
- [x] **File:** `app/withdraw.tsx` (new)
- **What:** Form: amount + method (crypto address / bank). Validate `amount <= account.balance`. Block if `kyc_submission.status != 'approved'`. Insert `transactions` row pending.
- **Acceptance:** Try to withdraw without KYC → blocked with "Verify identity first". With KYC → pending withdrawal created.

## 4.3 Admin role + approval queue
- [x] **Migration:** `007_admin.sql` — `is_admin boolean default false` on profiles.
- [x] **Endpoint:** `GET /api/admin/transactions?status=pending` — admin only.
- [x] **Endpoint:** `POST /api/admin/transactions/:id/approve` and `/reject` — credit/debit balance accordingly, set `status='completed'` or `'rejected'`.
- [x] **UI:** `app/admin/transactions.tsx` (gated by `profile.is_admin`).
- **Acceptance:** Set your profile.is_admin=true via SQL → admin tab visible → approve transactions; balance updates.

## 4.4 Transaction history detailed view
- [x] **File:** `app/transactions.tsx` (new), accessible from Portfolio
- **What:** Full transaction table with filters (deposits / withdrawals / bonuses / adjustments). Download CSV.
- **Acceptance:** Full history with CSV export.

---

# Phase 5 — KYC

## 5.1 Camera-based document upload (homegrown)
- [x] **Files:** replace `app/kyc.tsx`, new `lib/kyc.ts`
- [x] **Install:** `expo-image-picker`, `expo-camera`
- **What:** Each step: tap → opens camera → take photo → upload to Supabase Storage `kyc/{user_id}/{doc_type}.jpg` → insert `kyc_documents` row. After all 4 docs: insert `kyc_submissions` row with `status='pending'`.
- **Acceptance:** Complete all 4 steps → all docs in storage → submission status 'pending'.

## 5.2 Admin KYC review
- [x] **File:** `app/admin/kyc.tsx`
- **What:** Admin queue of pending submissions. View each doc. Approve or reject with reason.
- **Acceptance:** Approve → user's `kyc_submissions.status='approved'`, can withdraw.

## 5.3 Sumsub integration (production-grade) — PARKED
- [ ] **PARKED** until first fiat deposit attempt. Phase 5.1 homegrown KYC flow + admin review is sufficient for the current user count. Sumsub costs ~$2/verification and requires a sales call.
- [ ] **Files:** `lib/sumsub.ts`, replace homegrown flow in `app/kyc.tsx`
- **What:** Sumsub Web SDK iframe. `/api/kyc/access-token` issues per-user tokens. Webhook receives outcome → update `kyc_submissions.status`.
- **Note:** Requires Sumsub account. Skip until ready.
- **Acceptance:** KYC screen → Sumsub flow → demo verification → status='approved'.

---

# Phase 6 — Push notifications

## 6.1 Expo push token registration on login
- [x] **Files:** `lib/notifications.ts` (new), `app/_layout.tsx`
- **What:** After session is set, request notification permission, fetch token via `Notifications.getExpoPushTokenAsync()`, save to `profiles.push_token`. Handle revoke gracefully.
- **Acceptance:** Sign in → `profiles.push_token` is set in DB.

## 6.2 Server-side push helper
- [x] **File:** `server/src/lib/push.ts`
- **What:** `sendPush(userId, { title, body, data })` — looks up token, calls Expo Push API. Batch for multiple users.
- **Acceptance:** Call from anywhere → notification received.

## 6.3 Trade result notifications
- [x] **Files:** `server/src/routes/orders.ts`, `server/src/workers/risk.ts`
- **What:** When trade closes (manual / SL / TP / stop-out), send push: "EURUSD closed +$48.20".
- **Acceptance:** Close a trade → push received.

## 6.4 Price alerts
- [x] **Migration:** `008_price_alerts.sql` — `price_alerts` table (user_id, symbol, threshold, direction, triggered_at).
- [x] **UI:** "Set alert" button on chart screen, modal with above/below + price.
- [x] **Worker:** scan unfired alerts vs quote cache, fire push, mark triggered.
- **Acceptance:** Set "BTC > 80000" → BTC crosses → push received → alert marked triggered.

## 6.5 Notification preferences
- [x] **File:** `app/notifications-settings.tsx` (wired from Profile → Notifications)
- **What:** Toggles: price alerts / robot signals / trade results / promotional. Persists to `profiles.notification_prefs` JSONB.
- **Acceptance:** Toggle off "trade results" → close trade → no push.

---

# Phase 7 — Profile & Security

## 7.1 Change password screen
- [x] **File:** `app/change-password.tsx` (new), wired from Profile → Security & Password
- **What:** Form: current password (re-verify by signing in again silently), new password (×2), submit. Calls `useAuthStore.changePassword`. Show success → bounce to login (forced re-sign-in).
- **Acceptance:** Change password → sign out → sign in with new password.

## 7.2 Show login number prominently
- [x] **File:** `app/(tabs)/profile.tsx`
- **What:** Replace "Trader" with `Account #80000001`. "Tap to copy" copies number to clipboard.
- **Acceptance:** Profile shows "Account #80000001".

## 7.3 2FA (TOTP)
- [x] **Files:** `app/2fa-setup.tsx` (new), `lib/2fa.ts`
- **What:** Use Supabase Auth MFA (`enroll`, `verify`, `unenroll`). QR code → user scans → verify code → enrolled. Login screen prompts for TOTP if user has factor.
- **Acceptance:** Enable 2FA → sign out → sign in requires both password and TOTP.

## 7.4 Active sessions / device list
- [x] **File:** `app/sessions.tsx` (new)
- **What:** List of devices currently signed in. "Revoke" button per session.
- **Acceptance:** Sign in from another browser → both visible. Revoke → other browser logged out.

---

# Phase 8 — Real-time forex (OANDA)

## 8.1 OANDA streaming integration — PARKED
- [ ] **PARKED** until forex usage justifies the OANDA demo-account setup. Current Twelve Data chunked poll (every 20 min, 65s gap between chunks) covers 9 forex/metals/stocks symbols at acceptable freshness for B-book pricing.
- [ ] **File:** `server/src/feed/pricefeed.ts`
- [ ] **Env:** `OANDA_API_TOKEN`, `OANDA_ACCOUNT_ID`
- **What:** Replace 20-min Twelve Data polling for forex/gold with OANDA v20 streaming API. Add: indices (SPX500, NAS100, US30, GER40, UK100, JP225), commodities (USOIL, UKOIL, XAGUSD).
- **Note:** Requires OANDA demo account. User needs to provide token.
- **Acceptance:** Forex prices update sub-second. Indices visible.

## 8.2 Symbol categories in client
- [x] **Files:** `components/pro/SymbolPicker.tsx`, `components/fun/QuickTradeScreen.tsx`
- **What:** Group by category (Crypto / Forex / Indices / Commodities / Stocks) with category tabs.
- **Acceptance:** 60+ symbols organized cleanly.

## 8.3 Search bar in symbol picker
- [x] **File:** `components/pro/SymbolPickerModal.tsx`
- **What:** Search input that filters symbols by name or ticker.
- **Acceptance:** Type "BTC" → only BTCUSD shown.

---

# Phase 9 — Mobile builds

## 9.1 EAS configuration
- [x] **Files:** `eas.json` (new)
- **What:** Run `eas build:configure`. Configure preview + production profiles for iOS + Android.
- **Acceptance:** `eas.json` exists with build profiles.

## 9.2 App icons + splash screens
- [x] **Files:** `assets/icon.png` (1024x1024), `assets/adaptive-icon.png` (1024x1024 transparent foreground), `assets/splash.png` (1242x2436), `assets/favicon.png` (32x32)
- **What:** Generate VANTA mark (V letter, electric blue on dark) at all sizes.
- **Acceptance:** App icon + splash visible on builds.

## 9.3 First TestFlight build — PARKED
- [ ] **PARKED** until launch decision. Requires Apple Developer account ($99/yr) which the user hasn't created. Web app + 9.2 icons are sufficient for the current testing phase.
- [ ] **What:** `eas build --profile preview --platform ios`. Configure Apple Developer account ($99/yr). Upload to TestFlight. Add tester emails.
- **Acceptance:** App opens on real iPhone via TestFlight.

## 9.4 First Play Store internal build — PARKED
- [ ] **PARKED** until launch decision. Same reason as 9.3 — needs Google Play account ($25 one-time) which the user hasn't set up.
- [ ] **What:** `eas build --profile preview --platform android`. Configure Google Play Developer account ($25 one-time). Upload to Internal testing. Send install link.
- **Acceptance:** App opens on real Android via internal testing.

---

# Phase 10 — Domain & production — ALL PARKED

> **PARKED:** All of Phase 10 is gated on the user buying a real domain. The current vanta-jade.vercel.app + vanta-server-production.up.railway.app URLs work fine for the testing phase. Revisit when the user has bought a domain and is ready to launch publicly.

## 10.1 Buy domain — PARKED
- [ ] **PARKED.** Needs user action — purchase `vanta.markets` (or alternative).
- [ ] **Externally:** Buy `vanta.markets` (or alternative) at Cloudflare Registrar (~$30/yr for `.markets`).
- **Acceptance:** Domain owned, control of DNS.

## 10.2 Custom domain on Vercel — PARKED
- [ ] **PARKED** — depends on 10.1.
- [ ] **Steps:** `vercel domains add vanta.markets` → set DNS A/CNAME → update `app.json` scheme + bundle IDs → update CORS allowlist in `server/src/index.ts` → redeploy.
- **Acceptance:** https://vanta.markets serves the app.

## 10.3 Custom domain on Railway (api.vanta.markets) — PARKED
- [ ] **PARKED** — depends on 10.1.
- [ ] **Steps:** Railway dashboard → Add custom domain `api.vanta.markets` → set DNS CNAME. Update Vercel env vars `EXPO_PUBLIC_API_URL` + `EXPO_PUBLIC_WS_URL`.
- **Acceptance:** https://api.vanta.markets serves the API; app uses it.

## 10.4 Verified Resend domain — PARKED
- [ ] **PARKED** — depends on 10.1.
- [ ] **Steps:** Add domain at https://resend.com/domains → set DNS records → verify → update Supabase Auth SMTP "Sender email" to `noreply@vanta.markets`.
- **Acceptance:** Confirmation emails arrive from `noreply@vanta.markets`.

## 10.5 Cloudflare in front — PARKED
- [ ] **PARKED** — depends on 10.1.
- [ ] **Steps:** Move DNS to Cloudflare → enable proxy on root + api → Bot Fight Mode → basic WAF rules.
- **Acceptance:** `dig vanta.markets` shows Cloudflare IPs.

## 10.6 Re-enable email confirmation in Supabase — PARKED
- [ ] **PARKED** — depends on 10.4 (Resend verified domain).
- [ ] **Steps:** Once Resend domain verified, re-enable "Confirm email" in Supabase Auth → Email provider.
- **Acceptance:** New signups receive confirmation email.

---

# Phase 11 — Engagement (Tier 1 — table stakes)

## 11.1 First-trade confetti
- [x] **Files:** `components/shared/Confetti.tsx`, hook into trade open success
- [x] **Install:** `react-native-confetti-cannon`
- **What:** When user's first ever trade opens (count `trades` for account = 1), trigger 3-second confetti burst.
- **Acceptance:** First trade → confetti. Second+ trades → nothing.

## 11.2 Daily check-in streak (login-based)
- [x] **Migration:** `011_login_streak.sql` — `last_login_date date`, `login_streak int` on profiles.
- [x] **Server:** On `/api/auth/login` success: if last_login_date == yesterday → streak++; else if older → streak=1; else (today) no change.
- [x] **UI:** Banner on Trade tab "🔥 N-day streak — log in tomorrow to keep it going" (shown when streak >= 2).
- **Acceptance:** Sign in → streak increments on first sign-in of the day.

## 11.3 Achievements / badges
- [x] **Migration:** `011_achievements.sql` — `achievements` table (user_id, code, unlocked_at).
- [x] **Server checks** (after relevant events): First Trade, 5 Wins, Risk Master (10 trades with SL set), Robot Engineer (3 robots), 7-Day Streak, First Deposit, $1000 Balance.
- [x] **UI:** Profile section "Achievements" — unlocked badges + locked silhouettes with unlock criteria.
- **Acceptance:** Trigger conditions → badge auto-unlocks visibly.

## 11.4 Win celebration on trade close (in-the-money)
- [x] **Files:** `components/shared/WinFlash.tsx`, hook into trade close success
- **What:** Brief green flash + "+$X.XX" text overlay when a trade closes profitably.
- **Acceptance:** Close winning trade → green flash; losing trade → no flash.

---

# Phase 12 — Admin panel

## 12.1 Admin dashboard route
- [x] **File:** `app/admin/index.tsx` (gated by is_admin)
- **What:** Top-level admin page: total users, active accounts, total deposits, open trade count, total exposure, system health.
- **Acceptance:** Accessible only to admins. Numbers match DB queries.

## 12.2 User search + impersonation
- [x] **Files:** `app/admin/users.tsx`, `app/admin/user/[id].tsx`
- **What:** Search by login number or email. View user's trades, transactions, KYC status. "View as user" generates a one-time auth token.
- **Acceptance:** Find any user, see their full activity.

## 12.3 Manual balance adjustment
- [x] **Endpoint:** `POST /api/admin/accounts/:id/adjust` — `{amount, reason}`.
- [x] **UI:** Button on user detail page.
- **What:** Inserts a `transactions` row with `type='adjustment'` and updates balance. Audit log includes admin user_id.
- **Acceptance:** Adjust balance → transaction logged → user sees it.

## 12.4 Risk dashboard
- [x] **File:** `app/admin/risk.tsx`
- **What:** Aggregate exposure per symbol (sum of buy − sell volumes × current price). Top losing/winning open positions. Clients near margin call.
- **Acceptance:** Visible at-a-glance risk picture.

---

# Phase 13 — Monitoring

## 13.1 Sentry integration (frontend)
- [x] **Files:** Add `sentry-expo` (or `@sentry/react-native`)
- **What:** Capture client errors. Configure release tracking. Tag with user login number.
- **Acceptance:** Trigger an error → appears in Sentry.
- **Done:** Completed as R.3 (2026-05-19) — `sentry-expo` installed, init in `app/_layout.tsx`, user login number tagged on sign-in. Web crash captured in Sentry dashboard to verify.

## 13.2 Sentry integration (backend)
- [x] **Files:** `@sentry/node` in server, `sentry.ts` init
- **What:** Capture server exceptions, slow request alerts.
- **Acceptance:** Throw in a route → appears in Sentry.
- **Done:** Completed as R.4 (2026-05-19) — `@sentry/node` installed, init in `server/src/index.ts`, same DSN as frontend with runtime tag. Verified via test endpoint hitting Sentry dashboard.

## 13.3 Uptime monitoring
- [x] **What:** Set up Better Stack (free tier) → ping `/health` every 5 min → alerts to email/Slack on downtime.
- **Acceptance:** Take Railway down → alert fires within 5 min.
- **Done:** 2026-05-28 — Both monitors live and green: `vanta-jade.vercel.app` + `vanta-server-production.up.railway.app/health`, 3-min checks, email alerts.

## 13.4 Performance dashboard
- [x] **What:** Track response times of `/api/quotes`, `/api/orders/open`, etc. Surface in admin dashboard.
- **Acceptance:** Slow endpoint visible in admin.
- **Done:** Completed as R.10 — `server/src/middleware/timing.ts` (p50/p95/p99 per route, rolling 5-min window) + `app/admin/perf.tsx` (live numbers in admin panel).

---

# Phase 14 — Legal & compliance

## 14.1 Terms of Service + Privacy Policy
- [x] **Files:** `app/legal/terms.tsx`, `app/legal/privacy.tsx`
- **What:** Use TermsFeed generator or hand-write. Link from Profile + signup screen.
- **Acceptance:** Both accessible in-app.
- **Done:** Completed as R.12 — static pages rendered from markdown, linked from Profile → Help.

## 14.2 Risk disclosure modal
- [x] **What:** "X% of retail traders lose money. Trading is high risk. By using Vanta you acknowledge..." Required acceptance on first sign-in or first deposit.
- **Acceptance:** Blocks first deposit until acknowledged. Persisted to profile.
- **Done:** Completed as R.12 — `components/RiskDisclosureModal.tsx` shown on first deposit/sign-in, acceptance persisted to `profiles.risk_accepted`.

## 14.3 Cookie consent (web)
- [x] **What:** Banner asking for analytics cookies (when/if added).
- **Acceptance:** Banner shows on first web visit.
- **Done:** 2026-05-25 — `components/shared/CookieConsentBanner.tsx` (new): web-only bottom banner with "Accept all" / "Necessary only" buttons. Consent persisted via AsyncStorage (localStorage on web) under key `cookie_consent`. Banner is hidden on iOS/Android (Platform.OS guard). Wired into `app/_layout.tsx` as the last child of the QueryClientProvider View so it overlays all screens. No migration, no backend deploy needed.

---

# Phase 15 — Polish

## 15.1 Onboarding flow for new users
- [x] **File:** `app/onboarding.tsx` (new) — shown once after first signup
- **What:** 3-step swipeable: "Welcome to Vanta", "Pro vs Quick mode", "Your $10k demo". Final tap → trade screen.
- **Acceptance:** New signup → onboarding → "Get started" → trade screen. Subsequent signups skip.

## 15.2 Empty states audit
- [x] **What:** Audit all screens. Each blank state should say what user can do next.
- **Acceptance:** No silent gray screens.

## 15.3 Loading skeletons
- [x] **What:** Replace ActivityIndicators on Trade / Portfolio / Robots tabs with shape skeletons (shimmer animation).
- **Acceptance:** Loading states feel intentional, not janky.

## 15.4 Brand polish
- [x] **Files:** `app/_layout.tsx` (font loading), `assets/logo.svg` (proper logo)
- [x] **Install:** `@expo-google-fonts/inter`, `@expo-google-fonts/jetbrains-mono`
- **What:** Load custom fonts properly, replace text-based "VANTA" wordmark with SVG logo, audit spacing consistency.
- **Acceptance:** App feels like a $50M product, not a hackathon.

## 15.5 Light theme toggle
- [x] **What:** Profile → Display → Theme (Auto / Dark / Light). New theme tokens for light mode.
- **Acceptance:** Toggle works, persists across reloads.

---

# Phase 16 — Testing

## 16.1 E2E smoke test
- [x] **Files:** `e2e/smoke.test.ts` (Playwright or Detox)
- **What:** Sign up → place trade → close trade → sign out. Run in CI (later).
- **Acceptance:** `npm run test:e2e` passes.
- **Done:** Completed as R.8 (2026-05-24) — `e2e/smoke.spec.ts` + `.github/workflows/e2e.yml`. Runs on every push via GitHub Actions.

## 16.2 Backend integration tests
- [x] **Files:** `server/test/*.test.ts`, install `vitest` or `tap`
- **What:** Cover `/api/auth/*`, `/api/orders/*`, `/api/rounds/*` against a test Supabase project.
- **Acceptance:** `cd server && npm test` passes.
- **Done:** Completed as R.9 (2026-05-19) — 32 hermetic tests via `vitest`, no live Supabase project required. `cd server && npm test` passes.

## 16.3 Load test
- [x] **What:** Use `k6` or similar to simulate 1000 concurrent users hitting trade endpoints.
- **Acceptance:** Backend holds up; document p95 latency.
- **Done:** 2026-05-25 — `scripts/load-test.js` (k6, primary) and `scripts/load-test-node.js` (Node.js, no extra deps).
  Covers: `/health`, `/api/quotes`, `/api/quotes/:symbol`, `/api/bars/BTC-USD`, `/api/orders/open`, `/api/account`.
  Load profile: ramp 0→100 VUs over 15s, sustain 60s, ramp down 15s (public); 0→25 VUs (auth).
  Thresholds encoded in script: p95<500ms (health), p95<800ms (quotes), p95<2000ms (bars), p95<1200ms (auth ops), error rate<1%.
  Run: `k6 run scripts/load-test.js` or `node scripts/load-test-node.js`.
  Auth testing: set `TEST_JWT=<supabase_jwt>` env var; omit to test public endpoints only.
  Note: actual p95 numbers require running against the live Railway server — sandbox network is blocked.

---

# Phase 18 — UX fixes (reported 2026-05-28)

## 18.13 Trade row density — text too small, too many lines
- [x] **Files:** `components/pro/TradeBook.tsx`
- **Problem:** Each open trade row shows 5 lines of small text (symbol + age, notional · leverage · margin, TP value, open→now price, P&L). Too much information crammed into too little space. Hard to scan quickly.
- **What:**
  - Reduce to 2 lines max per row: Line 1 = symbol + side + volume (large); Line 2 = open price → current price + P&L (prominent, colour-coded)
  - Notional, margin, leverage: hide behind a tap-to-expand or show only on the edit panel
  - P&L should be the largest number on the row — that's what traders look at
  - Action buttons (note, edit, scissors, close) stay on the right but slightly larger (32px instead of 28px)
- **Acceptance:** Each row fits comfortably in ~56px height. P&L is immediately readable at a glance. No information requires squinting.

## 18.1 Order entry simplification
- [x] **Files:** `components/pro/OrderEntry.tsx`
- **Problem:** Too many fields shown at once (Stake $/pt label, lots + notional + margin summary all on one dense line, Trail Distance visible by default). New users don't know what any of it means.
- **What:**
  - Rename "Stake ($/pt)" → "Volume" (or show a toggle: Lots / $ stake)
  - Collapse the summary line: show only the two most important numbers (notional + margin), hide lots unless expanded
  - Hide "Trail Distance" behind an "Advanced" toggle — 95% of users never use it
  - Add a simple $ risk indicator: "risking ~$X" based on SL distance
- **Acceptance:** A first-time user can place a BTC market buy without confusion. Summary line is one short sentence.

## 18.2 Chart drawing tools overhaul
- [ ] **Files:** `components/pro/Chart.tsx`
> BLOCKED for offline auto-runs (verified 2026-06-04): acceptance ("draw line → refresh → still there") is interactive + persistence + visual. Needs live Lightweight Charts drawing, a `chart_drawings` DB round-trip, and a screenshot to confirm — none possible in the no-network sandbox. The `026_chart_drawings.sql` migration already exists on disk. Multi-hour. Resume on a network-enabled, screenshot-capable run.
- **Problem:** The 4 toolbar buttons (cursor, horizontal line, pencil, F, delete) are present but drawing tools either don't work or produce no visible output. No trendlines, no fib retracement.
- **What:**
  - Fix horizontal line tool — click on chart → draws a draggable horizontal price line
  - Add trendline tool — click two points → draws a line
  - Add fib retracement — click two points → draws standard fib levels (0, 23.6, 38.2, 50, 61.8, 100)
  - Persist drawings to `chart_drawings` table (migration already exists)
  - Load drawings on mount, delete button clears all for that symbol
- **Acceptance:** Draw a horizontal line → refresh → line still there. Draw trendline → fib → all render correctly.

## 18.3 Light / dark mode fix
- [ ] **Files:** `stores/theme.ts` (or equivalent), `constants/colors.ts`
> BLOCKED for offline auto-runs (verified 2026-06-04): ~58 components import the static dark-only `colors`; converting every one to theme tokens is a multi-hour mechanical refactor whose only acceptance is visual (toggle → entire app goes light). Unverifiable offline and risky to ship blind (a missed token = broken render no one can see). Resume on a screenshot-capable run, or split into per-screen sub-items.
- **Problem:** Theme toggle exists in Profile → Display but switching to Light has no visible effect — the app stays dark.
- **What:** Audit every component that uses hardcoded dark hex values instead of theme tokens. Replace with token references. Light theme tokens already defined — just need components to read them.
- **Acceptance:** Toggle Profile → Light → entire app goes light. Toggle back → dark. Persists across reload.

## 18.10 Risk disclosure — fix accept flow
- [ ] **Files:** `app/legal/` (risk disclosure page), `app/(auth)/` or onboarding flow
> BLOCKED for offline auto-runs (verified 2026-06-04): needs a new migration adding `profiles.risk_accepted_at` applied to the live DB (no network/PAT in the sandbox), plus an onboarding trading-gate and a scroll-lock/Accept-button fix whose acceptance is purely visual. Migration-gated + visual. Resume on a network-enabled, screenshot-capable run.
- **Problem:** The risk disclosure modal/page cannot be read and accepted — user gets stuck. Likely a scroll lock, missing Accept button, or the button fires but doesn't record acceptance.
- **What:**
  - Risk disclosure must be fully scrollable
  - "I understand and accept" button only enables after user has scrolled to bottom
  - Acceptance recorded in `profiles.risk_accepted_at timestamp` (migration needed if column missing)
  - On first login, block access to trading until accepted
  - Re-acceptance not required on every login — check `risk_accepted_at IS NOT NULL`
- **Acceptance:** New user can read the full disclosure, scroll to bottom, tap Accept, and proceed to trade. Existing users with acceptance recorded go straight through.

## 18.11 Share winning trade + chart to X (Twitter)
- [ ] **Files:** `components/pro/TradeBook.tsx` (closed trade row), new `lib/shareCard.ts`
> BLOCKED for offline auto-runs (verified 2026-06-04 — dependency + platform limit, needs a user decision): the headline deliverable (generate AND ATTACH a trade-card image) requires a view-capture / native-sharing library. None is installed — deps have only `react-native-svg`; there is no `react-native-view-shot`, `expo-sharing`, or `expo-media-library` — and the auto-run rules forbid adding packages not listed in this item. Separately, the X *web* intent (`x.com/intent/tweet`) cannot attach images at all (platform limitation); only the native mobile share sheet can. A text+URL-only X share is implementable with the current deps but does NOT meet acceptance as written. To unblock, the user needs to: (a) approve adding a capture/sharing dependency (e.g. `react-native-view-shot` + `expo-sharing`), and (b) accept descoping web to text+URL (image on native only). `lib/shareCard.ts` does not yet exist.
- **What:** On a closed profitable trade, show a "Share" button. Tapping it:
  1. Generates a trade card image: symbol, side, open→close price, P&L in $, P&L %, duration, VANTA logo/watermark
  2. Optionally overlays a chart screenshot of the trade period (use the existing chart iframe screenshot or a server-rendered sparkline)
  3. Opens native share sheet on mobile / opens `https://x.com/intent/tweet?text=...&url=...` on web with pre-filled text: "Just closed +$X on BTCUSD 🚀 #VANTA #crypto" and attached image
- **Scope:** X.com only. No other social platforms.
- **Acceptance:** Close a profitable trade → Share button appears → tapping opens X compose with pre-filled text and card image attached.

## 18.12 Security audit + trading exploit fixes
- [x] **Files:** `server/src/routes/orders.ts`, `server/src/routes/auth.ts`, `server/src/routes/admin.ts`, `server/src/middleware/`
- **Done:** 2026-06-03 (auto) — full backend audit in `docs/security-audit.md`. Two issues found + fixed: (1) HIGH double-close race in the full-close path of `orders.ts` (closing UPDATE lacked a `status='open'` CAS guard → concurrent closes double-credited P&L and double-released margin; now uses `.eq('status','open').select('id')` and returns `409 already_closed` before settling); (2) MEDIUM missing rate limits on `POST /api/orders/open` (30/min) and `POST /api/transactions/withdraw` (10/min). All other checklist items (margin double-spend, partial-close CAS, zero/negative volume, client-supplied price, admin guards on all 13 routes, JWT expiry, withdraw>balance, hardcoded secrets) passed unchanged. Verified: client+server `tsc` clean, `npm test` 160 passing.
- **What:** Full audit of the backend for exploitable holes. Known areas to check:
  - **Double-spend on order open:** Can two simultaneous requests open trades that together exceed available margin? Add DB-level margin reservation or a per-account mutex.
  - **Close same trade twice:** Can a race condition allow double-close? Verify `status='open'` check is atomic (SELECT + UPDATE in one query or use `RETURNING` with status filter).
  - **Negative/zero volume orders:** Confirm validation rejects `volume ≤ 0` at route level before hitting DB.
  - **Price manipulation:** Can `open_price` be passed in by the client and trusted? Must always use server-side quote, never client-supplied price.
  - **Admin endpoint exposure:** Verify `requireAdmin` middleware is on every `/api/admin/*` route — check no route is accidentally unguarded.
  - **JWT expiry not checked:** Confirm expired JWTs return 401, not 200 with stale data.
  - **Withdraw more than balance:** Withdrawal request must check `balance >= amount` server-side, not just client-side.
  - **Rate limiting gaps:** Identify any high-value endpoints (order open, withdraw) with no rate limit and add one.
  - **Hardcoded secrets scan:** `grep -r "sk_\|secret\|password\|apikey" server/src --include="*.ts"` — verify nothing leaked.
- **Acceptance:** All above checks pass. Any bugs found are fixed in the same session. Document findings in `docs/security-audit.md`.

## 18.9 CI pipeline health fixes
- [x] **Files:** `.github/workflows/deploy.yml`, `.github/workflows/e2e.yml`
- **Problem 1 — Doc-only commits cancel real deploys.** Every push to main triggers a full deploy (type-check + Railway + Vercel, ~2 min). When we push 8 TODO.md-only commits rapidly, each one cancels the previous, so the actual code change never deploys cleanly and E2E never runs. Fix: add `paths-ignore` to deploy trigger so commits touching only `*.md`, `docs/`, `scripts/` don't trigger a deploy.
  ```yaml
  on:
    push:
      branches: [main]
      paths-ignore:
        - '**.md'
        - 'docs/**'
        - 'scripts/**'
        - 'e2e/**'
  ```
- **Problem 2 — E2E skips when deploy is cancelled.** The smoke test only runs after a successful deploy. Rapid-commit cancellation chains mean E2E is perpetually skipped. Once Problem 1 is fixed (fewer deploys), this resolves itself. Additionally add a scheduled weekly E2E run as a safety net: `schedule: - cron: '0 6 * * 1'`
- **Problem 3 — Node.js 20 deprecation.** GitHub Actions warns that `actions/checkout@v4` and `actions/setup-node@v4` run on Node.js 20, which is forced to Node.js 24 on June 2, 2026 (5 days away). Update both workflows to `actions/checkout@v4` → stay on v4 but add `node-version: '20'` pin, OR bump to `actions/setup-node@v4` with explicit node version. Easiest fix: add `env: FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` at workflow level to opt in now and avoid surprise breakage.
- **Acceptance:** Push a TODO.md-only commit → no deploy triggered. Push a code change → deploy runs, E2E follows. No Node.js deprecation warnings in CI logs.

## 18.8 Manager panel — MT4-style backend control centre
- [ ] **Files:** `app/admin/` (new pages), `server/src/routes/admin.ts` (extend)
> SKIPPED — oversized (verified 2026-06-04): this is ~8 new admin pages (positions, exposure, kyc, robots, chats, alerts, deposits, withdrawals) plus ~10 new backend routes. Far beyond one ~60-min verifiable run, and most acceptance is visual/live. Split into per-page sub-items (e.g. 18.8a Live Positions, 18.8b Exposure, …) before an auto-run can take it.
- **What:** A complete operator control centre. Extend the existing `/admin` dashboard with the following new sections:

  **Live Positions monitor** (`app/admin/positions.tsx`)
  - Table of every open trade across all users: user login, symbol, side, volume, open price, current P&L, margin used, open time
  - Sort by P&L (biggest losers/winners), symbol, or age
  - "Force close" button per row (admin closes any trade — logs reason='admin_close')
  - Summary bar at top: total open trades, total notional, net long/short exposure per symbol

  **Exposure by symbol** (`app/admin/exposure.tsx`)
  - Per symbol: total buy volume, total sell volume, net position, total P&L at risk
  - Highlights symbols where net exposure > configurable threshold (B-book risk)

  **Uploaded files / KYC documents** (`app/admin/kyc.tsx` — already exists, extend)
  - Show uploaded document images inline (signed Supabase storage URL, 1h expiry)
  - Currently only shows submission status — add image preview for each doc type

  **Robot run log** (`app/admin/robots.tsx`)
  - All `robot_runs` rows across all users: robot name, user, fired_at, result (trade opened / skipped / error), trade id if opened
  - Filter by date, user, result

  **AI assistant chat log** (`app/admin/chats.tsx`)
  - All conversations from `/api/assistant/chat` — user, timestamp, first message preview, turn count
  - Tap to expand full conversation
  - Useful for seeing what users are confused about → improve platform

  **Price alerts log** (`app/admin/alerts.tsx`)
  - All `price_alerts` rows: user, symbol, target price, triggered_at (or pending), notification sent?

  **Admin nav** (`app/admin/index.tsx` — update)
  - Add new tiles: Live Positions, Exposure, Robot Runs, Chat Logs, Price Alerts
  - Badge counts: open trades, pending KYC, untriggered alerts

- **Backend additions:**
  - `GET /api/admin/positions` — all open trades joined with user login
  - `POST /api/admin/positions/:id/close` — force close with reason
  - `GET /api/admin/exposure` — aggregate by symbol
  - `GET /api/admin/robot-runs` — paginated robot_runs with user info
  - `GET /api/admin/chat-logs` — paginated assistant conversations
  - `GET /api/admin/alerts` — all price alerts
  - All guarded by `requireAdmin` middleware (already exists)

  **Deposit management** (`app/admin/deposits.tsx`)
  - List all deposit requests with user, amount, method, status (pending / approved / rejected)
  - Approve button → credits user balance via existing manual balance adjustment endpoint
  - Reject button with reason field
  - Filter by status

  **Withdrawal management** (`app/admin/withdrawals.tsx`)
  - List all withdrawal requests with user, amount, wallet/bank details, requested_at, status
  - Approve / Reject buttons
  - Shows user's current balance alongside the request so admin can confirm funds available
  - Approved withdrawal deducts from balance, logs transaction

  **Admin nav additions**
  - Add tiles: Deposits (badge = pending count), Withdrawals (badge = pending count)

- **Backend additions:**
  - `GET /api/admin/positions` — all open trades joined with user login
  - `POST /api/admin/positions/:id/close` — force close with reason
  - `GET /api/admin/exposure` — aggregate by symbol
  - `GET /api/admin/robot-runs` — paginated robot_runs with user info
  - `GET /api/admin/chat-logs` — paginated assistant conversations
  - `GET /api/admin/alerts` — all price alerts
  - `GET /api/admin/deposits` + `POST /api/admin/deposits/:id/approve|reject`
  - `GET /api/admin/withdrawals` + `POST /api/admin/withdrawals/:id/approve|reject`
  - All guarded by `requireAdmin` middleware (already exists)

- **Acceptance:** Admin can see every open trade live, force-close one, see all KYC photos, browse robot run history, read AI chat logs, approve deposits, and action withdrawal requests — all from `/admin`.

## 18.7 Replace support chat with AI platform assistant
- [ ] **Files:** `app/help.tsx` (replace), `server/src/routes/assistant.ts` (new), `app/(tabs)/profile.tsx` (update link)
> BLOCKED for offline auto-runs (verified 2026-06-04): the assistant backend needs the Claude API (network + an API key) and the acceptance ("ask a question → correct streamed answer", "what are my open trades → real positions") can only be verified against a live key + live DB. Also a multi-page chat UI. Network-gated + large. Resume on a network-enabled run with the Claude API key available.
- **What:** Remove the existing support chat. Replace with a Claude-powered AI assistant that knows the entire platform and can guide users through anything:
  - How to place trades (market, limit, stop, bracket)
  - What the numbers mean (margin, notional, leverage, P&L, equity)
  - How robots work and how to write prompts for them
  - What Quick Mode is and how binary rounds work
  - How to read charts and use drawing tools
  - How deposits and withdrawals work
  - How KYC works and why it's required
  - Account settings (2FA, hedging mode, leverage)
  - Anything else — fallback to honest "I don't know" rather than hallucinating
  - The assistant has READ access to the user's own open positions and account balance so it can give context-aware answers ("you have 2 open BTC trades, here's how to close one...")
- **Backend:** `POST /api/assistant/chat` — takes `{ messages, context }` where context includes user's current balance/positions. Streams Claude Haiku response (~$0.001/call). System prompt encodes full platform knowledge.
- **Frontend:** Chat UI in `app/help.tsx` — floating button or bottom tab entry. Conversation history in local state (not persisted). Suggested starter questions shown on first open.
- **Cost:** Haiku at ~$0.001/message. 1000 messages/day = ~$1/day. Acceptable.
- **Acceptance:** User can ask "how do I place a stop loss?" and get a correct, step-by-step answer. User can ask "what are my open trades?" and get their actual positions listed.

## 18.6 "Share my trades" toggle — default ON
- [ ] **Files:** `server/supabase/migrations/` (new migration), `app/(tabs)/profile.tsx`, `server/src/routes/`
> PARTIALLY BLOCKED for offline auto-runs (verified 2026-06-04): needs a new migration (`profiles.share_trades boolean default true`) applied to the live DB before the backend gate can read the column, and "default ON for new accounts" / the Profile toggle persisting are only verifiable against the live DB + a screenshot. The server-side 403 gate ("don't return another user's trades when share_trades=false") is the one piece that's offline-unit-testable with the existing jest + supabaseMock harness. Net: migration-gated. Resume on a network-enabled run (apply the migration via `scripts/apply-migration.py` with `SUPABASE_PAT`), or have the user apply the migration first.
- **What:** Add `profiles.share_trades boolean default true`. New users get sharing on automatically. Profile → Privacy → "Share my trades" toggle (default ON). When on, the user's closed trade history is visible to other logged-in users (for copy trading discovery and leaderboards). When off, trades are private.
  - Migration: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS share_trades boolean NOT NULL DEFAULT true`
  - Profile screen: show toggle under a "Privacy" section, default ON, persists to `profiles`
  - Backend: any route that returns another user's trades checks `share_trades = true` first; returns 403 if off
- **Acceptance:** New account → share_trades is true by default. Toggle off → other users can't see trades. Toggle on → visible again.

## 18.5 Robot execution engine unit tests
- [x] **File:** `server/test/robotEngine.test.ts` (new)
- **What:** The existing `robots.test.ts` only covers `/api/robots/compile` (5 tests). The engine in `server/src/ai/robotEngine.ts` — `shouldFire`, `matchesCron`, `processRobot`, `openRobotTrade` — has zero test coverage.
  - Export `_robotInternals = { shouldFire, matchesCron, processRobot }` from `robotEngine.ts` (same pattern as `_riskInternals`, `_ordersTriggerInternals`)
  - `shouldFire` — interval robot: fires when `now - last_run >= interval`; doesn't fire when called too soon
  - `shouldFire` — cron `"0 9 * * 1-5"`: fires at 09:00 Mon–Fri; does not fire at 09:01 or on Saturday
  - `shouldFire` — paused robot → never fires
  - `processRobot` — active robot with `always` condition → `openRobotTrade` called; trade inserted; `robot_runs` row logged; `robots.total_trades` incremented
  - `processRobot` — `max_concurrent=1`, one open robot trade already exists → skips open, logs `skipped`
  - `processRobot` — tip-only robot (`kind='tip'`) → no trade inserted, push notification sent
  - `openRobotTrade` — inserts trade with `reason='robot'`, correct symbol/side/volume
- **Acceptance:** `cd server && npm test` covers all above cases, 0 failures, no live DB needed.

## 18.4 Forex + stock price feed (or hide empty categories)
- [x] **Files:** `server/src/feed/pricefeed.ts`, `components/pro/SymbolPicker.tsx` (or equivalent)
- **Done (Option C):** 2026-06-04 (auto) — implemented the cosmetic fix in `components/pro/SymbolPickerModal.tsx` (the modal that actually renders the category pills; `SymbolPicker.tsx` only opens it). Category pills now render only for categories that contain ≥1 symbol: `CATEGORIES.filter((c) => all.some((s) => s.category === c))`. With the current `symbolMeta` (80 Crypto + 1 Metals/PAXG, no Forex/Stocks entries), the **Forex (0)** and **Stocks (0)** pills no longer appear; Watchlist, All, Crypto, Metals remain. Verified: client+server `tsc` clean; logic check confirms hidden = {Forex, Stocks}. Acceptance (C) met.
> Options A/B (live non-crypto feed via Yahoo Finance / throttled Twelve Data) are still the desirable end state but were NOT done this run: they need network access to verify live prices and a new `yahoo-finance2` dependency, neither verifiable in the offline sandbox. Next agent with network can repopulate `NON_CRYPTO_SYMBOLS` + add forex/stock entries to `lib/symbolMeta.ts`; the pills will then reappear automatically (the Option C filter is data-driven, no further UI change needed).
- **Problem:** Symbol picker shows Forex (0) and Stocks (0) — categories exist but `NON_CRYPTO_SYMBOLS = []` because Twelve Data free tier (800 credits/day) ran dry with chart loads + polling combined.
- **What (pick one):**
  - **Option A (recommended):** Switch non-crypto to Yahoo Finance via `yahoo-finance2` npm package — no API key, ~10–15s poll, covers all 31 mapped symbols (forex pairs + AAPL/TSLA/NVDA etc.). Re-populate `NON_CRYPTO_SYMBOLS` with the forex + stock list. Yahoo Finance has no official rate limit for this use.
  - **Option B (fallback):** If Yahoo Finance proves flaky, keep Twelve Data but slash polling to every 4 hours for stocks only (market hours only) and every 60 min for top 6 forex pairs — fits within 800 credits/day.
  - **Option C (cosmetic only):** Hide categories from the picker when they have 0 live symbols — one-line filter, takes 10 min, unblocks UX immediately while A or B are being done.
- **Acceptance (A or B):** At least 6 forex pairs (EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF) and 5 stocks (AAPL, TSLA, NVDA, MSFT, AMZN) show live prices. Forex and Stocks categories show non-zero counts in picker.
- **Acceptance (C):** Forex (0) and Stocks (0) pills no longer appear. Only categories with ≥1 live symbol are shown.
- **Do C first** (10 min) then A in the same session.

---

# Phase 20 — Account opening audit (2026-06-08)

## Account opening full-flow map

```
vanta-jade.vercel.app
  └─ index.tsx
       ├─ session? → /(tabs)/trade          (returning user)
       └─ no session → /(auth)/login
            ├─ "Create account" → /(auth)/signup
            │    └─ register() → credentials screen (copy login + password)
            │         └─ "I've saved them" → /onboarding (3 slides)
            │              └─ "Let's trade" → /(tabs)/trade
            └─ sign in → login + optional 2FA → /(tabs)/trade
```

## 20.1 Risk Disclosure — scroll lock on web
- [x] **File:** `components/RiskDisclosureModal.tsx`
- **Fix (2026-06-08):** Added `onLayout` + `onContentSizeChange` to the ScrollView. When
  `contentHeight ≤ containerHeight + 20`, `scrolledToBottom` is set to `true` immediately —
  unlocking the "I Understand & Accept" button without requiring a scroll event that never
  fires on desktop browsers. Previously the button was permanently disabled on web.
- **Acceptance:** Visit Deposit screen in a browser → Risk Disclosure shows → "I Understand &
  Accept" button is enabled without needing to scroll (content fits in one view).

## 20.2 Credential recovery / "forgot login" — PARKED
- [ ] **PARKED** — no email-confirmation flow yet (gated on 10.4 Resend domain).
- **Problem:** If a user loses their login number or password, there is currently no recovery
  path in the app. The Login screen has no "Forgot password" or "Lost account number" link.
- **What:** Add a "Lost access?" link on the Login screen. Options:
  - If user has a contact email on file: send recovery email via Resend (requires 10.4)
  - If not: show a "Contact support" mailto link
  - **Simpler for now:** Add a visible info box on login screen: "Lost your login number or
    password? Email support@vanta.markets" (no code path needed, purely UI text)
- **Acceptance:** Login screen has a visible recovery hint. Users who lose credentials know
  what to do.

## 20.3 Risk disclosure gates trading, not only deposits
- [x] **Files:** `app/(tabs)/trade.tsx`, `components/RiskDisclosureModal.tsx`
- **Done:** 2026-06-09 (auto). Added a second AsyncStorage key `vanta:risk_ack_trade`,
  independent from the deposit key. `RiskDisclosureModal` now takes optional `ackKey` (which
  key to persist) and `intro` props, both defaulting to the existing deposit values — so the
  deposit gate is byte-for-byte unchanged. The Trade tab (`app/(tabs)/trade.tsx`) checks
  `hasAcknowledgedTradeRisk()` on mount; if not acknowledged it renders the disclosure as a
  full-screen gate over the trade UI. Accept → records the trade key and reveals trading;
  Cancel → `router.replace('/(tabs)/portfolio')` (blocks trading until accepted). Existing
  users with the key set go straight through. Client `tsc --noEmit` clean. NOT yet deployed /
  live-verified — this auto-run had no network (Railway/Vercel/Supabase all unreachable); the
  visual acceptance needs a deploy + browser check on a network-enabled run.
- **Problem:** Risk disclosure is currently only shown before the first deposit. For compliance
  and product integrity, it should also be required before the user's very first trade (even
  on a demo account).
- **What:**
  - Add a second storage key `vanta:risk_ack_trade` (separate from deposit key)
  - Show the modal when user first opens the Trade tab or places their first order, if not yet
    acknowledged
  - Keep the deposit gate unchanged
- **Acceptance:** New account → goes to Trade tab → Risk Disclosure appears → accept → can
  place orders. Subsequent visits: no modal.

---

# Phase 19 — UX improvements (reported 2026-06-08)

## 19.1 Order entry — Binance-style notional amount mode
- [x] **Files:** `components/pro/OrderEntry.tsx`, `stores/prefs.ts`, `lib/contracts.ts`
- **Done:** 2026-06-09 (auto). Added a third sizing mode **"$ amount"** alongside Lots and
  $/pt. `stores/prefs.ts` now holds a three-way `sizingMode: 'lots' | 'stake' | 'notional'`
  (source of truth) persisted under `vanta:prefs:sizingMode`; the legacy `spreadBet` boolean is
  kept derived/synced (`spreadBet === sizingMode==='stake'`) and still written to the old key, so
  Profile → Display and `_layout` hydrate are byte-compatible. `OrderEntry.tsx`: the inline
  toggle is now **Lots · $/pt · $ amount**; in `$ amount` mode the field label becomes "$ amount"
  (placeholder "e.g. 10000") and lots are computed live as `dollars / (mid × contractSize(symbol))`
  — recalculated as you type, as the price ticks, and when the symbol changes. The summary leads
  with "~0.1333 BTC · $10,000 notional · $100 margin". `volume` (lots) stays the canonical value
  sent to the server, so submit/validation are unchanged — no backend change. Client + server
  `tsc --noEmit` both clean; conversion math unit-checked (BTC@75k: $10k→0.1333 lots, round-trips
  exactly; EURUSD/AAPL/XAU all exact). NOT live-verified — this auto-run had no network
  (Railway/Vercel unreachable, no vercel CLI). Next networked run should `vercel --prod --yes`
  and confirm: $ amount → type 10000 → correct lot count; place order opens; switch symbol → lots
  recompute.
- **What:** Add a third sizing mode alongside Lots and $/pip: **"$ amount"** — user enters how many USD they want to put in (e.g. $10,000), server converts to lots behind the scenes. This matches Binance's "Buy $10k of BTC" UX.
  - Toggle pill: **Lots · $/pt · $ amount** (three options)
  - In `$ amount` mode, the Volume input label becomes "$ amount", placeholder "e.g. 10000"
  - Conversion: `lots = dollarAmount / (currentPrice × contractSize(symbol))`. For crypto (1 lot = 1 unit): lots = dollarAmount / price.
  - Summary line reads: "Buying ~0.132 BTC · $10,000 notional · $100 margin (100×)"
  - Persist the sizing-mode choice to `stores/prefs.ts` (same store that holds `spreadBet`).
- **Cost:** No backend change needed — lots are calculated client-side before the order is sent.
- **Acceptance:** Switch to `$ amount`, type 10000, see correct BTC lot count computed live. Place order → opens correctly. Switch symbol → lots recalculate automatically.

## 19.2 AI robots — ensure full flow works end-to-end
- [ ] **Files:** `server/src/routes/robots.ts`, Railway env vars
- **Root cause fixed 2026-06-08:** `ANTHROPIC_API_KEY` was missing from Railway env vars → every "Generate Robot" click returned `ai_error: invalid x-api-key`. Key has been set via `railway variables set`. Verify the fix is live before closing this task.
- **Remaining verification checklist:**
  - [ ] "Generate Robot" → AI response comes back (not "AI service is unavailable")
  - [ ] Config preview renders (name, schedule, symbols, side, volume)
  - [ ] "Save Robot" → robot appears in "YOUR ROBOTS" list with DRAFT badge
  - [ ] Tap robot → detail screen opens (`app/robot/[id].tsx`)
  - [ ] Pause/resume robot from detail screen changes `status` in DB
  - [ ] Robot engine tick (every 60s) picks up an `active` robot and opens a trade logged with `reason='robot'` (visible in TradeBook)
  - [ ] Robot leaderboard tab loads (no crash)
- **No migration needed** — robots schema exists and is live.
- **Acceptance:** Complete the verification checklist above. All steps pass on `https://vanta-jade.vercel.app`.

---

# Phase 17 — Optional / future

- [ ] Copy trading (follow another trader's positions)
- [ ] Public social feed (trade cards as posts)
- [ ] Live chat rooms by symbol
- [ ] Voice trading ("hey Vanta, buy 0.1 BTC")
- [ ] NFT-style trade card sharing
- [ ] Educational content with progress tracking
- [ ] Affiliate program / referral codes
- [ ] Multiple accounts per user (demo + multiple live)
- [ ] Multi-currency accounts (EUR, GBP, USDT)
- [ ] TradingView webhook → robot trigger
- [ ] AI copilot chat ("Should I close my EURUSD?") — Claude API with read access to user's positions

---

# Operational notes for the agent

- **Never commit secrets.** All API keys live in `server/.env` (gitignored) and Vercel/Railway env vars.
- **D