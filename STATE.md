# STATE -- handoff notes for the next agent

> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.

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

---
## 2026-05-13T17:59(auto) -- 7.3 2FA (TOTP)

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **7.3 2FA (TOTP)**

**What changed**
- `lib/2fa.ts` (new): enroll2FA, verifyEnrollment, unenroll2FA, listVerifiedFactors, getAAL, challengeAndVerify
- `app/2fa-setup.tsx` (new): enrollment QR flow (SvgXml), secret copy, disable flow
- `app/(auth)/login.tsx`: after password auth, checks AAL; if aal2 needed shows TOTP step with challengeAndVerify
- `app/(tabs)/profile.tsx`: new 'Two-Factor Authentication' row -> /2fa-setup; shows green icon if enabled
- `TODO.md`: 7.3 marked [x]

**Verification**
- tsc --noEmit client: exit 0
- tsc --noEmit server: exit 0
- Deploy NOT done (sandbox has no Railway/Vercel access)

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash.
2. `.git/index.lock` is a stale WSL lock -- use GIT_INDEX_FILE=/tmp/vanta_*_idx for all git ops.
3. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
4. Colors import: use @/lib/theme (not @/lib/colors).
5. Git index corrupt -- always bootstrap with: GIT_INDEX_FILE=/tmp/X git read-tree HEAD before staging.

**Next agent:** pick **7.4 Active sessions/device list**, **8.2 Symbol categories** (frontend only), or **11.1 First-trade confetti**.

---

## 2026-05-13T(auto) -- 7.1 Change password screen

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **7.1 Change password screen**
**Commit:** `00f1918`

**What changed**
- `app/change-password.tsx` (new, 278 lines):
  - Form: current password + new password x2
  - Validation: length >= 8, both new fields match, new != current
  - Step 1: silently re-verifies via `signIn(account.login, currentPassword)`
  - Step 2: calls `useAuthStore.changePassword(newPassword)`
  - On success: green CheckCircle state shown for 2.2s, then `signOut()` + `router.replace('/(auth)/login')`
  - Uses `@/lib/theme` tokens (bgDeep, bgSurface, border, textPrimary, textSecondary, loss, profit, primary)
- `TODO.md`: 7.1 marked [x]

**Verification**
- `tsc --noEmit` client: exit 0 (silent)
- `tsc --noEmit` server: exit 0 (silent)
- Deploy NOT done (sandbox has no Railway/Vercel access)

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash. Verify with Python null-byte check after every write.
2. Unicode/heredoc: write via Python script piped via python3 heredoc block, not bash heredoc with file writes.
3. `.git/index.lock` is a stale WSL lock -- use `GIT_INDEX_FILE=/tmp/vanta_*_idx` for all git ops; commit via `git commit-tree`; write SHA to `.git/refs/heads/main`.
4. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
5. Colors import: use `@/lib/theme` (not `@/lib/colors`). Keys: bgDeep, bgElevated, bgSurface, border, textPrimary, textSecondary, textMuted, primary, profit, loss, warning, info.

**Next agent:** pick **7.3 2FA (TOTP)**, **8.2 Symbol categories** (frontend only), or **11.1 First-trade confetti**.

---

## 2026-05-12T(auto) -- 7.2 Show login number prominently

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **7.2 Show login number prominently**
**Commit:** `9738e36`

**What changed**
- `app/(tabs)/profile.tsx`:
  - Added `import * as Clipboard from 'expo-clipboard'`
  - Added `import { useAccountStore } from '@/stores/account'`
  - Header now shows `Account #<login>` (from useAccountStore) instead of email/Trader
  - Pressable wraps the account number text; tap calls `Clipboard.setStringAsync()`
  - Below the number: Tap to copy hint that flips to Copied! (green) for 2s
  - Security & Password row now routes to `/change-password` (prep for TODO 7.1)

**Verification**
- `tsc --noEmit` client: exit 0
- `tsc --noEmit` server: exit 0
- Deploy NOT done (sandbox has no Railway/Vercel access)

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash. Verify with Python null-byte check after every write.
2. Unicode/heredoc: write via Python script piped via `python3 << 'PYEOF'` block, not bash heredoc with file writes.
3. `.git/index.lock` is a stale WSL lock -- use `GIT_INDEX_FILE=/tmp/vanta_*_idx` for all git ops; commit via `git commit-tree`; write SHA to `.git/refs/heads/main`.
4. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.

**Next agent:** pick **7.1 Change password screen** -- new file `app/change-password.tsx`. `useAuthStore.changePassword(newPassword)` already exists. Frontend only, no migration needed.

---

## 2026-05-12T(auto) -- 6.5 Notification preferences

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **6.5 Notification preferences**
**Commit:** `9d500a8`

**What changed**
- `supabase/migrations/010_notification_prefs.sql` (new, 13 lines):
  - `notification_prefs JSONB NOT NULL DEFAULT all-true` added to `profiles`
  - Migration 010 -- apply: `SUPABASE_PAT=<pat> python scripts/apply-migration.py supabase/migrations/010_notification_prefs.sql`
- `server/src/lib/push.ts`: added `sendPushChecked(userId, prefKey, payload)` + `NotificationPrefKey` type
  - Checks `profiles.notification_prefs[prefKey]`; if explicitly `false`, suppresses push; defaults to send
- `server/src/routes/account.ts`: added `PUT /api/account/notification-prefs`
  - Merge-patch semantics: only supplied keys are updated; omitted keys retain current value
  - Whitelists: price_alerts, robot_signals, trade_results, promotional
- `server/src/routes/orders.ts`: trade-close push changed to `sendPushChecked(..., 'trade_results', ...)`
- `server/src/workers/risk.ts`: all 3 SL/TP/stopout pushes changed to `sendPushChecked(..., 'trade_results', ...)`
- `server/src/workers/priceAlerts.ts`: price-alert push changed to `sendPushChecked(..., 'price_alerts', ...)`
- `lib/api.ts`: added `NotificationPrefs` interface + `getNotificationPrefs()` + `updateNotificationPrefs()`
- `app/notifications-settings.tsx` (new, 190 lines):
  - 4 Switch toggles: Trade Results, Price Alerts, Robot Signals, Promotions
  - Optimistic update with rollback on failure; spinner while saving
- `app/(tabs)/profile.tsx`: Notifications row now navigates to `/notifications-settings`
- `TODO.md`: 6.5 marked [x]

**Verification**
- `tsc --noEmit` client: exit 0
- `tsc --noEmit` server: exit 0
- Deploy NOT done (sandbox has no Railway/Vercel access)
- Migration apply needed: `SUPABASE_PAT=<pat> python scripts/apply-migration.py supabase/migrations/010_notification_prefs.sql`

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation / corruption bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash. Verify with `wc -l` + `tail` + null-byte check after every write.
2. Unicode characters (em-dash, box-drawing, arrows) in file content cause the Write/Edit tool to truncate the file. Use ASCII only or write via Python.
3. `.git/index.lock` is a stale WSL lock -- cannot be deleted. Use `GIT_INDEX_FILE=/tmp/vanta_*_idx` for all git ops; commit via `git commit-tree`; write SHA to `.git/refs/heads/main`.
4. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.

**Next agent:** pick **7.1 Change password screen** (frontend only, simple) or **7.2 Show login number prominently** (very small profile.tsx change).
