# STATE -- handoff notes for the next agent

> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.

---
## 2026-05-13T22:11(auto) -- 8.2 Symbol categories in client

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **8.2 Symbol categories in client**
**Commit:** `f241f33`

**What changed**
- `lib/symbolMeta.ts`: expanded from 56 to 78 symbols (47 crypto, 13 forex,
  2 metals / XAUUSD + XAGUSD, 16 stocks). CATEGORIES reordered Crypto-first.
  New forex: NZDUSD, USDCHF, EURJPY, GBPJPY, EURGBP, AUDJPY, EURCHF, GBPCHF.
  New stocks: MSFT, GOOGL, META, NVDA, NFLX, AMD, INTC, CRM, ORCL, IBM, BA, JPM, BAC.
- `lib/contracts.ts` + `server/src/lib/contracts.ts`: added all new forex pairs
  and stocks to FOREX_PAIRS / STOCK_SYMBOLS sets for correct margin/P&L math.
- `components/fun/QuickTradeScreen.tsx`: replaced hardcoded 6-item ASSETS with
  dynamic allSymbols() filtered by live quotes. Added category tab strip
  (All / Crypto / Forex / Metals / Stocks) above the asset chip row.
- `TODO.md`: 8.2 marked [x]

**Verification**
- tsc --noEmit client: exit 0
- tsc --noEmit server: exit 0
- Deploy NOT done (sandbox has no Railway/Vercel access)

**Notes**
- 22 new symbols in symbolMeta have no live pricefeed yet (new forex crosses + stocks).
  They show '--' in Pro picker but are excluded from QuickTradeScreen (filtered by live quotes).
  Indices/Commodities categories intentionally skipped -- blocked on 8.1 OANDA.
- Twelve Data credit budget unchanged (still 9 non-crypto symbols polled).

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash.
2. `.git/index.lock` is a stale WSL lock -- use GIT_INDEX_FILE=/tmp/vanta_*_idx for all git ops.
3. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
4. Colors import: use @/lib/theme (not @/lib/colors).
5. Git index corrupt -- always bootstrap with: GIT_INDEX_FILE=/tmp/X git read-tree HEAD before staging.
6. Supabase JS SDK v2.45 has no `listUserSessions` -- sessions.ts calls the REST API directly.

**Next agent:** pick **8.3 Search bar in symbol picker** (frontend only, small change to SymbolPickerModal),
**11.1 First-trade confetti**, or **9.1 EAS configuration** (eas.json scaffold only).

---

## 2026-05-13T(auto) -- 7.4 Active sessions / device list

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **7.4 Active sessions / device list**
**Commit:** `873488f`

**What changed**
- `server/src/routes/sessions.ts` (new): GET /api/auth/sessions, DELETE /api/auth/sessions/:id, DELETE /api/auth/sessions (revoke-all-others). Uses direct fetch to Supabase REST API (`/auth/v1/admin/users/{uid}/sessions`) because `listUserSessions` is not in @supabase/supabase-js v2.45 JS SDK.
- `server/src/index.ts`: registered sessionsRoutes under `/api/auth`
- `lib/api.ts`: `getSessions()`, `revokeSession()`, `revokeOtherSessions()` + `DeviceSession` interface
- `app/sessions.tsx` (new): device list screen -- user-agent parsing, THIS DEVICE badge, per-session Revoke button, sign-out-all-others button with confirmation
- `app/(tabs)/profile.tsx`: added Active Sessions row (Laptop icon) under Security section
- `TODO.md`: 7.4 marked [x]

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
6. Supabase JS SDK v2.45 has no `listUserSessions` -- sessions.ts calls the REST API directly via fetch.

**Next agent:** pick **8.2 Symbol categories** (frontend only, no migration), **11.1 First-trade confetti**, or **8.3 Search bar in symbol picker**.

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
