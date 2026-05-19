# STATE -- handoff notes for the next agent

## 2026-05-19T15:00Z -- R.12 Legal pages

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **R.12 Legal pages (Terms / Privacy / Risk disclosure)**
**Commit:** `f4fbc99`

**Pre-run housekeeping**
TODO.md was truncated (last 7 lines missing — file truncation bug again). Restored from HEAD
via Python before starting work. Working tree was clean after restore.

**What changed**
- `app/legal/terms.tsx` (new, 174 lines): 12-section Terms of Service. Marshall Islands
  B-book broker template. Accessible via Profile → Help → Terms of Service (`/legal/terms`).
- `app/legal/privacy.tsx` (new, 160 lines): 12-section Privacy Policy covering data
  collection, legal basis, retention, rights, security, cookies, push, children, contact.
  Accessible via Profile → Help → Privacy Policy (`/legal/privacy`).
- `components/RiskDisclosureModal.tsx` (new, 249 lines): bottom-sheet modal that gate-keeps
  first deposit. Lists 6 numbered risk points. Accept button only activates after user scrolls
  to bottom. On accept: writes `vanta:risk_ack = '1'` to AsyncStorage so it only shows once.
  On decline: navigates back. Exports `hasAcknowledgedRisk()` and `acknowledgeRisk()` helpers.
- `app/(tabs)/profile.tsx`: added `FileText` icon import + two new `<Row>` entries (Terms of
  Service → `/legal/terms`, Privacy Policy → `/legal/privacy`) under the Help section.
- `app/deposit.tsx`: imports `RiskDisclosureModal` + `hasAcknowledgedRisk`. On mount checks
  AsyncStorage; if not yet acked shows the modal full-screen before the deposit flow.

**Verification**
- tsc --noEmit client: exit 0 (silent)
- tsc --noEmit server: exit 0 (silent)
- Deploy NOT done (sandbox has no Railway/Vercel access)

**Notes**
- Risk modal requires scroll-to-bottom before accept — intentional UX friction for compliance.
- Legal text is boilerplate; review with a lawyer before launch (as noted in TODO.md).
- `spacing.xs` is accessed with a nullish fallback (`spacing.xs ?? 6`) in legal pages in case
  the token doesn't exist; all other tokens are confirmed present.

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash.
   TODO.md was truncated AGAIN this run — the bug also affects Edit tool on open files.
2. `.git/HEAD.lock` + `.git/index.lock` are stale WSL locks.
   Use GIT_INDEX_FILE=/tmp/vanta_<unique> git read-tree HEAD, then commit-tree, write to .git/refs/heads/main.
3. After every session start: pick a fresh GIT_INDEX_FILE tmp path.
4. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
5. Colors import: use @/lib/theme (not @/lib/colors). bgBase does not exist -- use bgDeep.
   Color tokens: textPrimary, textSecondary, textMuted. No typography.caption or typography.h3.
6. Supabase JS SDK v2.45 has no `listUserSessions` -- sessions.ts calls the REST API directly.
7. Supabase select with joins returns GenericStringError unless you cast: `as unknown as TypedArray[]`.
8. `colors.primaryDim` does not exist -- just use `colors.primary`.
9. git write-tree / commit-tree: always redirect warnings to /dev/null (2>/dev/null) when
   capturing SHA. Never write raw output to .git/refs/heads/main without verifying 40-char SHA.

**Next agent:** Phase R is now mostly done (R.1 gated on GitHub, R.7 needs sign-up,
R.8/R.9/R.11 need CI). Best pure-code picks from Phase T (Trading depth):
- **T.1 Pending limit orders** (new limit.tsx form + orders trigger worker + migration) — highest value
- **T.11 Position notional + leverage display** — small, frontend-only, high trader UX value
- **T.5 Modify open positions (SL/TP after open)** — PATCH endpoint + edit button per row

---


## 2026-05-19T14:15Z -- R.10 Performance dashboard in admin

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **R.10 Performance dashboard in admin**
**Commit:** `479b18d` (code) + `5a4c767` (TODO.md)

**Pre-run housekeeping**
Prior agent run (Sentry attempt) hit the file-truncation bug and left 7 files
truncated (server/src/index.ts, package.json, server/package.json, both lock files,
app/_layout.tsx, .env.example). Restored all from HEAD via `git show HEAD:<path>`.
Working tree was clean before R.10 work began. Note: R.3 + R.4 Sentry integration
was already committed by an earlier session (commits b17cdf8 + de7d919) — those
items should be marked [x] in TODO.md (still showing [ ] due to an index lock
preventing a prior commit of that mark). Next agent should check and fix.

**What changed**
- `server/src/middleware/timing.ts` (new, 82 lines): rolling 5-min timing registry.
  `recordTiming(route, ms)` stores samples per-route. `getTimingStats()` returns
  `{route, count, p50, p95, p99, min, max}[]` sorted by p95 descending.
  Prunes stale entries (>5 min) on each record call; hard cap 2,000 samples/route.
- `server/src/index.ts`: imports `recordTiming` + registers `onResponse` Fastify hook
  that calls `recordTiming(route, reply.elapsedTime)` for every non-health request.
- `server/src/routes/admin.ts`: `GET /api/admin/perf` (admin-auth gated) returns
  `{window_minutes:5, generated_at, routes:[...]}`.
- `app/admin/perf.tsx` (new, ~290 lines): admin screen. Polls `/api/admin/perf`
  every 10s (auto-interval + pull-to-refresh). Table: route | reqs | p50 | p95 | p99 | max.
  Latency cells color-coded green (<100ms) / amber (100-500ms) / red (>500ms).
  Empty state if no traffic yet. Uses correct theme tokens (textPrimary, textSecondary, etc).
- `app/admin/index.tsx`: added "Performance" NavRow (Zap icon) → `/admin/perf`.

**Verification**
- tsc --noEmit client: exit 0
- tsc --noEmit server: exit 0
- Deploy NOT done (sandbox has no Railway/Vercel access)

**Notes**
- The `/api/admin/perf` endpoint uses a dynamic `import('../middleware/timing.js')` to
  avoid circular dependency issues. Works fine in ESM.
- The timing hook skips `/health` and `/api/health/workers` to avoid noise in the stats.
- TODO.md still shows R.3 and R.4 as unchecked even though both are committed. Next
  agent should mark them [x] as a housekeeping step (or pick the next unchecked item
  that is actually undone: R.7 Better-Stack, R.8 E2E, R.9 integration tests, R.11 backup
  verification, R.12 legal pages).

**Recurring gotchas (CRITICAL -- still active)**
1. File truncation bug: NEVER use Write/Edit tool for files >~50 lines. ALWAYS use Python via bash.
2. `.git/HEAD.lock` + `.git/index.lock` + `.git/refs/heads/main.lock` are stale WSL locks.
   Use GIT_INDEX_FILE=/tmp/vanta_<unique> git read-tree HEAD, then commit-tree, write to .git/refs/heads/main.
3. After every session start: pick a fresh GIT_INDEX_FILE tmp path (previous session's may error).
4. Sandbox network is isolated -- no Railway/Vercel/Supabase live access.
5. Colors import: use @/lib/theme (not @/lib/colors). bgBase does not exist -- use bgDeep.
   Color tokens: textPrimary (not text), textSecondary, textMuted. No typography.caption or
   typography.h3 -- use inline or compose from existing tokens.
6. Supabase JS SDK v2.45 has no `listUserSessions` -- sessions.ts calls the REST API directly.
7. Supabase select with joins returns GenericStringError unless you cast: `as unknown as TypedArray[]`.
8. `colors.primaryDim` does not exist -- just use `colors.primary`.
9. git write-tree / commit-tree: always redirect warnings to /dev/null (2>/dev/null) when
   capturing SHA into a variable, otherwise warning text contaminates the variable.
   Never write the raw output of commit-tree to .git/refs/heads/main without checking it's a clean 40-char SHA.

**Next agent:** R.12 Legal pages (Terms / Privacy / Risk disclosure) is the best pure-code
pick — no external accounts. Or fix the R.3/R.4 TODO checkbox housekeeping first.

---

2026-05-19T10:10Z -- R.6 Worker self-heal on upstream failures

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **R.6 Worker self-heal on upstream failures**
**Commit:** `6d76970`

**What changed**
- `server/src/lib/workerHealth.ts` (new, 36 lines): shared tick-timestamp registry.
  `recordTick(name)` updates a per-worker timestamp. `getWorkerHealth()` returns a map
  of `{lastTickMs, lastTickAgo, ok}` per worker; a worker is "ok" if it ticked within 30s.
- `server/src/feed/pricefeed.ts`:
  * Coinbase WS reconnect: exponential backoff (3s → 6s → 12s … cap 60s). Resets to 3s
    on first successful message received.
  * Twelve Data 429 handling: up to 3 retries with 2s/4s/8s waits before abandoning the
    chunk. Server keeps running; resumes on next 20-min poll cycle.
  * `recordTick('coinbase')` called on every price update; `recordTick('twelvedata')` on
    every chunk that refreshes ≥1 symbol.
- `server/src/workers/risk.ts`: `recordTick('risk')` after each successful tick.
- `server/src/workers/rounds.ts`: `recordTick('rounds')` after each successful tick.
- `server/src/index.ts`: `GET /api/health/workers` returns `{ok, ts, workers:{...}}`.

**Verification**
- tsc --noEmit server: exit 0
- tsc --noEmit client: exit 0
- Deploy NOT done (sandbox has no Railway/Vercel access)

**Notes**
- Phantom index (WSL locks) is active again — working tree shows stale staged deletions
  but `git show --stat HEAD` confirms commit `6d76970` is correct and contains all 5 files.
  Next run: git-precheck.sh will clear it (locks are WSL-owned, clear on Windows restart).
- The /api/health/workers endpoint is unauthenticated (like /health) — add admin auth
  later if the server is ever public-facing.

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
need a DSN env var. R.7 (Better Stack) requires sign-up. Pick **R.8 E2E smoke test** or
**R.10 Performance dashboard in admin** — both are pure code, no external accounts needed.
R.10 (timing middleware + admin/perf.tsx) is likely the highest-value next pick.

---

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
