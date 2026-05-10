# STATE — handoff notes for the next agent

> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.

---

## 2026-05-10T(auto) — 4.1 Deposits screen

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **4.1 Deposits screen**

**What changed**
- `app/deposit.tsx` (new, 440 lines): three-tab deposit screen (Crypto / Bank Wire / Card).
  - Crypto tab: coin selector (BTC/ETH/USDT), network warning, demo deposit address with selectable text, amount input, "I've sent $X" submit button.
  - Wire tab: bank wire instructions table (Silvergate Bank demo details), amount input, submit button.
  - Card tab: "Coming soon" placeholder.
  - On submit: calls `api.createDeposit()` → POST `/api/transactions/deposit` → creates pending transaction → success screen → auto-navigates back after 2.2s.
- `server/src/routes/transactions.ts` (new, 56 lines): `POST /api/transactions/deposit` — authenticates user, validates accountId ownership, inserts pending `transactions` row with method + amount.
- `server/src/index.ts`: imports + registers `transactionsRoutes` at `/api/transactions`.
- `lib/api.ts`: added `api.createDeposit()` method.
- `app/(tabs)/portfolio.tsx`: added `useRouter` import + hook; `ActionPill` now accepts `onPress` prop (View → Pressable); Deposit button navigates to `/deposit`.
- `TODO.md`: item 4.1 marked `[x]`.

**Verification done in-sandbox**
- `npx tsc --noEmit` (root) → exit 0.
- `cd server && npx tsc --noEmit` → exit 0.

**Verification NOT done**
- Railway deploy: sandbox has no outbound network. Run `cd /c/Claude/vanta/server && railway up --detach`.
- Vercel deploy: `cd /c/Claude/vanta && vercel --prod --yes`.
- E2E: Portfolio → Deposit → Crypto tab → select ETH → enter amount → "I've sent $50" → pending transaction appears in DB.

**Recurring gotchas (still present)**
1. `.git/index.lock` + `.git/HEAD.lock` + `.git/refs/heads/main.lock` (0-byte WSL stale lockfiles, cannot unlink). Workaround: `GIT_INDEX_FILE=/sessions/*/git_vanta_idx git read-tree HEAD` rebuilds clean index; commit via commit-tree; write SHA to `.git/refs/heads/main`.
2. `unlink tmp_obj_*` warnings during `write-tree` are cosmetic.
3. Write/Edit tool truncates long files. Fix: bash heredoc + verify `wc -l`.

**Next agent:** pick **4.2 Withdrawals screen** (no hard deps — check KYC status from `kyc_submissions` table; block withdrawal if not approved). Or pick **6.1 Expo push token registration** to start unblocking Phase 6.

---

## 2026-05-10T(auto) — 3.6 Robot templates gallery

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **3.6 Robot templates / "Try this prompt" gallery**
**Commit:** `88608c2` — `auto: robot templates gallery (Phase 3.6)`

**What changed**
- `components/robots/RobotTemplates.tsx` (new, 292 lines): `Modal` (pageSheet) with 15 curated strategy prompts across 4 categories: Auto Trading, Tip & Alert, Event Driven, Advanced. Each card shows name, description, and italic prompt preview. Tap calls `onSelect(prompt)` + closes modal.
- `components/robots/RobotPromptBuilder.tsx`: added `suggestedPrompt?: string` prop + `useEffect` — when prop changes to a non-empty value, sets internal `prompt` state and resets to `idle` stage.
- `app/(tabs)/robots.tsx`: added `showTemplates` + `suggestedPrompt` state + `scrollRef`; "Browse robot templates" dashed button now opens the modal (styled with primary color border); `handleTemplateSelect` sets `suggestedPrompt`, switches to `my_robots` tab, and scrolls to top.
- `TODO.md`: item 3.6 marked `[x]`.

**Verification done in-sandbox**
- `npx tsc --noEmit` (root) → exit 0 (silent).
- `cd server && npx tsc --noEmit` → exit 0 (silent).

**Verification NOT done**
- Vercel deploy: sandbox has no outbound network. Run `cd /c/Claude/vanta && vercel --prod --yes`.
- E2E: Robots tab → "Browse robot templates" → modal opens → tap a template → modal closes → prompt builder filled with template text.

**Recurring gotchas (still present)**
1. `.git/index.lock` + `.git/HEAD.lock` + `.git/refs/heads/main.lock` (0-byte WSL stale lockfiles, cannot unlink). Workaround: use `GIT_INDEX_FILE=/sessions/exciting-admiring-thompson/git_vanta_idx` for all index ops; write commit SHA directly to `.git/refs/heads/main` (bypass `update-ref`).
2. `unlink tmp_obj_*` warnings during `write-tree` are cosmetic.
3. Write/Edit tool truncates long files mid-JSX. Fix: bash heredoc + verify `wc -l`.

**Next agent:** pick **3.4 Tip-only robots send push notifications** — depends on **6.2 `lib/push.ts`** (not yet built). Recommended path: implement **6.1 Expo push token registration** first (no deps), then **6.2 server push helper**, then **3.4**. Alternatively skip to **4.1 Deposits screen** (no deps, frontend only).

---

## 2026-05-09T(auto) — 3.5 Robot leaderboard

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **3.5 Robot leaderboard**
**Commit:** `f7fd776` — `auto: robot leaderboard (Phase 3.5)`

**What changed**
- `supabase/migrations/006_public_robots.sql` (new): adds `is_public boolean default false` to `robots`, partial index `robots_leaderboard_idx` on `(is_public, total_profit desc) WHERE is_public=true`, RLS policy "Anyone can view public robots".
- `server/src/routes/robots.ts`: added `GET /api/robots/leaderboard?period=7d|30d|all` (top 20 public robots by P&L, anonymized owners, period filters via `last_run_at` cutoff); added `PATCH /:id/visibility` (owner-only `is_public` toggle). Leaderboard route registered *before* `/:id` to avoid parametric collision.
- `lib/api.ts`: added `api.getRobotLeaderboard(period)` and `api.setRobotVisibility(id, flag)`; exported `LeaderboardEntry` interface.
- `components/robots/RobotLeaderboard.tsx` (new, 227 lines): period selector (7d/30d/all), ranked rows with gold/silver/bronze Trophy icons for top 3, P&L with TrendingUp/Down, win rate, pull-to-refresh.
- `app/(tabs)/robots.tsx`: added "My Robots / Leaderboard" pill tab switcher; leaderboard tab renders `<RobotLeaderboard />`.
- `TODO.md`: all three 3.5 sub-items marked `[x]`.

**Verification done in-sandbox**
- `npx tsc --noEmit` (root) → exit 0 (silent).
- `cd server && npx tsc --noEmit` → exit 0 (silent).

**Verification NOT done**
- Migration apply: sandbox has no outbound network. Run:
  `SUPABASE_PAT=<pat> python scripts/apply-migration.py supabase/migrations/006_public_robots.sql`
- Railway deploy: `cd server && railway up --detach`
- Vercel deploy: `cd /c/Claude/vanta && vercel --prod --yes`
- E2E: set `robots.is_public=true` via SQL or PATCH /api/robots/:id/visibility → robot appears in leaderboard tab ranked by P&L.

**Recurring gotchas (still present)**
1. `.git/index.lock` + `.git/HEAD.lock` (0-byte WSL stale lockfiles, cannot unlink). Workaround: `GIT_INDEX_FILE=/sessions/eager-adoring-shannon/git_vanta_idx git read-tree HEAD` rebuilds clean index; stage + commit via commit-tree; write SHA to `refs/heads/main`.
2. `unlink tmp_obj_*` warnings during write-tree are cosmetic — objects written correctly.
3. Write/Edit tool truncates long files. Fix: bash heredoc + verify `wc -l`.

**Next agent:** pick **3.4 Tip-only robots** (depends on 6.2 `lib/push.ts` — still not built) OR **3.6 Robot templates gallery** (`components/robots/RobotTemplates.tsx` new; no dependency) OR jump to **6.1 Expo push token registration** to unblock 3.4. Recommended: **3.6** (no deps, quick win) or **6.1** (unblocks 3.4).

---

## 2026-05-09T(auto) — 3.3 Robot execution engine (real, not stub)

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **3.3 Robot execution engine (real, not stub)**
**Commit:** `45baa18` — `auto: robot execution engine (real, not stub) (Phase 3.3)`

**What changed**
- `server/src/ai/robotEngine.ts` (full rewrite, 351 lines):
  - **interval**: fires when `(now - last_run_at) >= interval_ms`; uses in-memory `lastFiredMs` map so restarts reset cleanly.
  - **cron**: self-contained minimal cron parser (no external library). Supports `*`, `*/N`, `N-M`, `N,M,K` for all 5 UTC fields. No `cron-parser`/`croner` installed — the TODO allowed it but the inline ~40-line parser is sufficient and has zero deps.
  - **event**: `nyse_open` (14:30 UTC), `nyse_close` (21:00 UTC), `london_open` (08:00 UTC), `asia_open` (00:00 UTC), `daily_9am` (09:00 UTC). Each fires at most once per UTC calendar day per robot (tracked in `firedToday` map, pruned daily).
  - **conditions**: `always` implemented; unknown types pass through (no false negatives for future condition types).
  - **kind='trade'**: opens trade via internal OMS path — fetches quote, checks `max_concurrent` open robot trades, reserves margin, inserts trade with `reason='robot'`, SL/TP computed from `risk.stop_loss_pct` / `risk.take_profit_pct`.
  - **kind='tip'**: logs `tip_sent` action. Phase 3.4 will wire push notification.
  - Logs every tick outcome to `robot_runs` (including `conditions_not_met`, `trade_failed` for observability).
  - Updates `robots.last_run_at` + `robots.total_trades` on each fire.
  - Tick interval changed from 30s → 60s (matches cron minute granularity).
  - Concurrency guard: single in-flight tick; overlapping ticks skipped.
- `TODO.md`: item 3.3 checkboxes marked `[x]`.

**Verification done in-sandbox**
- `cd server && npx tsc --noEmit` → exit 0.
- Root `npx tsc --noEmit` → exit 0.

**Verification NOT done**
- Railway deploy: sandbox has no outbound network. Run `cd /c/Claude/vanta/server && railway up --detach` to ship.
- E2E: create robot with `interval=60000`, set status=active, wait 60s → trade appears in book with `reason='robot'`, `total_trades` increments.

**Recurring gotchas (still present)**
1. `.git/index.lock` (0-byte WSL stale lockfile, cannot `rm`). Workaround: `GIT_INDEX_FILE=/tmp/git_vanta_idx git read-tree HEAD` to rebuild fresh index; stage files with same env var; write commit SHA directly to `.git/refs/heads/main`.
2. `unlink tmp_obj_*` warnings during `write-tree` are cosmetic — git still writes objects correctly.
3. Edit/Write tool may truncate long files. Fix: bash heredoc + verify `wc -l`.

**Next agent:** pick **3.4 Tip-only robots send push notifications** — but this depends on Phase 6.2 `lib/push.ts` (Expo Push API helper) which is not yet built. Since 3.4 has a hard dependency on 6.2, consider skipping to **3.5 Robot leaderboard** instead: migration `006_public_robots.sql`, endpoint `GET /api/robots/leaderboard`, and leaderboard UI tab. Or implement 6.2 `lib/push.ts` first if preferred.

---

## 2026-05-08T(auto) — 2.5 Win / loss result modal

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **2.5 Win / loss result modal**
**Commit:** `137a505` — `auto: win/loss result modal (Phase 2.5)`

**What changed**
- `components/fun/RoundResultModal.tsx` (new, 262 lines):
  - Modal component receives `round: BinaryRound | null` + `onDismiss` callback.
  - Entrance: scale (0.7→1 spring) + fade-in (180ms) via `Animated.parallel`.
  - **Win**: `ConfettiCannon` fires 120 particles (branded palette) from center-top; green `CheckCircle` icon; shows `+$net` (payout − stake).
  - **Loss**: red `XCircle` icon; 7-step `Animated.sequence` shake on `translateX`.
  - **Tie**: green `CheckCircle`; `±$0.00`.
  - Auto-dismisses after 3 s; tapping the overlay also dismisses.
  - Uses `useWindowDimensions` for confetti origin so it centers correctly on any screen width.
- `components/fun/QuickTradeScreen.tsx` (modified):
  - Added `settledRound: BinaryRound | null` state.
  - Passes `onRoundSettled={setSettledRound}` to `<ActiveRounds>` (hook was already wired in Phase 2.4).
  - Renders `<RoundResultModal round={settledRound} onDismiss={() => setSettledRound(null)} />`.
- `package.json` / `package-lock.json`: `react-native-confetti-cannon@1.5.2` added.
- `TODO.md`: item 2.5 checkbox marked `[x]`.

**Verification done in-sandbox**
- `npx tsc --noEmit` (root) → exit 0 (silent). No type errors.

**Verification NOT done**
- Vercel deploy: sandbox has no outbound network. Run `cd /c/Claude/vanta && vercel --prod --yes` to ship.
- E2E: open round → wait for settle → modal pops with win/loss animation → auto-dismisses after 3 s.

**Recurring gotchas (still present)**
1. `.git/index.lock` + `.git/HEAD.lock` (0-byte WSL stale lockfiles). Workaround: `GIT_INDEX_FILE=/tmp/git_vanta_idx git read-tree HEAD` to rebuild index; write commit SHA to `.git/refs/heads/main`.
2. `Edit`/`Write` tool truncates long files. Fix: bash heredoc + verify `wc -l`.
3. `unlink tmp_obj_*` warnings during `write-tree` are cosmetic — git still writes objects correctly.

**Next agent:** pick **2.6 Streak tracking** — migration `005_streaks.sql`, server settler update, streak badge on `QuickTradeScreen` header. Has three sub-items (migration → server → client); pick the migration sub-item first.

---
