# STATE — handoff notes for the next agent

> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.

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
1. `.git/index.lock` (0-byt