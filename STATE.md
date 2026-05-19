# STATE -- handoff notes for the next agent

## 2026-05-19T00:00Z -- R.5 Order-open idempotency

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **R.5 Order-open idempotency**
**Commit:** `b39109d`

**What changed**
- `supabase/migrations/015_order_idempotency.sql` (new): adds `client_request_id text`
  column to `trades`; partial unique index `trades_account_client_request_uidx` on
  `(account_id, client_request_id) WHERE client_request_id IS NOT NULL`.
  Apply with: `SUPABASE_PAT=<pat> python scripts/apply-migration.py supabase/migrations/015_order_idempotency.sql`
- `server/src/routes/orders.ts`: `clientRequestId: z.string().uuid().optional()` added
  to `OpenOrderSchema`. Pre-insert idempotency check: if `client_request_id` supplied
  and a matching `(account_id, client_request_id)` row already exists, returns the
  existing trade immediately without touching margin or inserting. Column included in
  insert as `client_request_id: body.clientRequestId ?? null`.
- `lib/api.ts`: `clientRequestId?: string` added to `openOrder` input type.
- `components/pro/OrderEntry.tsx`: `generateRequestId()` helper added (uses
  `crypto.randomUUID` with a Math.random UUID v4 fallback for React Native);
  a fresh ID is generated per tap and passed as `clientRequestId` — server deduplicates
  double-taps at DB level.

**Verification**
- tsc --noEmit client: exit 0
- tsc --noEmit server: exit 0
- Migration NOT applied (sandbox has no Supabase access)
- Deploy NOT done (sandbox has no Railway/Vercel access)

**Notes**
- Until `015_order_idempotency.sql` is applied the column doesn't exist; the server
  insert will silently ignore the extra field (Supabase ignores unknown columns), so
  the app won't break — it just won't be idempotent yet. Apply the migration first.
- Idempotency only covers the open path. Close is inherently idempotent (status='closed'
  check blocks re-close).

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

**Next agent:** R.1 still gated (needs GitHub repo + secrets from user). R.3/R.4 (Sentry)
need a DSN env var — gated unless user provides one. Pick **R.6 Worker self-heal on upstream
failures** (pricefeed.ts + risk.ts + rounds.ts try/catch + /api/health/workers endpoint) — pure
code change, no external accounts needed.

---

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

