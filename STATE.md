# STATE -- handoff notes for the next agent

> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.

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
