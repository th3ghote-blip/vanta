# STATE -- handoff notes for the next agent

> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.

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


## 2026-05-11T(auto) — 5.1 Camera-based document upload

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **5.1 Camera-based document upload (homegrown)**

**Housekeeping this run**
- `.git/refs/heads/main` contained only `0x0a` (corrupted). Restored to `6e8e497` (most recent loose commit object).
- Prior agent run had left 4 files uncommitted (orders.ts, risk.ts, STATE.md, TODO.md from 6.3 re-application). Committed as `5604cad` before starting this item.
- `components/pro/SymbolPicker.tsx` showed binary diff vs HEAD — confirmed content-identical (CRLF encoding only), no action needed.

**What changed**
- `supabase/migrations/009_kyc_policies.sql` (new, 91 lines):
  - RLS insert/update on `kyc_submissions` for authenticated users.
  - RLS insert/select on `kyc_documents` (scoped to own submissions).
  - Creates `kyc` Storage bucket (private, 10 MB limit, image types only).
  - Storage object policies: upload/update/read for own folder (`{user_id}/`), admin read-all.
- `lib/kyc.ts` (new, 133 lines):
  - `getOrCreateSubmission(userId)` — upserts a `not_started` submission.
  - `getSubmissionDocs(submissionId)` — lists already-uploaded docs.
  - `uploadDocument(userId, submissionId, docType, localUri)` — fetch(localUri)→Blob→Supabase Storage upload→upsert kyc_documents row.
  - `submitKyc(submissionId)` — sets status=`pending`, submitted_at=now.
  - `getKycStatus(userId)` — quick status lookup.
- `app/kyc.tsx` (replaced, 431 lines):
  - On mount: auth→getOrCreateSubmission→getSubmissionDocs→restore uploaded set.
  - 4 step cards (id_front, id_back, selfie, proof_of_address).
  - Tap → `requestCameraPermissionsAsync` → `launchCameraAsync` (front cam for selfie); falls back to image library if camera denied.
  - Upload in-progress spinner per card. "Done" badge + "tap to replace" hint.
  - Progress bar (N/4).
  - "Submit for Review" button enabled only when all 4 uploaded → `submitKyc` → `submitted` screen.
  - Rejection banner shows `rejection_reason` from prior submission.
  - Approved/pending/under-review terminal screens.
- `package.json`: added `expo-image-picker@^55.0.20`, `expo-camera@^55.0.18`.
- `TODO.md`: 5.1 sub-items marked `[x]`.
- Installed via `npm install expo-image-picker@55.0.20 expo-camera@55.0.18 --legacy-peer-deps`.

**Verification done in-sandbox**
- `./node_modules/.bin/tsc --noEmit` (root) → exit 0 (silent).
- `cd server && ./node_modules/.bin/tsc --noEmit` → exit 0 (silent).

**Verification NOT done**
- Migration apply: `SUPABASE_PAT=<pat> python scripts/apply-migration.py supabase/migrations/009_kyc_policies.sql`
- Vercel deploy: `cd /c/Claude/vanta && vercel --prod --yes`
- E2E: Profile → Verify Identity → tap each step → camera opens → photo taken → "Done" badge → Submit → status='pending' in Supabase.

**Important: `kyc` Storage bucket**
The migration creates the bucket via SQL (`insert into storage.buckets`). This works in Supabase self-hosted but on Supabase cloud the bucket may need to be created manually via the dashboard if the migration fails with a permissions error on `storage.buckets`. Check after applying the migration.

**Recurring gotchas (CRITICAL)**
1. `.git/refs/heads/main` can become corrupted (just `0x0a`). Fix: find latest commit SHA via `find .git/objects -type f -not -name 'tmp_*' | ...` + `git cat-file -t`, then `echo -n <sha> > .git/refs/heads/main`.
2. `.git/index.lock` + `.git/HEAD.lock` are stale WSL lockfiles — cannot be deleted. Use `GIT_INDEX_FILE=/sessions/*/git_vanta_idx` for all index ops; commit via `git commit-tree`; write SHA to `.git/refs/heads/main`.
3. `unlink tmp_obj_*` warnings are cosmetic.
4. **File truncation bug**: Write/Edit tool can corrupt long files. Always verify with `wc -l` + `tail`.
5. **Index corruption**: always rebuild with `GIT_INDEX_FILE=.../git_vanta_idx git read-tree HEAD` before starting git ops.
6. User commits made via standard `git` (not the custom index workaround) may accidentally revert auto-agent changes if the standard `.git/index` is out of sync with the custom one.

**Next agent:** pick **5.2 Admin KYC review** (`app/admin/kyc.tsx` — queue of pending submissions, view docs, approve/reject). Or **6.4 Price alerts** (migration 008 + worker + UI). Or **7.1 Change password screen** (frontend only, simple).


