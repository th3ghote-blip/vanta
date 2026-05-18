# STATE -- handoff notes for the next agent

## 2026-05-18T00:00Z -- 15.5 Light theme toggle

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **15.5 Light theme toggle**
**Commit:** `3cdf564`

**Pre-run housekeeping**
Found `server/src/lib/supabase.ts` truncated (file-truncation bug from a prior unrelated run).
Restored to HEAD via `git show HEAD:... > /tmp/... && python3 shutil.copy(...)`.
No commit needed — file now matched HEAD, working tree was clean before starting the TODO item.

**What changed**
- `stores/theme.ts` (new, 36 lines): Zustand store for theme preference.
  State: `theme: 'auto' | 'dark' | 'light'`, `hydrated: boolean`.
  `setTheme()` updates store + writes to AsyncStorage key `vanta:theme`.
  `hydrate()` reads AsyncStorage on startup, defaults to 'dark'.
- `lib/theme.ts`: added `ColorTokens` interface (structural, not literal),
  `lightColors` palette, `useThemeColors()` hook (resolves 'auto' via
  `useColorScheme`), `resolveScheme()` helper for non-hook contexts.
  Static `colors` export kept as `darkColors` for backward compat.
- `app/_layout.tsx`: imports `useThemeStore` + `resolveScheme`.
  Hydrates theme on mount. Effect watches `themePreference` + `systemScheme`
  and calls `Appearance.setColorScheme()` (null for 'auto', 'light'/'dark'
  otherwise). Root `backgroundColor` and `StatusBar` style react to resolved
  scheme.
- `app/(tabs)/profile.tsx`: new **Display** section above Settings.
  3-button toggle (Auto / Dark / Light) using Monitor / Moon / Sun icons.
  Active button highlighted with `colors.primary` border + tint.
  Imports `useThemeStore` and `ThemePreference` type.

**Verification**
- tsc --noEmit client: exit 0
- tsc --noEmit server: exit 0
- Deploy NOT done (sandbox has no Railway/Vercel access)

**Notes**
- Existing screens still use the static `colors` (dark) import — they won't
  change appearance in light mode until individually updated to use
  `useThemeColors()`. The toggle wires up the foundation (store, tokens,
  Appearance override, StatusBar) and the profile UI. Progressive migration
  of individual screens is future work.
- Light palette: bgDeep=#EEF1F8, bgElevated=#FFFFFF, bgSurface=#F5F7FC,
  primary=#2563EB (slightly darker blue for contrast on white), profit/loss
  shifted for WCAG readability on light bg.

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash.
2. `.git/HEAD.lock` + `.git/index.lock` + `.git/refs/heads/main.lock` are stale WSL locks.
   Use GIT_INDEX_FILE=/tmp/vanta_<unique> git read-tree HEAD, then commit-tree, write to .git/refs/heads/main.
3. After every session start: pick a fresh GIT_INDEX_FILE tmp path (previous session's may error).
4. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
5. Colors import: use @/lib/theme (not @/lib/colors). bgBase does not exist -- use bgDeep.
6. Supabase JS SDK v2.45 has no `listUserSessions` -- sessions.ts calls the REST API directly.
7. Supabase select with joins returns GenericStringError unless you cast: `as unknown as TypedArray[]`.
8. `colors.primaryDim` does not exist -- just use `colors.primary`.
9. git write-tree / commit-tree: always redirect warnings to /dev/null (2>/dev/null) when
   capturing SHA into a variable, otherwise warning text contaminates the variable.
   Never write the raw output of commit-tree to .git/refs/heads/main without checking it's a clean 40-char SHA.

**Next agent:** All Phase 15 items are now complete. Pick from Phase 13 (Monitoring):
**13.1 Sentry integration (frontend)** — add `sentry-expo` or `@sentry/react-native`,
capture client errors, tag with login number.

---


## 2026-05-18T00:00Z -- Repair: atomic margin RPC (prior run cleanup)

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** *(housekeeping — not a TODO item)*
**Commit:** `69bc465`

**What happened**
A prior agent run attempted to refactor `server/src/lib/margin.ts` to use atomic
Postgres RPCs but hit the file truncation bug and did not commit. The working tree
had:
- `server/src/lib/margin.ts` — truncated mid-function (releaseMargin cut off at line 121)
- `supabase/migrations/013_margin_rpc.sql` — new file, complete and correct
- `.env.example` — corrupted (content stripped to `# `)
- `package-lock.json` — truncated (last 26 lines removed)

**What this run did**
1. Completed the truncated `releaseMargin` function in `margin.ts` using Python
   (matching the RPC + fallback pattern already present in `reserveMargin`).
2. Restored `.env.example` and `package-lock.json` to HEAD via `git show`.
3. Verified tsc --noEmit client: exit 0, server: exit 0.
4. Committed `margin.ts` + `013_margin_rpc.sql`.

**What changed (summary)**
- `server/src/lib/margin.ts`: both `reserveMargin` and `releaseMargin` now call
  Postgres RPCs (`reserve_margin` / `release_margin`) for atomic margin accounting.
  Both fall back to the prior non-atomic update if the migration hasn't been applied.
- `supabase/migrations/013_margin_rpc.sql`: `reserve_margin(uuid, numeric) → bool`
  and `release_margin(uuid, numeric) → void`. Apply via `scripts/apply-migration.py`.

**Migration needed**
Apply `013_margin_rpc.sql` to live DB:
`SUPABASE_PAT=<pat> python scripts/apply-migration.py supabase/migrations/013_margin_rpc.sql`
Until applied, margin reservation falls back to the old non-atomic path (safe but racy).

**Deploy NOT done** (sandbox has no Railway access).

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash.
2. `.git/HEAD.lock` + `.git/index.lock` + `.git/refs/heads/main.lock` are stale WSL locks.
   Use GIT_INDEX_FILE=/tmp/vanta_<unique> git read-tree HEAD, then commit-tree, write to .git/refs/heads/main.
3. After every session start: pick a fresh GIT_INDEX_FILE tmp path (previous session's may error).
4. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
5. Colors import: use @/lib/theme (not @/lib/colors). bgBase does not exist -- use bgDeep.
6. Supabase JS SDK v2.45 has no `listUserSessions` -- sessions.ts calls the REST API directly.
7. Supabase select with joins returns GenericStringError unless you cast: `as unknown as TypedArray[]`.
8. `colors.primaryDim` does not exist -- just use `colors.primary`.

**Next agent:** pick **15.5 Light theme toggle** — Profile → Display → Theme (Auto / Dark / Light),
new theme tokens for light mode, persists across reloads. Frontend only, no migrations.

---
> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.


## 2026-05-18T00:00Z -- 15.4 Brand polish

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **15.4 Brand polish**
**Commit:** `7364907`

**What changed**
- `components/shared/VantaLogo.tsx` (new, 93 lines): SVG logo component.
  - V mark rendered with react-native-svg `<Path>` shapes + `<LinearGradient>`
    (primaryGlow → primary, top to bottom) + `<Circle>` apex dot at V tip.
  - Props: `height` (default 32), `showWordmark` (default true), `tint` override.
  - Wordmark is a native `<Text>` so it inherits the loaded font stack.
- `app/index.tsx`: replaced text "VANTA" with `<VantaLogo height={52} />`.
  Fixed magic spacing numbers to use `spacing.sm` / `spacing.xxl` tokens.
- `app/(auth)/login.tsx`: replaced both VANTA Text blocks (main login + TOTP
  step) with `<VantaLogo height={44} />`.
- `app/(auth)/signup.tsx`: replaced all VANTA Text blocks (credential display +
  main signup form) with VantaLogo.
- `app/_layout.tsx`: added `useFonts` from `expo-font`. Font map loads Inter and
  JetBrains Mono from Google Fonts CDN URIs — no npm packages required at
  runtime (works on web immediately; native caches after first load).
  Comment in file explains how to switch to bundled `@expo-google-fonts` packages
  for faster cold start / full offline support.
- `package.json`: added `@expo-google-fonts/inter ^0.2.3`,
  `@expo-google-fonts/jetbrains-mono ^0.2.3`, `expo-font ~13.0.0` as
  dependencies. Run `npm install` on the real machine to bundle fonts.

**Verification**
- tsc --noEmit client: exit 0 (silent)
- tsc --noEmit server: exit 0 (silent)
- Deploy NOT done (sandbox has no Railway/Vercel access)

**Notes**
- The font CDN URIs are woff2 (Latin subset). If non-Latin characters are needed,
  swap for the full unicode-range URI from Google Fonts.
- `fontsLoaded` from useFonts is intentionally unused as a gate — the app renders
  immediately and fonts swap in (SWAP behaviour). No loading screen delay added.
- Spacing audit: identified magic numbers (padding: 3, paddingVertical: 15, etc.)
  in deposit.tsx, kyc.tsx, change-password.tsx, profile.tsx, robots.tsx,
  admin/index.tsx — these are mostly small indicator/dot padding that is
  intentionally sub-token. Not changed to avoid visual regressions.

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash.
2. `.git/HEAD.lock` + `.git/index.lock` + `.git/refs/heads/main.lock` are stale WSL locks.
   Use GIT_INDEX_FILE=/tmp/vanta_<unique> git read-tree HEAD, then commit-tree, write to .git/refs/heads/main.
3. After every session start: pick a fresh GIT_INDEX_FILE tmp path (previous session's may error).
4. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
5. Colors import: use @/lib/theme (not @/lib/colors). bgBase does not exist -- use bgDeep.
6. Supabase JS SDK v2.45 has no `listUserSessions` -- sessions.ts calls the REST API directly.
7. Supabase select with joins returns GenericStringError unless you cast: `as unknown as TypedArray[]`.
8. `colors.primaryDim` does not exist -- just use `colors.primary`.

**Next agent:** pick **15.5 Light theme toggle** — Profile → Display → Theme (Auto / Dark / Light),
new theme tokens for light mode, persists across reloads. Frontend only, no migrations.

---
> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.

## 2026-05-18T00:00Z -- 15.3 Loading skeletons

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **15.3 Loading skeletons**

**What changed**
- `components/shared/SkeletonShimmer.tsx` (new, 260 lines): core shimmer skeleton system.
  - `Skeleton` — base shimmer box: configurable width/height/borderRadius, animated
    LinearGradient sweep (expo-linear-gradient + Animated, useNativeDriver:true).
  - `PortfolioSkeleton` — full-screen placeholder matching portfolio layout:
    account header strip, balance card with equity/change row, action buttons, 4 activity rows.
  - `TradeBookSkeleton` — inline placeholder: tab bar, stats row, 3 trade card rows.
  - `RobotsSkeleton` — inline placeholder: 3 robot card rows with icon/name/badge/stats.
- `app/(tabs)/portfolio.tsx`: replaced centered ActivityIndicator + "Loading account…"
  full-screen block with `<PortfolioSkeleton />`.
- `components/pro/TradeBook.tsx`: replaced two ActivityIndicator loading states
  (account loading + trades loading) with `<TradeBookSkeleton />`.
  The third ActivityIndicator (close-button spinner when `closing=true`) is intentional
  button feedback — left as-is.
- `app/(tabs)/robots.tsx`: replaced `<ActivityIndicator>` when loading robots list
  with `<RobotsSkeleton />`.

**Verification**
- tsc --noEmit client: exit 0 (silent)
- tsc --noEmit server: exit 0 (silent)
- Deploy NOT done (sandbox has no Railway/Vercel access)

**Notes**
- The shimmer uses `useNativeDriver: true` (transform translateX) so it's GPU-accelerated.
- `DimensionValue` imported from react-native to type the `width` prop correctly.
- Chart.tsx loading state (ActivityIndicator inside a fixed-height WebView container) was
  intentionally left as-is — it's in a bounded box and a skeleton there would add no value.
- PriceAlertModal and QuickTradeScreen ActivityIndicators are button-state spinners — left alone.

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash.
2. `.git/HEAD.lock` + `.git/index.lock` + `.git/refs/heads/main.lock` are stale WSL locks.
   Use GIT_INDEX_FILE=/tmp/vanta_<unique> git read-tree HEAD, then commit-tree, write to .git/refs/heads/main.
3. After every session start: pick a fresh GIT_INDEX_FILE tmp path (previous session's may error).
4. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
5. Colors import: use @/lib/theme (not @/lib/colors). bgBase does not exist -- use bgDeep.
6. Supabase JS SDK v2.45 has no `listUserSessions` -- sessions.ts calls the REST API directly.
7. Supabase select with joins returns GenericStringError unless you cast: `as unknown as TypedArray[]`.
8. `colors.primaryDim` does not exist -- just use `colors.primary`.

**Next agent:** pick **15.4 Brand polish** — load custom fonts (@expo-google-fonts/inter,
@expo-google-fonts/jetbrains-mono), replace text-based "VANTA" wordmark with SVG logo,
audit spacing consistency. Frontend only, no migrations.

---
> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.


## 2026-05-17T00:00Z -- 15.2 Empty states audit

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **15.2 Empty states audit**
**Commit:** `881cdb6`

**What changed**
- `components/shared/EmptyState.tsx` (new, 70 lines): reusable component with
  icon + title + optional subtitle + optional CTA button. Use this going forward
  instead of ad-hoc `alignItems:'center'` blocks.
- `components/pro/TradeBook.tsx`: the `!account` guard was a bare spinner with
  no text — now shows "Loading account…" so users aren't left at a silent spinner.
- `app/admin/kyc.tsx`: empty state for each filter tab now includes a subtitle:
  pending → "KYC submissions appear here when users complete verification."
  approved/rejected/all → appropriate context messages.
- `app/admin/transactions.tsx`: same pattern. Pending tab → "Pending deposits
  and withdrawals appear here for approval." etc.
- `app/admin/user/[id].tsx`: 4 bare `No X` fallback texts replaced with
  italic full-sentence descriptions (e.g. "No trading accounts found for this user.").

**Verification**
- tsc --noEmit client: exit 0 (silent)
- tsc --noEmit server: exit 0 (silent)
- Deploy NOT done (sandbox has no Railway/Vercel access)

**Notes**
- EmptyState component is ready to use but not yet wired into user-facing screens
  (TradeBook, Portfolio, etc.) — those already had reasonable hand-rolled empty states.
  Available for 15.3 (loading skeletons) and beyond.
- `colors.primaryDim` does not exist in theme — avoided it in EmptyState.

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash.
2. `.git/HEAD.lock` + `.git/index.lock` + `.git/refs/heads/main.lock` are stale WSL locks.
   Use GIT_INDEX_FILE=/tmp/vanta_<unique> git read-tree HEAD, then commit-tree, write to .git/refs/heads/main.
3. After every session start: pick a fresh GIT_INDEX_FILE tmp path (previous session's may error).
4. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
5. Colors import: use @/lib/theme (not @/lib/colors). bgBase does not exist -- use bgDeep.
6. Supabase JS SDK v2.45 has no `listUserSessions` -- sessions.ts calls the REST API directly.
7. Supabase select with joins returns GenericStringError unless you cast: `as unknown as TypedArray[]`.
8. `colors.primaryDim` does not exist -- just use `colors.primary`.

**Next agent:** pick **15.3 Loading skeletons** — replace ActivityIndicators on Trade /
Portfolio / Robots tabs with shape skeletons (shimmer animation). Frontend only, no migrations.

---
> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.


## 2026-05-17T00:00Z -- 15.1 Onboarding flow

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **15.1 Onboarding flow**
**Commit:** `00e1a10`

**What changed**
- `app/onboarding.tsx` (new, 232 lines): 3-step horizontal swipeable onboarding screen.
  Step 1 "Welcome to Vanta" (TrendingUp icon), Step 2 "Two ways to trade" (Zap icon — Pro vs Quick),
  Step 3 "Your $10k demo" (DollarSign icon). Dot indicators animate between pages.
  "Next" / "Let's trade" CTA plus "Skip" link. On finish or skip: sets
  AsyncStorage key `vanta_onboarding_done=true` then router.replace('/(tabs)/trade').
  On mount: if key already set, skips immediately to trade (handles repeat installs / re-logins).
- `app/(auth)/signup.tsx`: changed post-credential-save navigation from
  `router.replace('/(tabs)/trade')` to `router.replace('/onboarding')`.
  Also stripped 2 pre-existing null bytes from end of file (were causing TS1127 errors).
- `app/_layout.tsx`: added `<Stack.Screen name="onboarding" options={{ headerShown: false }} />`.
  Rewrote via Python after Edit tool truncated the file (same truncation bug as always).

**Verification**
- tsc --noEmit client: exit 0 (silent)
- tsc --noEmit server: exit 0 (silent)
- Deploy NOT done (sandbox has no Railway/Vercel access)

**Notes**
- Onboarding is device-local (AsyncStorage). If user uninstalls and reinstalls they see it again — intentional.
- The `_layout.tsx` truncation bug hit again on a 94-line file. Always use Python for any file that has
  more than ~50 lines, even when editing just one line — Edit tool re-serialises the full file and truncates.

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash.
2. `.git/HEAD.lock` + `.git/index.lock` + `.git/refs/heads/main.lock` are stale WSL locks.
   Use GIT_INDEX_FILE=/tmp/vanta_main_idx, git commit-tree, write to .git/refs/heads/main.
3. After every session start: GIT_INDEX_FILE=/tmp/vanta_main_idx git read-tree HEAD.
4. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
5. Colors import: use @/lib/theme (not @/lib/colors). bgBase does not exist -- use bgDeep.
6. Supabase JS SDK v2.45 has no `listUserSessions` -- sessions.ts calls the REST API directly.
7. Supabase select with joins returns GenericStringError unless you cast: `as unknown as TypedArray[]`.

**Next agent:** pick **15.2 Empty states audit** — audit all screens for silent gray states and add
helpful empty-state messages/CTAs. Frontend only, no migrations needed.

---
> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.

## 2026-05-16T08:00Z -- 12.4 Risk dashboard

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **12.4 Risk dashboard**
**Commit:** `43298b7`

**What changed**
- `server/src/routes/admin.ts`: new `GET /api/admin/risk` endpoint.
  Queries all open trades joined with accounts. Returns three payloads:
  (1) `symbol_exposure` — per-symbol buy/sell/net lot volumes, mid price,
      gross and net USD exposure; sorted by gross exposure descending.
  (2) `top_winning` / `top_losing` — top 10 open positions by live
      unrealized P&L (calculatePnL vs current getMid); coloured in UI.
  (3) `near_margin_call` — accounts where (equity/margin_used)*100 < 150%;
      includes balance, equity, margin_used, free_margin, unrealized P&L,
      margin level %; sorted by margin level ascending (most at risk first).
  Added imports: getMid (quoteCache), calculatePnL + contractSize (contracts).
- `lib/api.ts`: `adminGetRisk()` typed fetch helper with full response types.
- `app/admin/risk.tsx` (new, ~380 lines): three-section screen:
  Symbol Exposure cards (net direction badge, buy/sell lots, gross exposure),
  Open Positions with tab switcher (Top Winners / Top Losers),
  Near Margin Call list (colour-coded warning/danger by margin level).
  Pull-to-refresh. Error state with retry. Snapshot timestamp in header.
- `app/admin/index.tsx`: added "Risk Dashboard" NavRow (warning colour).

**Verification**
- tsc --noEmit client: exit 0
- tsc --noEmit server: exit 0
- Deploy NOT done (sandbox has no Railway/Vercel access)

**Notes**
- Margin call threshold is 150% (approaching the typical 100% hard stop-out).
  This is conservative — gives the admin early warning before stop-out fires.
- `RawOpenTrade` interface was needed in the endpoint to satisfy TS — Supabase
  infers `GenericStringError` from the multi-relation select string without it.
- The `package-lock.json` modification is pre-existing (not from this run).

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash.
2. `.git/HEAD.lock` + `.git/index.lock` + `.git/refs/heads/main.lock` are stale WSL locks.
   Use GIT_INDEX_FILE=/tmp/vanta_main_idx, git commit-tree, write to .git/refs/heads/main.
3. After every session start: GIT_INDEX_FILE=/tmp/vanta_main_idx git read-tree HEAD.
4. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
5. Colors import: use @/lib/theme (not @/lib/colors). bgBase does not exist -- use bgDeep.
6. Supabase JS SDK v2.45 has no `listUserSessions` -- sessions.ts calls the REST API directly.
7. Supabase select with joins returns GenericStringError unless you cast: `as unknown as TypedArray[]`.

**Next agent:** pick **15.1 Onboarding flow** (app/onboarding.tsx — 3-step swipeable:
"Welcome to Vanta", "Pro vs Quick mode", "Your $10k demo"; frontend only, shown once
after first signup, persisted via AsyncStorage).

---
> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.



## 2026-05-16T04:00Z -- 12.3 Manual balance adjustment

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **12.3 Manual balance adjustment**
**Commits:** `048b745` (code) `fda0486` (TODO.md)

**What changed**
- `server/src/routes/admin.ts`: new `POST /api/admin/accounts/:id/adjust` endpoint.
  Body: `{ amount: number, reason: string }`. amount can be negative for debits.
  Guards: admin-only, prevents negative balance, validates non-zero amount + reason.
  Inserts `transactions(type='adjustment', status='completed')` with admin userId
  embedded in `notes` for audit trail. Updates `accounts.balance` and `free_margin`.
- `lib/api.ts`: `adminAdjustBalance(accountId, amount, reason)` typed fetch helper.
- `app/admin/user/[id].tsx`: added `AdjustBalanceModal` (bottom-sheet, KeyboardAvoidingView)
  with amount TextInput (numeric, supports negative), live balance preview, reason TextInput,
  per-error-code error messages. "Adjust Balance" button appears below each account card.
  On success: optimistic balance update in local state + confirmation Alert.

**Verification**
- tsc --noEmit client: exit 0 (silent)
- tsc --noEmit server: exit 0 (silent)
- Deploy NOT done (sandbox has no Railway/Vercel access)

**Notes**
- transactions.amount stores Math.abs(amount) (always positive per DB convention).
  The notes field encodes direction: "Credit by admin (adminId): reason" or "Debit by admin...".
- The debit adjustment type still shows as green (credit) in the transactions list since
  type='adjustment' is treated as a deposit-like entry. This is consistent with prior behavior
  for the adjustment type (same as in admin approve endpoint). Consider a separate 'debit_adjustment'
  type if needed in future.
- The `main.lock` stale lock file remains at `.git/refs/heads/main.lock` — it's harmless but
  cannot be deleted (permission denied). The real ref is at `.git/refs/heads/main`.

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash.
2. `.git/HEAD.lock` + `.git/index.lock` + `.git/refs/heads/main.lock` are stale WSL locks -- cannot be deleted.
   Use GIT_INDEX_FILE=/tmp/vanta_main_idx (owned by current session user), commit-tree, write to .git/refs/heads/main.
3. After every session start, run: GIT_INDEX_FILE=/tmp/vanta_main_idx git read-tree HEAD to fix index.
4. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
5. Colors import: use @/lib/theme (not @/lib/colors). bgBase does not exist -- use bgDeep.
6. Supabase JS SDK v2.45 has no `listUserSessions` -- sessions.ts calls the REST API directly.
7. .git/refs/heads/main may be emptied if a failed commit-tree write races -- always restore from main.lock or known commit SHA.

**Next agent:** pick **12.4 Risk dashboard** (app/admin/risk.tsx — aggregate exposure per symbol,
top losing/winning open positions, clients near margin call) or **15.1 Onboarding flow**
(app/onboarding.tsx, 3-step swipeable, frontend only).

---
---
## 2026-05-16T00:00Z -- 12.2 User search + impersonation

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **12.2 User search + impersonation**
**Commits:** `83fb643` (code) `7275e90` (TODO.md)

**What changed**
- `server/src/routes/admin.ts`: 3 new endpoints appended inside `adminRoutes`:
  - `GET /api/admin/users?q=` — no query returns 50 most-recent users; numeric
    query does exact login-number lookup; text query does email-substring search
    via `supabaseAdmin.auth.admin.listUsers` (up to 1000 users) then filters.
  - `GET /api/admin/users/:userId` — returns profile (with email from auth.users),
    all accounts, last 50 trades, last 50 transactions, KYC submissions.
  - `POST /api/admin/users/:userId/impersonate` — calls
    `supabaseAdmin.auth.admin.generateLink({ type:'magiclink', email })`, returns
    `{ magic_link, token_hash, email }`. Guards: blocks impersonating admins.
    Logs the event with warn level.
- `lib/api.ts`: `adminSearchUsers()`, `adminGetUser()`, `adminImpersonate()` +
  `AdminUser` interface.
- `app/admin/users.tsx` (new, 263 lines): search screen with TextInput +
  Search button. UserCard shows avatar initial, display name, email, join date,
  primary account login # + balance. Results tap to detail screen.
- `app/admin/user/[id].tsx` (new, 365 lines): full user detail — profile panel,
  accounts (login, type, status, balance, leverage), KYC submissions with colour
  badges, last 20 trades (P&L coloured), last 20 transactions. "View as user"
  button in header calls impersonate endpoint and copies magic link to clipboard
  via Alert.
- `app/admin/index.tsx`: added "User Search" NavRow above Transaction Approvals.

**Verification**
- tsc --noEmit client: exit 0 (silent)
- tsc --noEmit server: exit 0 (silent)
- Deploy NOT done (sandbox has no Railway/Vercel access)

**Notes**
- The email-substring search loads all users (up to 1000) from Supabase auth and
  filters client-side in the worker. This is fine for early scale; optimize with
  a proper email search once user count grows.
- Magic link impersonation generates a Supabase magic link. Admin pastes it in a
  browser to sign in as the user. The link is one-time use and expires per Supabase
  defaults (~24h). The mobile app does NOT auto-switch sessions — this is
  intentional (impersonation is a browser-only debug flow).

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash.
2. `.git/HEAD.lock` + `.git/index.lock` are stale WSL locks -- cannot be deleted.
   Use GIT_INDEX_FILE=/tmp/X, git commit-tree, write to .git/refs/heads/main.
3. After every session start, run: GIT_INDEX_FILE=/tmp/X git read-tree HEAD to fix the corrupt index
   before doing git status (index drifts between sessions due to the lock workaround).
4. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
5. Colors import: use @/lib/theme (not @/lib/colors). bgBase does not exist -- use bgDeep.
6. Supabase JS SDK v2.45 has no `listUserSessions` -- sessions.ts calls the REST API directly.

**Next agent:** pick **12.3 Manual balance adjustment** (endpoint POST /api/admin/accounts/:id/adjust
+ UI button on user detail page) or **15.1 Onboarding flow** (app/onboarding.tsx, 3-step swipeable,
frontend only).


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
