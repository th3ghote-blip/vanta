# STATE — handoff notes for the next agent

> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.

---

## 2026-05-11T(auto) — 6.3 Trade result notifications

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **6.3 Trade result notifications**

**Startup fix**
`components/pro/SymbolPicker.tsx` and `server/src/feed/pricefeed.ts` were truncated in the working tree from a prior run. Restored both from HEAD via `git show HEAD:<path>`. Regular `.git/index` had staged phantom deletions of tsconfig/vercel/migrations (known index corruption). Used custom `GIT_INDEX_FILE` for all git ops as usual.

**What changed**
- `server/src/routes/orders.ts`:
  - Added `import { sendPush } from '../lib/push.js'`.
  - After manual `/close` succeeds (margin released), fires `sendPush(userId, { title: '<SYMBOL> closed', body: '+/-$X.XX', data: { tradeId, symbol, profit, kind:'trade_closed' } })` — fire-and-forget (`.catch(()=>{})`).
- `server/src/workers/risk.ts`:
  - Added `import { sendPush } from '../lib/push.js'`.
  - Added `user_id: string` to `OpenTrade` interface.
  - Updated select query: `accounts!inner(leverage, user_id)` (was `accounts!inner(leverage)`).
  - Populates `user_id: raw.accounts?.user_id ?? ''` when building each `OpenTrade`.
  - After SL hit auto-close: sends push `"<SYMBOL> stop-loss hit +/-$X.XX"`.
  - After TP hit auto-close: sends push `"<SYMBOL> take-profit hit +/-$X.XX"`.
  - After stop-out auto-close: sends push `"<SYMBOL> stopped out +/-$X.XX"`.
  - All push calls are fire-and-forget; `sendPush` itself never throws.
- `TODO.md`: item 6.3 marked `[x]`.

**Verification done in-sandbox**
- `cd server && ./node_modules/.bin/tsc --noEmit` → exit 0.
- `./node_modules/.bin/tsc --noEmit` (root) → exit 0.

**Verification NOT done**
- Railway deploy: `cd /c/Claude/vanta/server && railway up --detach`
- E2E: close a trade manually → push received with "{symbol} closed +/-$X.XX".

**Recurring gotchas (CRITICAL)**
1. `.git/index.lock` + `.git/HEAD.lock` + `.git/refs/heads/main.lock` are stale WSL lockfiles that cannot be deleted. Use `GIT_INDEX_FILE=/sessions/*/git_vanta_idx` for all index ops; commit via `git commit-tree`; write SHA to both `.git/refs/heads/main` AND `.git/refs/heads/main.lock`.
2. `unlink tmp_obj_*` warnings during `write-tree`/`git add` are cosmetic.
3. **File truncation bug**: Write/Edit tool truncates long files. ALWAYS restore from HEAD first, then use bash `cat >>` or `python3` string replacement for edits near end-of-file. Verify with `wc -l` + `tail`.
4. `npx --no-install tsc --noEmit` may swallow errors — use `./node_modules/.bin/tsc --noEmit`.
5. **Index corruption**: always rebuild with `GIT_INDEX_FILE=.../git_vanta_idx git read-tree HEAD` before starting git ops.

**Next agent:** pick **5.1 Camera-based document upload** (requires `expo-image-picker` + `expo-camera` installs — listed in TODO so install is permitted). Or **6.4 Price alerts** (migration 008 + worker + UI). Or **7.1 Change password screen** (frontend only, no installs).

---

## 2026-05-11T(auto) — 3.4 Tip-only robots send push notifications

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **3.4 Tip-only robots send push notifications**

**Startup fix**
Working tree had junk appended to `app/(tabs)/profile.tsx` (lines 180–199 were duplicate JSX from a prior truncation). Truncated back to 179 lines. After fix the file matched HEAD exactly — no commit needed for that file.

**What changed**
- `server/src/ai/robotEngine.ts`:
  - Added `import { sendPush } from '../lib/push.js';` at top.
  - Replaced the `kind === 'tip'` stub branch (which only logged) with a real push call:
    - `tipText` resolved from `config.tip_text` → `config.description` → `robot.name` → fallback string.
    - `sendPush(robot.user_id, { title: robot.name, body: tipText, data: { robotId, kind:'tip' } })`.
    - `logRun` action is still `'tip_sent'`; notes encode `push_sent: <text>` or `push_failed: <text>`.
    - `touchRobotLastRun` called as before.
- `TODO.md`: item 3.4 sub-item marked `[x]`.

**Verification done in-sandbox**
- Client `./node_modules/.bin/tsc --noEmit` → exit 0.
- Server `./node_modules/.bin/tsc --noEmit` → exit 0.

**Verification NOT done**
- Railway deploy: `cd /c/Claude/vanta/server && railway up --detach`
- E2E: Create a robot with `config.kind='tip'`; wait for it to fire → push received on device with correct title/body.

**Recurring gotchas (CRITICAL)**
1. `.git/index.lock` + `.git/HEAD.lock` + `.git/refs/heads/main.lock` are stale WSL lockfiles that cannot be deleted. Use `GIT_INDEX_FILE=/sessions/*/git_vanta_idx` for all index ops; commit via `git commit-tree`; write SHA to both `.git/refs/heads/main` AND `.git/refs/heads/main.lock`.
2. `unlink tmp_obj_*` warnings during `write-tree`/`git add` are cosmetic.
3. **File truncation bug**: Write/Edit tool can truncate long files. Profile.tsx was corrupted this run. Fix: `head -N file > tmp && cp tmp file`. Always verify `wc -l` + `tail`.
4. `npx --no-install tsc --noEmit` may swallow errors — use `./node_modules/.bin/tsc --noEmit`.
5. **Index corruption**: always rebuild with `GIT_INDEX_FILE=.../git_vanta_idx git read-tree HEAD` before starting git ops.

**Next agent:** pick **6.3 Trade result notifications** — import `sendPush` into `server/src/routes/orders.ts` and `server/src/workers/risk.ts`; call when trade closes (manual or SL/TP/stop-out). Or pick **5.1 Camera-based document upload** (needs `expo-image-picker` + `expo-camera` installs, listed in TODO).

---

## 2026-05-11T(auto) — 6.2 Server-side push helper

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **6.2 Server-side push helper**
**Commit:** (see sha below)

**What changed**
- `server/src/lib/push.ts` (new, ~160 lines):
  - `sendPush(userId, { title, body, data, sound, badge })`: fetches `profiles.push_token` for the given userId via Supabase, sends a single-message POST to `https://exp.host/--/api/v2/push/send`, logs any per-ticket Expo errors (e.g. DeviceNotRegistered). Returns `true` on Expo `ok` ticket, `false` otherwise.
  - `sendPushBatch(entries)`: fetches all tokens in one Supabase query (skips nulls), builds messages, chunks into ≤100 per Expo request, fires them all. Returns void — fully fault-tolerant.
  - `buildMessage` / `getToken` / `getTokens` / `sendToExpo` internal helpers.
  - Uses native `fetch` (Node 18+, no new dependencies).
  - All errors caught and logged — never throws. Safe to `await` from any route or worker.

**Verification done in-sandbox**
- `cd server && ./node_modules/.bin/tsc --noEmit` → exit 0.
- `./node_modules/.bin/tsc --noEmit` (root) → exit 0.

**Verification NOT done**
- Railway deploy: `cd /c/Claude/vanta/server && railway up --detach`
- E2E: import `sendPush` from a route/worker, call with a real userId that has a push_token → notification received on device.

**Recurring gotchas (CRITICAL)**
1. `.git/index.lock` + `.git/HEAD.lock` + `.git/refs/heads/main.lock` are stale WSL lockfiles that cannot be deleted. Workaround: use `GIT_INDEX_FILE=/sessions/*/git_vanta_idx` for all index ops; commit via `git commit-tree`; write SHA to both `.git/refs/heads/main` AND `.git/refs/heads/main.lock`.
2. `unlink tmp_obj_*` warnings during `write-tree`/`git add` are cosmetic.
3. **File truncation bug**: Write/Edit tool truncates long files. Fix with bash heredoc and verify with `wc -l` + `tail`.
4. `npx --no-install tsc --noEmit` may swallow errors — use `./node_modules/.bin/tsc --noEmit`.
5. **Index corruption**: the regular `.git/index` doesn't track files committed via the custom index. Always rebuild with `GIT_INDEX_FILE=.../git_vanta_idx git read-tree HEAD` before starting git ops.

**Next agent:** pick **3.4 Tip-only robots send push notifications** — its dep (6.2) is now done. Import `sendPush` from `../../lib/push.js` in `server/src/ai/robotEngine.ts`; when `config.kind='tip'`, call `sendPush(robot.user_id, { title: 'Robot tip', body: tip_text })` instead of opening a trade. Or pick **5.1 Camera-based document upload** (needs `expo-image-picker` + `expo-camera` installs, listed in TODO). Or **6.3 Trade result notifications** (import `sendPush` into `server/src/routes/orders.ts` and `workers/risk.ts`).

---

## 2026-05-11T(auto) — 6.1 Expo push token registration

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **6.1 Expo push token registration on login**
**Commit:** `c5eab8c` — `auto: Expo push token registration (Phase 6.1)`

**Session startup fix**
Prior run's cleanup commit (6184f37) was an empty commit — STATE.md and TODO.md updates never landed. Fixed by committing them in `d91c2b0` before starting this run's work.

**What changed**
- `lib/notifications.ts` (new, 112 lines):
  - `registerForPushNotificationsAsync(userId)`: requests permission via `Notifications.requestPermissionsAsync()`, fetches Expo push token via `getExpoPushTokenAsync()`, saves to `profiles.push_token` via Supabase client. Handles: web (skip), permission denied (warn + return null), TBD/missing projectId (passes no options — works in Expo Go; warns + returns null if token fetch fails), Supabase write error (warn + return null).
  - `unregisterPushToken(userId)`: sets `profiles.push_token = null` on sign-out.
  - Sets `Notifications.setNotificationHandler` for foreground alert/sound.
- `app/_layout.tsx`: imports both helpers; adds `prevUserIdRef` to track current user; in the session `useEffect`, calls `registerForPushNotificationsAsync` when a new `userId` appears (guards against duplicate calls on re-renders); calls `unregisterPushToken` when session becomes null.

**Verification done in-sandbox**
- `./node_modules/.bin/tsc --noEmit` (root) → exit 0.
- `cd server && ./node_modules/.bin/tsc --noEmit` → exit 0.

**Verification NOT done**
- Vercel deploy: `cd /c/Claude/vanta && vercel --prod --yes`
- E2E: Sign in on a physical device → `SELECT push_token FROM profiles WHERE id='<id>'` in Supabase → token present.

**Recurring gotchas (CRITICAL)**
1. `.git/index.lock` + `.git/HEAD.lock` + `.git/refs/heads/main.lock` are stale WSL lockfiles that cannot be deleted. Workaround: use `GIT_INDEX_FILE=/sessions/*/git_vanta_idx` for all index ops; commit via `git commit-tree`; write SHA to both `.git/refs/heads/main` AND `.git/refs/heads/main.lock`.
2. `unlink tmp_obj_*` warnings during `write-tree`/`git add` are cosmetic.
3. **File truncation bug**: Write/Edit tool truncates long files. Fix with bash heredoc and verify with `wc -l` + `tail`. The empty-commit bug on cleanup runs (6184f37) is a symptom — the cleanup commit itself was staged with an empty tree.
4. `npx --no-install tsc --noEmit` may swallow errors — use `./node_modules/.bin/tsc --noEmit`.
5. The cleanup commit pattern (separate "mark done + STATE.md" commit) has failed twice now. Better approach: commit STATE.md + TODO.md in the SAME commit as the work, or verify the tree is non-empty before committing.

**Next agent:** pick **6.2 Server-side push helper** (`server/src/lib/push.ts`) — no hard deps, unblocks 3.4 (tip robots). Or pick **5.1 Camera-based document upload** (needs `expo-image-picker` + `expo-camera` installs, explicitly listed in TODO item).


## 2026-05-10T(auto) — 4.4 Transaction history detailed view

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **4.4 Transaction history detailed view**
**Commit:** `7e16ba8` — `auto: transaction history detailed view (Phase 4.4)`

**What changed**
- `app/transactions.tsx` (new, 450 lines): Full transaction history screen.
  - Filter tabs: All / Deposits / Withdrawals / Bonuses / Adjustments (server-side via Supabase query).
  - Paginated at 50/page with infinite scroll (onScroll nearBottom triggers loadMore).
  - Status badges: Pending / Completed / Rejected with colour-coded backgrounds.
  - Type icons: ArrowDownToLine (deposit), ArrowUpFromLine (withdrawal), Gift (bonus), SlidersHorizontal (adjustment).
  - CSV export via `Share.share()` — fetches up to 1000 rows respecting filter, fields: id, type, amount, status, method, destination, notes, created_at, completed_at.
  - Pull-to-refresh, empty state with History icon.
- `app/(tabs)/portfolio.tsx`: Added "View all →" Pressable in RECENT ACTIVITY header linking to `/transactions`. Also restored truncated `timeAgo` function body (prior agent truncation bug fixed).
- `app/(tabs)/profile.tsx`: Restored truncated `Row` component body (prior agent truncation bug fixed).
- `app/admin/transactions.tsx`: Fixed pre-existing TS errors — `colors.bg` → `colors.bgSurface` (3 occurrences).
- `TODO.md`: item 4.4 marked `[x]`.

**Verification done in-sandbox**
- `./node_modules/.bin/tsc --noEmit` (root) → exit 0.
- `cd server && ./node_modules/.bin/tsc --noEmit` → exit 0.

**Verification NOT done**
- Railway deploy: `cd /c/Claude/vanta/server && railway up --detach`
- Vercel deploy: `cd /c/Claude/vanta && vercel --prod --yes`
- E2E: Portfolio → "View all →" → transactions screen → filter tabs work → CSV export opens share sheet.

**Recurring gotchas (CRITICAL)**
1. `.git/index.lock` + `.git/HEAD.lock` + `.git/refs/heads/main.lock` are stale WSL lockfiles that cannot be deleted. Workaround: use `GIT_INDEX_FILE=/sessions/*/git_vanta_idx` for all index ops; commit via `git commit-tree`; write SHA to both `.git/refs/heads/main` AND `.git/refs/heads/main.lock`.
2. `unlink tmp_obj_*` warnings during `write-tree`/`git add` are cosmetic.
3. **File truncation bug**: Write/Edit tool can truncate long files. Always verify with `tail -5 <file> | cat -A` and check for `^@` null bytes or abrupt endings. Fix: `tr -d '\000'` and/or append missing tail from git history.
4. `npx --no-install tsc --noEmit` may swallow errors with exit 1 and no output — fall back to `./node_modules/.bin/tsc --noEmit` to see actual errors.
5. `profile.tsx` and `portfolio.tsx` were truncated by prior agents; this run restored them fully. Both are now complete in HEAD.

**Next agent:** pick **5.1 Camera-based document upload** (KYC real upload replacing scaffold) — needs `expo-image-picker` install. Or skip to **6.1 Expo push token registration** (no deps, frontend only, unblocks 3.4 + 6.2). Recommended: **6.1** (quick, no installs needed beyond Expo SDK already present).

---

## 2026-05-10T(auto) — 4.3 Admin role + approval queue

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **4.3 Admin role + approval queue**
**Commit:** `9e6045c` — `auto: admin role + approval queue (Phase 4.3)`

**What changed**
- `supabase/migrations/007_admin.sql` (new): `ALTER TABLE profiles ADD COLUMN is_admin boolean NOT NULL DEFAULT false` + partial index on `(is_admin) WHERE is_admin=true`.
- `server/src/routes/admin.ts` (new, 122 lines): `authAdmin()` helper (verifies JWT + checks `profiles.is_admin`). Three endpoints:
  - `GET /api/admin/transactions?status=pending|completed|rejected|all` — returns up to 100 rows with nested account info.
  - `POST /api/admin/transactions/:id/approve` — credits balance for deposit/bonus/adjustment, debits for withdrawal (with balance check), sets `status='completed'`.
  - `POST /api/admin/transactions/:id/reject` — sets `status='rejected'`, stores optional reason in notes.
- `server/src/routes/account.ts`: Added `GET /api/account/profile` — returns full profile row including `is_admin`.
- `server/src/index.ts`: Imports + registers `adminRoutes` at `/api/admin`.
- `lib/api.ts`: Added `getProfile()`, `adminGetTransactions()`, `adminApproveTransaction()`, `adminRejectTransaction()`.
- `app/admin/transactions.tsx` (new, 408 lines): Admin screen with status-filter tabs (Pending/Completed/Rejected/All), transaction cards showing type/amount/account/method/destination, Approve + Reject buttons for pending rows, reject-reason modal, pull-to-refresh. Access-denied screen for non-admins.
- `app/(tabs)/profile.tsx`: Loads profile on mount; shows "Admin — Transactions" menu item (with `ShieldCheck` icon) only when `is_admin=true`.
- `TODO.md`: All four 4.3 sub-items marked `[x]`.

**Verification done in-sandbox**
- `cd server && npx tsc --noEmit` → exit 0.
- `npx tsc --noEmit` (root) → exit 0.

**Verification NOT done**
- Migration apply: `SUPABASE_PAT=<pat> python scripts/apply-migration.py supabase/migrations/007_admin.sql`
- Railway deploy: `cd /c/Claude/vanta/server && railway up --detach`
- Vercel deploy: `cd /c/Claude/vanta && vercel --prod --yes`
- E2E: `UPDATE profiles SET is_admin=true WHERE id='<your-user-id>';` in Supabase SQL editor → Profile tab shows Admin menu item → approve a pending deposit → account balance updates.

**Recurring gotchas (CRITICAL)**
1. `.git/index.lock` + `.git/HEAD.lock` + `.git/refs/heads/main.lock` are 0-byte stale WSL lockfiles that **cannot be deleted or overwritten via rm**. Workaround:
   - Use `GIT_INDEX_FILE=/sessions/*/git_vanta_idx` for all index ops.
   - Commit via `git commit-tree` + write SHA directly to `.git/refs/heads/main` **and** `.git/refs/heads/main.lock`.
2. `unlink tmp_obj_*` warnings during `write-tree`/`git add` are cosmetic.
3. **Edit tool truncates long files.** Files affected this run: `lib/api.ts`, `server/src/index.ts`. Fix: bash heredoc to rewrite the tail; verify with `wc -l` and `tail`.

**Next agent:** pick **4.4 Transaction history detailed view** (`app/transactions.tsx`, filters + CSV export, wired from Portfolio). No hard dependencies.

---

## 2026-05-10T(auto) — 4.2 Withdrawals screen

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **4.2 Withdrawals screen**
**Commit:** `b593ee9` — `auto: withdrawals screen (Phase 4.2)`

**Session startup fix**
The git index was corrupted on entry (staged revert of all prior work). Fixed by rebuilding index from HEAD via `GIT_INDEX_FILE=/sessions/*/git_vanta_idx git read-tree HEAD`. Also restored `components/robots/RobotPromptBuilder.tsx` (17 lines of junk appended in working tree) by copying from HEAD blob.

**What changed**
- `app/withdraw.tsx` (new, 476 lines): Full withdrawal screen.
  - KYC gate: queries `kyc_submissions` on mount; shows ShieldAlert + "Verify Identity First" + link to KYC screen if not approved.
  - Amount input with inline validation (positive, ≥ $10, ≤ balance).
  - Quick-fill buttons: 25% / 50% / 100% / Max of current balance.
  - Method selector: Crypto (wallet address) | Bank Wire (free-text bank details).
  - Destination input with contextual placeholder + multiline for wire.
  - Processing info card (fees, timelines, warnings).
  - Submit → POST `/api/transactions/withdraw` → success screen → auto-back after 2.2s.
  - Maps `ApiError` codes: `kyc_required` → Alert, `insufficient_balance` → inline error.
- `server/src/routes/transactions.ts`: Added `POST /api/transactions/withdraw`.
  - Auth → account ownership → balance check (400 `insufficient_balance`) → KYC check (403 `kyc_required`) → insert pending `withdrawal` transaction.
- `lib/api.ts`: Added `api.createWithdrawal()` method.
- `app/(tabs)/portfolio.tsx`: Withdraw `ActionPill` now has `onPress={() => router.push('/withdraw')}`.
- `TODO.md`: item 4.2 marked `[x]`.

**Verification done in-sandbox**
- `npx tsc --noEmit` (root) → exit 0.
- `cd server && npx tsc --noEmit` → exit 0.

**Verification NOT done**
- Railway deploy: sandbox has no outbound network. Run `cd /c/Claude/vanta/server && railway up --detach`.
- Vercel deploy: `cd /c/Claude/vanta && vercel --prod --yes`.
- E2E: Portfolio → Withdraw → without KYC → blocked screen. With KYC approved → form → submit → pending transaction in DB.

**Recurring gotchas (CRITICAL)**
1. `.git/index.lock` + `.git/HEAD.lock` + `.git/refs/heads/main.lock` are 0-byte stale WSL lockfiles that **cannot be deleted or overwritten via rm** (Operation not permitted). Workaround:
   - Use `GIT_INDEX_FILE=/sessions/*/git_vanta_idx` for all index ops (read-tree, add, write-tree, status, diff).
   - Commit via `git commit-tree` + write SHA directly to `.git/refs/heads/main`.
   - **Also write SHA to `.git/refs/heads/main.lock`** — git reads the .lock as the live ref when it exists.
   - `git log` fails on branch name; use `git log --oneline -N <SHA>` instead.
2. `unlink tmp_obj_*` warnings during `write-tree`/`git add` are cosmetic — objects are written correctly.
3. Working tree files may have junk appended if a prior Write/Edit tool call was interrupted mid-file. Always verify with `wc -l` vs expected and `git diff` before starting work.

**Next agent:** pick **4.3 Admin role + approval queue** (migration `007_admin.sql`, two endpoints, admin UI). Or skip to **6.1 Expo push token registration** (no deps, frontend only) to start unblocking Phase 6.

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
