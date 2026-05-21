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

## Status snapshot — 2026-05-20

- **Phase R:** 8/12 done. Remaining 4 are all externally gated:
  - R.1 GH Actions auto-deploy — needs `RAILWAY_TOKEN` + `VERCEL_TOKEN` in GitHub repo secrets (user action).
  - R.7 Better-Stack uptime — needs user signup at betterstack.com.
  - R.8 E2E smoke test — Playwright + CI; best done after R.1 lands.
  - R.11 DB backup verification — needs GH Actions cron (depends on R.1).
- **Phase T:** 3/20 done — T.1 limit, T.2 stop, T.13 pending dashboard (side effect of T.1).

## Next pick for the cowork agent

**READ `STATE.md` FIRST.** The most recent entry flags a Railway outage that must be cleared before any code ship. If `/health` is still 404, do not start a task — leave a note and exit.

Once backend is green, pick in this order:

1. **T.11 Position notional + leverage display** — pure frontend, no migration, no backend deploy needed. Highest UX/effort ratio. Safe pick even if Railway is flaky.
2. **T.5 Modify open positions (SL/TP after open)** — server PATCH endpoint + edit button. No migration. Requires backend deploy to be live.
3. **T.3 Stop-limit orders** — needs new migration adding `trades.limit_price numeric(18,5)`. Then remove the 501 guard in `orders.ts` for `stop_limit`, extend `shouldFill()` (two-stage: trigger trips → limit fills when price crosses limit). Number the migration **018** (016 + 017 are taken).

If picking T.3: apply the migration in **its own transaction**. The same enum-cannot-be-used-in-same-tx trap doesn't apply to a simple column add, so 018 can be a single file.

## Migrations already applied to live DB

- `013_margin_rpc.sql` ✅
- `014_write_policies.sql` ✅
- `015_order_idempotency.sql` ✅
- `016_pending_orders.sql` ✅ (split — see below)
- `017_pending_orders_index.sql` ✅ (the partial index — had to be a separate tx because Postgres rejects referencing a newly-added enum value in the same tx that added it)

**Next migration number: 018.** Do not re-apply 013–017.

---

# Phase R — Robustness & stability

The agent's deploy gap (commits land but Railway/Vercel aren't shipped without me/user), the chronic git lock issue, and silent runtime errors are the biggest sources of friction. Fix those before adding surface area.

## R.1 GitHub Actions auto-deploy (eliminate the deploy gap)
- [ ] **Files:** `.github/workflows/deploy.yml` (new), README setup notes
- **What:** Push to `main` → GitHub Action builds + deploys both backend (Railway via `railway up` with `RAILWAY_TOKEN` secret) and frontend (Vercel via `vercel deploy --prod` with `VERCEL_TOKEN`). Removes the 12+ hour gap between agent commits and live code.
- **Gated on:** user creating a GitHub repo + PAT, plus tokens added as repo secrets. If user hasn't provided these, leave a note in STATE.md and skip — don't try to set up GitHub from inside the agent.
- **Acceptance:** Push a commit, Actions tab shows build succeeds, vanta-jade.vercel.app serves new code within 5 min.

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
- [ ] **Files:** `e2e/smoke.spec.ts` (Playwright), `.github/workflows/e2e.yml`
- **What:** Sign up → place a 0.01 BTC trade → close it → sign out. Runs on every push.
- **Acceptance:** PR opens, CI runs the test green, fails if any step breaks.

## R.9 Backend integration test suite
- [x] **Files:** `server/test/*.test.ts`, install `vitest` — 2026-05-19 / `2d508b9` — 32 tests passing (hermetic, no Supabase project required).
- **What:** Cover `/api/auth/*`, `/api/orders/*`, `/api/rounds/*`, `/api/robots/*` against a test Supabase project (or hermetic mock).
- **Acceptance:** `cd server && npm test` passes; CI runs it.

## R.10 Performance dashboard in admin
- [x] **Files:** `server/src/middleware/timing.ts`, `app/admin/perf.tsx`
- **What:** Middleware that records p50/p95/p99 per route over rolling 5-min window. Admin page reads it.
- **Acceptance:** Visit `/admin/perf` → see real numbers updating live.

## R.11 Database backup verification
- [ ] **File:** `scripts/verify-backup.py`
- **What:** Daily cron via GitHub Actions: query Supabase Management API for latest backup timestamp, alert if >30h old.
- **Acceptance:** Cron runs, alerts when delayed.

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
- [ ] **Files:** `components/pro/OrderEntry.tsx` (already has SL/TP inputs — wire them in), server inserts all three legs atomically.
- **Acceptance:** Place a market buy with SL and TP filled → 1 entry trade row, both SL and TP active on the risk worker. Closing the entry cancels both legs.

## T.8 OCO orders (one-cancels-other)
- [ ] **Files:** Migration: `trades.oco_group_id uuid`. Risk worker: when one leg of an OCO group fills/stops, cancel the others.
- **What:** Place two pending orders linked; when one triggers, the other auto-cancels. Useful for "buy at breakout OR buy at pullback" setups.
- **Acceptance:** Place BTC buy-stop at $78k + BTC buy-limit at $74k as an OCO → one triggers → other vanishes from Pending list.

## T.9 Hedging mode (allow opposing positions on same symbol)
- [ ] **Account setting:** `accounts.hedging_enabled boolean` (default false). UI toggle in Profile.
- **What:** Default is netting — a buy on top of an existing sell reduces or flips the position. Hedging lets both exist simultaneously (MT4 default behavior).
- **Acceptance:** With hedging on: open 0.1 BTC buy + 0.1 BTC sell → both rows in Open Positions, P&L offsets in real time.

## T.10 Multiple accounts per user (demo + live tabs)
- [ ] **Migration:** `accounts.is_primary boolean`. The user already has the schema for multiple accounts — just need UI to switch.
- **Files:** Account header strip becomes a dropdown / segmented control.
- **What:** Users can switch between accounts (e.g., demo and live) without signing out. New "Open additional account" button in Profile.
- **Acceptance:** Click switcher → second account loads → balance, trades, robots all swap to the new account's data.

## T.11 Position notional + leverage display
- [x] **Files:** `components/pro/OrderEntry.tsx`, position rows in TradeBook.
- **What:** Show notional value and effective leverage as user types volume. "0.1 BTC × $76,000 = $7,600 notional · 95× leverage on $80 margin used".
- **Acceptance:** Numbers update live as user types.

## T.12 Symbol watchlist / favorites
- [ ] **Files:** `app/(tabs)/trade/watchlist.tsx`, migration: `user_watchlist (user_id, symbol)` table.
- **What:** Star a symbol → appears in your watchlist tab. Cross-device sync via Supabase.
- **Acceptance:** Star BTCUSD → switch tabs → see it in your saved list with live price.

## T.13 Pending orders dashboard
- [x] **Files:** `components/pro/TradeBook.tsx` — Pending tab between Open and Closed (shipped as side effect of T.1).
- **What:** Shows all `status='pending'` orders for the account with trigger price, side+type label, distance from current price, cancel button (calls `DELETE /api/orders/pending/:id`).
- **Done:** 2026-05-19 — same commit as T.1.

## T.14 Trade journal / annotations
- [ ] **Migration:** `trades.notes text`
- **Files:** Tap any trade in TradeBook → drawer with notes textarea + screenshot upload (Supabase Storage).
- **What:** User can attach a reason + chart screenshot to any trade for review later.
- **Acceptance:** Open trade → add note "RSI oversold reversal" → close → reopen TradeBook → note still attached.

## T.15 Technical indicators on chart
- [ ] **Files:** `components/pro/Chart.tsx` extension (TradingView Lightweight Charts already supports overlays)
- **What:** Toggle for RSI, MACD, MA(20), MA(50), Bollinger Bands. Settings persist per user (`profiles.chart_prefs jsonb`).
- **Acceptance:** Toggle RSI → indicator pane appears below price. Reload page → still on.

## T.16 Drawing tools on chart
- [ ] **What:** Trendline, horizontal line, fib retracement. Lightweight Charts has a drawings API. Persist via `chart_drawings` table per (user, symbol).
- **Acceptance:** Draw trendline on BTC chart → switch symbol → come back → line still there.

## T.17 Bigger symbol catalog — real-time crypto on Coinbase
- [ ] **Files:** `server/src/feed/pricefeed.ts` — add 30+ more pairs Coinbase has but we don't carry yet.
- **What:** Currently 47 cryptos via Coinbase. Add the next 30+ (ETH-EUR, BTC-EUR, IMX, GRT, FET, TAO, ONDO, KAS, etc.). Cap at ~80 to keep WS subscription size reasonable.
- **Acceptance:** Picker shows 80+ symbols. All have live prices.

## T.18 Copy trading (basic)
- [ ] **Migration:** `copy_relationships (follower_id, leader_id, allocation_pct, started_at)`.
- **What:** Robots tab → "Top Traders" leaderboard (ranked by 30-day P&L from public-opted-in users). Tap → "Copy" → for every trade the leader opens, mirror it at allocation_pct of your balance.
- **Acceptance:** Two test accounts. A opts in as leader, opens BTC buy. B follows A → B sees a copied BTC buy auto-appear in their Open Positions.

## T.19 Spread-betting / micro-lot mode
- [ ] **What:** Account preference for "$ per pip" style sizing instead of lots. Cosmetic — converts under the hood — but matches the UK retail trader mental model.
- **Acceptance:** Toggle preference → order entry shows "$10/pip" instead of "0.1 lots", math works out.

## T.20 Quick Mode — more durations + asset categories
- [ ] **Files:** `components/fun/QuickTradeScreen.tsx`
- **What:** Add 5s, 30s, 30min, 4h, 24h durations (already have 60s/5min/15min). Add category filter (Crypto / Forex / Stocks tabs) the way Pro mode has.
- **Acceptance:** Quick mode has 7 duration options and category tabs.

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
- [ ] **Files:** Add `sentry-expo` (or `@sentry/react-native`)
- **What:** Capture client errors. Configure release tracking. Tag with user login number.
- **Acceptance:** Trigger an error → appears in Sentry.

## 13.2 Sentry integration (backend)
- [ ] **Files:** `@sentry/node` in server, `sentry.ts` init
- **What:** Capture server exceptions, slow request alerts.
- **Acceptance:** Throw in a route → appears in Sentry.

## 13.3 Uptime monitoring
- [ ] **What:** Set up Better Stack (free tier) → ping `/health` every 5 min → alerts to email/Slack on downtime.
- **Acceptance:** Take Railway down → alert fires within 5 min.

## 13.4 Performance dashboard
- [ ] **What:** Track response times of `/api/quotes`, `/api/orders/open`, etc. Surface in admin dashboard.
- **Acceptance:** Slow endpoint visible in admin.

---

# Phase 14 — Legal & compliance

## 14.1 Terms of Service + Privacy Policy
- [ ] **Files:** `app/legal/terms.tsx`, `app/legal/privacy.tsx`
- **What:** Use TermsFeed generator or hand-write. Link from Profile + signup screen.
- **Acceptance:** Both accessible in-app.

## 14.2 Risk disclosure modal
- [ ] **What:** "X% of retail traders lose money. Trading is high risk. By using Vanta you acknowledge..." Required acceptance on first sign-in or first deposit.
- **Acceptance:** Blocks first deposit until acknowledged. Persisted to profile.

## 14.3 Cookie consent (web)
- [ ] **What:** Banner asking for analytics cookies (when/if added).
- **Acceptance:** Banner shows on first web visit.

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
- [ ] **Files:** `e2e/smoke.test.ts` (Playwright or Detox)
- **What:** Sign up → place trade → close trade → sign out. Run in CI (later).
- **Acceptance:** `npm run test:e2e` passes.

## 16.2 Backend integration tests
- [ ] **Files:** `server/test/*.test.ts`, install `vitest` or `tap`
- **What:** Cover `/api/auth/*`, `/api/orders/*`, `/api/rounds/*` against a test Supabase project.
- **Acceptance:** `cd server && npm test` passes.

## 16.3 Load test
- [ ] **What:** Use `k6` or similar to simulate 1000 concurrent users hitting trade endpoints.
- **Acceptance:** Backend holds up; document p95 latency.

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
- **Database migrations are append-only.** Don't edit existing migration files; create new ones.
- **Both deploys are atomic.** Vercel old version stays live until new build passes; same for Railway. Safe to deploy frequently.
- **If a TypeScript error blocks deploy:** check Railway build logs (`railway logs --build`), fix, redeploy. Don't comment out the type — fix it.
- **CORS must be updated when domain changes** in `server/src/index.ts` `ALLOWED_ORIGINS`.
- **Supabase RLS protects everything.** Server uses service role key (bypasses RLS) for admin operations. Client uses publishable key + user JWT.
- **Push to production immediately after each task** — frequent atomic deploys are cheaper than batched ones.
- **When in doubt, leave a note in `STATE.md`** for the next agent.
- **If a task changes data shapes:** write the migration first, deploy backend, then frontend.
- **Workspace state may have hot-reload caches** — restart Expo if web behaves weirdly.
- **Twelve Data free tier is 800 credits/day, 8/min** — keep `pollYahoo` removed and respect rate limits in any new endpoint that hits it.
- **Coinbase, Resend, Anthropic, Twelve Data, Supabase keys are all in `server/.env` and Railway env vars.**

---

*Maintain ordering within phases (dependencies flow downward). Strike `[x]` completed items in place — don't delete (history is useful).*
