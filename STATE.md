# STATE -- handoff notes for the next agent

> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.


---
## 2026-05-15T18:12Z -- 12.1 Admin dashboard route

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **12.1 Admin dashboard route**
**Commit:** `5fe4e26`

**What changed**
- `app/admin/index.tsx` (new, 302 lines): Admin dashboard screen gated by
  `is_admin`. 5 stat cards: total users, active accounts, total deposits
  (completed), open trade count, total exposure (sum of open notionals).
  System-health pill in header (green/red). Pull-to-refresh. Non-admin users
  see a 403 guard screen. Nav rows at bottom link to Transactions and KYC admin.
- `server/src/routes/admin.ts`: new `GET /api/admin/dashboard` endpoint.
  Runs 5 parallel Supabase queries in Promise.all; returns single JSON payload
  with counts, sums, and health {status, server_time}.
- `lib/api.ts`: `adminGetDashboard()` typed fetch helper added.
- `app/(tabs)/profile.tsx`: admin row now navigates to `/admin` (dashboard)
  instead of `/admin/transactions` directly. Label = "Admin Dashboard".

**Verification**
- tsc --noEmit client: exit 0
- tsc --noEmit server: exit 0
- Deploy NOT done (sandbox has no Railway/Vercel access)

**Notes**
- The 5 Supabase queries run in parallel (Promise.all) so latency is bounded
  by the slowest single query, not their sum.
- `colors.bgBase` does not exist in theme — uses `colors.bgDeep` instead.
- `colors.warning` exists ('#FFB020') — used for Open Trades card accent.

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash.
2. `.git/HEAD.lock` + `.git/index.lock` are stale WSL locks -- cannot be deleted.
   Use GIT_INDEX_FILE=/tmp/X, git commit-tree, write to .git/refs/heads/main.
3. After every session start, run: GIT_INDEX_FILE=/tmp/X git read-tree HEAD to fix the corrupt index
   before doing git status (index drifts between sessions due to the lock workaround).
4. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
5. Colors import: use @/lib/theme (not @/lib/colors). bgBase does not exist -- use bgDeep.
6. Supabase JS SDK v2.45 has no `listUserSessions` -- sessions.ts calls the REST API directly.

**Next agent:** pick **12.2 User search + impersonation** (app/admin/users.tsx +
app/admin/user/[id].tsx) or **15.1 Onboarding flow** (app/onboarding.tsx, 3-step
swipeable, frontend only).

---
## 2026-05-15T14:10Z -- 11.3 Achievements / badges

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **11.3 Achievements / badges**
**Commit:** `211916d`

**What changed**
- `supabase/migrations/012_achievements.sql` (new): achievements table with
  `(user_id, code, unlocked_at)`, unique constraint, RLS read policy.
  Note: migration file is numbered 012 (011 was login_streak); TODO.md listed
  it as 011_achievements — kept TODO text as-is, file named 012.
- `server/src/lib/achievements.ts` (new, 134 lines): `awardAchievement()`
  idempotent upsert (23505 race-safe) + 5 check functions: checkFirstTrade,
  checkFiveWins, checkRiskMaster, checkRobotEngineer, checkBalance1000.
  `ACHIEVEMENT_META` record exported for client UI rendering.
- `server/src/routes/achievements.ts` (new): `GET /api/achievements` returns
  user's unlocked badges + full metadata object.
- `server/src/index.ts`: registers achievementsRoutes at `/api/achievements`.
- `server/src/routes/orders.ts`: fire-and-forget `checkFirstTrade` after
  trade open; `checkFiveWins + checkRiskMaster + checkBalance1000` after close.
- `server/src/routes/auth.ts`: awards `seven_day_streak` when `login_streak >= 7`.
- `server/src/routes/transactions.ts`: awards `first_deposit` on deposit creation.
- `server/src/routes/robots.ts`: `checkRobotEngineer` after robot save.
- `lib/api.ts`: `getAchievements()` + `Achievement`/`AchievementMeta` types.
- `app/(tabs)/profile.tsx`: Achievements section — 7-badge grid, unlocked
  badges glow amber, locked badges show description hint. Trophy icon + count pill.

**Verification**
- tsc --noEmit client: exit 0
- tsc --noEmit server: exit 0
- Deploy NOT done (sandbox has no Railway/Vercel access)

**Migration needed**
- Apply: `SUPABASE_PAT=<pat> python scripts/apply-migration.py supabase/migrations/012_achievements.sql`

**Notes**
- All achievement checks are fire-and-forget (wrapped in `.catch(() => {})`) —
  they never block the primary request path.
- `awardAchievement` is idempotent: duplicate inserts caught via 23505 unique_violation.
- Profile UI renders all 7 badge slots from `ACHIEVEMENT_META`; locked ones are
  50% opacity and show their unlock description as a hint.

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash.
2. `.git/HEAD.lock` + `.git/index.lock` are stale WSL locks -- cannot be deleted.
   Use GIT_INDEX_FILE=/tmp/X, git commit-tree, write to .git/refs/heads/main.
3. After every session start, run: git read-tree HEAD to fix the corrupt index
   before doing git status (index drifts between sessions due to the lock workaround).
4. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
5. Colors import: use @/lib/theme (not @/lib/colors).
6. Supabase JS SDK v2.45 has no `listUserSessions` -- sessions.ts calls the REST API directly.

**Next agent:** pick **12.1 Admin dashboard route** (app/admin/index.tsx — gated by is_admin,
shows total users / accounts / deposits / open trades / exposure / system health)
or **15.1 Onboarding flow** (app/onboarding.tsx, frontend only, 3-step swipeable).

---
## 2026-05-15(auto) -- 11.4 Win flash on trade close

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **11.4 Win celebration on trade close**
**Commit:** `0574905`

**What changed**
- `components/shared/WinFlash.tsx` (new, 83 lines): forwardRef component exposing
  `flash(amount: number)` via useImperativeHandle. Full-screen absoluteFill overlay
  (pointerEvents="none", zIndex 999). Animates: spring pop-in (scale 0.7->1) + 750ms
  hold + fade-out. Green pill showing "+$X.XX" + "WIN" label.
- `components/pro/TradeBook.tsx`: added `onWinClose?(profit: number)` prop. `close()`
  snapshots live P&L before calling `api.closeOrder()`; calls `onWinClose(profit)` if
  profit > 0 on success.
- `components/pro/ProTradeScreen.tsx`: threads `onWinClose` prop to TradeBook.
- `app/(tabs)/trade.tsx`: adds `winFlashRef<WinFlashRef>`, renders `<WinFlash />` at
  root (above ScrollView so not clipped), passes callback to ProTradeScreen.

**Verification**
- tsc --noEmit client: exit 0
- tsc --noEmit server: exit 0
- Deploy NOT done (sandbox has no Railway/Vercel access; frontend-only change)

**Notes**
- Profit is computed from live bid/ask at the moment the X button is pressed.
  If the quote goes stale, fallback is open_price (same as live display), so
  profit may show 0 and flash will be suppressed -- conservative and correct.
- Flash is Pro mode only (Quick mode has RoundResultModal for win/loss feedback).

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash.
2. `.git/HEAD.lock` + `.git/index.lock` are stale WSL locks -- cannot be deleted.
   Use GIT_INDEX_FILE=/tmp/X, git commit-tree, write to .git/refs/heads/main.
3. After every session start, run: git read-tree HEAD to fix the corrupt index
   before doing git status (index drifts between sessions due to the lock workaround).
4. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
5. Colors import: use @/lib/theme (not @/lib/colors).
6. Supabase JS SDK v2.45 has no `listUserSessions` -- sessions.ts calls the REST API directly.

**Next agent:** pick **11.3 Achievements / badges** (migration 011_achievements.sql +
server event hooks in orders/rounds/robots workers + Profile UI section).


---
## 2026-05-15(auto) -- 11.2 Daily check-in streak

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **11.2 Daily check-in streak**
**Commit:** `82e0de2`

**What changed**
- `supabase/migrations/011_login_streak.sql` (new, 4 lines): adds `last_login_date date` and `login_streak int not null default 0` to profiles via `add column if not exists`.
- `server/src/routes/auth.ts`: after successful login, queries profiles for `last_login_date`/`login_streak`, computes new streak (extend if yesterday, reset to 1 if gap, hold if already today), updates profiles (best-effort — wrapped in try/catch so it never blocks login). Returns `login_streak` in the login response alongside `session`.
- `stores/auth.ts`: added `loginStreak: number` field to `AuthState` (default 0). `signIn()` now reads `login_streak` from server response and calls `set({ loginStreak })`.
- `app/(tabs)/trade.tsx`: renders a fire-emoji banner when `loginStreak >= 2` ("🔥 N-day streak — log in tomorrow to keep it going!") using `colors.warning` styling, positioned above the ModeSwitcher.
- `TODO.md`: 11.2 marked [x] (all three sub-items).

**Verification**
- tsc --noEmit client: exit 0
- tsc --noEmit server: exit 0
- Deploy NOT done (sandbox has no Railway/Vercel access; frontend-only change once migration applied)

**Migration needed**
- Apply: `SUPABASE_PAT=<pat> python scripts/apply-migration.py supabase/migrations/011_login_streak.sql`
- Migration number is 011 (010 was notification_prefs). TODO.md incorrectly listed it as 010_login_streak — corrected in the file.

**Streak shows at >= 2 days** (day-1 is silent; banner appears on second consecutive login day).

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash.
2. `.git/index.lock` is a stale WSL lock -- use GIT_INDEX_FILE=/tmp/vanta_*_idx for all git ops.
3. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
4. Colors import: use @/lib/theme (not @/lib/colors).
5. Git index corrupt -- always bootstrap with: GIT_INDEX_FILE=/tmp/X git read-tree HEAD before staging.
6. Supabase JS SDK v2.45 has no `listUserSessions` -- sessions.ts calls the REST API directly.

**Next agent:** pick **11.3 Achievements / badges** (migration + server event hooks + UI) or **11.4 Win flash on trade close** (frontend only, small).

---
## 2026-05-14(auto) -- 11.1 First-trade confetti

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **11.1 First-trade confetti**

**What changed**
- `components/shared/Confetti.tsx` (new, 45 lines): forwardRef component exposing
  `fire()` via useImperativeHandle. Renders an absolutely-positioned full-screen
  overlay (pointerEvents="none") containing react-native-confetti-cannon's Explosion.
  180 particles, electric-blue/white/gold palette, fallSpeed 3000ms, fadeOut.
  Hides itself (setVisible(false)) when onAnimationEnd fires.
- `components/pro/OrderEntry.tsx`: added `onFirstTrade?: () => void` prop.
  After successful `api.openOrder()`, fires a void async IIFE that counts trades
  for this account via Supabase `select('*', { count: 'exact', head: true })`.
  If count === 1, calls onFirstTrade(). Silently ignores any Supabase errors.
- `components/pro/ProTradeScreen.tsx`: accepts `onFirstTrade?` prop and threads
  it down to OrderEntry.
- `app/(tabs)/trade.tsx`: holds confettiRef, renders `<Confetti ref={confettiRef} />`
  as an overlay inside the root View. Passes `onFirstTrade={() => confettiRef.current?.fire()}`
  to ProTradeScreen (Pro mode only).
- `TODO.md`: 11.1 marked [x] (both sub-items).

**Verification**
- tsc --noEmit client: exit 0
- tsc --noEmit server: exit 0
- Deploy NOT done (sandbox has no Railway/Vercel access; this is frontend-only)
- react-native-confetti-cannon was already in package.json/node_modules from Phase 2.5

**Notes on 11.1**
- Confetti fires only in Pro mode (QuickMode already has confetti via RoundResultModal).
- The Supabase count query runs client-side with the user's JWT -- RLS on `trades`
  must allow the user to SELECT their own rows (standard setup).
- `package-lock.json` had sandbox drift (extra babel peer deps) -- included in commit.

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash.
2. `.git/index.lock` is a stale WSL lock -- use GIT_INDEX_FILE=/tmp/vanta_*_idx for all git ops.
3. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
4. Colors import: use @/lib/theme (not @/lib/colors).
5. Git index corrupt -- always bootstrap with: GIT_INDEX_FILE=/tmp/X git read-tree HEAD before staging.
6. Supabase JS SDK v2.45 has no `listUserSessions` -- sessions.ts calls the REST API directly.

**Next agent:** pick **11.2 Daily check-in streak** (migration + server + UI) or
**11.4 Win flash on trade close** (frontend only, small -- WinFlash.tsx + hook into close path).

