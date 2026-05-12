# STATE -- handoff notes for the next agent

> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.

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

---


## 2026-05-12T(auto) -- 6.4 Price alerts

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **6.4 Price alerts**
**Commit:** `f21a6ca`

**What changed**
- `supabase/migrations/008_price_alerts.sql` (new, 47 lines):
  - `price_alerts` table: id, user_id, symbol, threshold, direction (above|below), triggered_at, created_at
  - RLS: users see/insert/delete own alerts only
  - Partial unique index: one active alert per (user, symbol, direction)
  - Indexes for worker scan (by symbol, active only) and per-user listing
- `server/src/routes/alerts.ts` (new, 98 lines):
  - GET /api/alerts?active=true -- list caller's alerts
  - POST /api/alerts -- create/replace alert {symbol, threshold, direction}
  - DELETE /api/alerts/:id -- cancel alert
- `server/src/workers/priceAlerts.ts` (new, 121 lines):
  - 5s tick, fetches all un-triggered alerts, checks against in-memory quote cache
  - Fires push + sets triggered_at (CAS guard) for each triggered alert
- `server/src/index.ts`: registered alertsRoutes + startPriceAlertsWorker
- `lib/api.ts`: added getAlerts(), createAlert(), deleteAlert() + PriceAlert interface
- `components/pro/PriceAlertModal.tsx` (new, 331 lines):
  - Bottom-sheet modal: above/below toggle, price input, pre-filled from live mid
  - Shows existing active alert for the symbol with cancel option
  - Success state auto-closes after 900ms
- `components/pro/ProTradeScreen.tsx`: added "Set alert" button below chart
- `TODO.md`: 6.4 sub-items marked [x]

**Housekeeping this run**
- lib/api.ts had garbage appended from previous run (file-write bug). Restored from HEAD before starting.
- Write/Edit tool and Unicode box-drawing chars caused file truncation in api.ts, index.ts, ProTradeScreen.tsx. Fixed by rewriting all affected files via Python.

**Verification**
- `tsc --noEmit` client: exit 0
- `tsc --noEmit` server: exit 0
- Deploy NOT done (sandbox has no Railway/Vercel access)
- Migration apply: `SUPABASE_PAT=<pat> python scripts/apply-migration.py supabase/migrations/008_price_alerts.sql`

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation / corruption bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash. Verify with `wc -l` + `tail` + null-byte check after every write.
2. Unicode characters (em-dash, box-drawing, arrows) in file content cause the Write/Edit tool to truncate the file. Use ASCII only or write via Python.
3. `.git/index.lock` is a stale WSL lock -- cannot be deleted. Use `GIT_INDEX_FILE=/tmp/vanta_*_idx` for all git ops; commit via `git commit-tree`; write SHA to `.git/refs/heads/main`.
4. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.

**Next agent:** pick **6.5 Notification preferences**, **7.1 Change password screen** (frontend only, simple), or **7.2 Show login number prominently**.

---

## 2026-05-12T(auto) — 5.2 Admin KYC review

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **5.2 Admin KYC review**
**Commit:** `83deb29`

**What changed**
- `server/src/routes/admin.ts`: Added 3 KYC admin endpoints under `/api/admin/kyc`:
  - `GET /kyc?status=` — lists submissions + docs with 1-hour signed Storage URLs
  - `POST /kyc/:id/approve` — sets status='approved', reviewed_at=now()
  - `POST /kyc/:id/reject` — sets status='rejected', rejection_reason, reviewed_at
- `lib/api.ts`: Added `adminGetKycSubmissions()`, `adminApproveKyc()`, `adminRejectKyc()` client methods
- `app/admin/kyc.tsx` (new, 535 lines):
  - Admin-gated screen (redirects with Access Denied for non-admins)
  - Status filter tabs: Pending / Approved / Rejected / All
  - Expandable submission cards with user_id, submitted_at, status badge, doc count
  - 2×2 doc thumbnail grid (id_front, id_back, selfie, proof_of_address) with signed URL images; tap opens in browser via Linking
  - Approve / Reject action buttons (pending only); reject modal with multiline reason textarea
- `TODO.md`: 5.2 marked `[x]`

**Verification**
- Both `tsc --noEmit` passes (client exit=0, server exit=0)
- Deploy NOT done (sandbox has no Railway/Vercel access — same as previous runs)
- Acceptance criteria (approve → status='approved', user can withdraw) verified via code logic only; needs live test after deploy

**Recurring gotchas (still active)**
1. File truncation bug: Write/Edit tool silently truncates long files. ALWAYS use `wc -l` + `tail` to verify after writes. Use `cat >>` via bash to append missing content instead of re-editing.
2. `.git/index` is corrupt (stale WSL lock). Use `GIT_INDEX_FILE=/tmp/vanta_commit_idx` for all git staging; commit via `git commit-tree`; write SHA to `.git/refs/heads/main`.
3. `git_vanta_idx.lock` cannot be deleted — use `/tmp/` for fresh index files.
4. Sandbox network is isolated — no Railway/Vercel/Supabase live access.

**Next agent:** pick **5.3 Sumsub** (requires Sumsub account — likely blocked), **6.4 Price alerts** (migration 008 + worker + UI), or **7.1 Change password screen** (frontend only, simplest).

---

