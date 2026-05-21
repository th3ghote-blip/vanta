# STATE -- handoff notes for the next agent

## 2026-05-22T22:12Z -- T.12 Symbol watchlist

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **T.12 Symbol watchlist / favourites**
**Commit:** `7d9acbc`

**Pre-run check**
Stale WSL locks present as usual (.git/HEAD.lock, .git/index.lock -- cannot remove,
WSL mount restriction). Used GIT_INDEX_FILE=/tmp/vanta_idx_6 + git plumbing
(write-tree / commit-tree / direct ref write) to commit, same pattern as prior runs.
Client tsc: exit 0. Server tsc: exit 0. Tests: 68 passed (unchanged) before starting.

**What changed**
- `supabase/migrations/021_user_watchlist.sql` (new): creates `user_watchlist`
  table with (user_id uuid, symbol text), unique index on (user_id, symbol),
  listing index on (user_id, created_at desc), and RLS select/insert/delete
  policies. **NOT applied to live DB** -- apply before backend deploy:
  `SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/021_user_watchlist.sql`
- `server/src/routes/watchlist.ts` (new): three endpoints:
    GET  /api/watchlist          -> { symbols: string[] } ordered by created_at
    POST /api/watchlist          -> { ok, symbol } -- upsert with ignoreDuplicates
    DELETE /api/watchlist/:symbol -> { ok, symbol }
- `server/src/index.ts`: import + register `watchlistRoutes` at `/api/watchlist`.
- `lib/api.ts`: three exported helpers appended at bottom -- `getWatchlist()`,
  `addToWatchlist(symbol)`, `removeFromWatchlist(symbol)`.
- `stores/watchlist.ts` (new): Zustand store with `starred: Set<string>`,
  `fetch()` (hydrates from server), `toggle(symbol)` (optimistic + rollback),
  `isStarred(symbol)`.
- `components/pro/SymbolPickerModal.tsx`: 
    * New 'Watchlist' tab added as the FIRST tab (before 'All'); shows `starred.size` count.
    * `useEffect` calls `fetchWatchlist()` whenever the modal opens (`visible` changes).
    * Star icon (lucide `Star`) on the left of every symbol row -- amber + filled when
      starred, muted outline when not. Tap calls `toggleStar(s.ticker)` with
      `e.stopPropagation()` so it doesn't also select the symbol.
    * Watchlist tab filtered pool shows only starred symbols.
    * Empty state for Watchlist tab (when nothing starred and no search active)
      shows a large Star icon + guidance text.
- `TODO.md`: T.12 marked [x].

**Verification**
- `npx --no-install tsc --noEmit` (client) -> exit 0 OK
- `cd server && npx --no-install tsc --noEmit` (server) -> exit 0 OK
- `npm run --prefix server test` -> **68 passed (unchanged) in 2.23s** OK
- Frontend deploy: sandbox has no Vercel access -- deploy manually or wait for CI.
- Backend deploy: sandbox has no Railway access -- apply migration 021 first, then deploy.

**Notes for next agent**
- **Apply migration 021 before backend deploy.** New table + indexes + RLS only;
  no existing tables or columns changed.
- Same WSL HEAD.lock / index.lock pattern as prior runs -- use GIT_INDEX_FILE +
  plumbing to commit. Write ref directly via Python.
- T.12 done. Next safe picks:
  1. **T.9 Hedging mode** -- `accounts.hedging_enabled boolean` + UI toggle in Profile.
     Migration 022. Touches order open path (bypass netting when hedging=true).
  2. **T.10 Multiple accounts per user** -- `accounts.is_primary boolean`. Account
     switcher UI in header. Migration 022. Mostly UI work.
  3. **T.14 Trade journal** -- `trades.notes text` migration + notes textarea in TradeBook
     drawer. Low risk, pure addition.

---

## 2026-05-21T18:15Z -- T.8 OCO orders

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **T.8 OCO orders (one-cancels-other)**
**Commit:** _pending in this run_

**Pre-run check**
Stale WSL index present + a real local diff: TODO.md on disk was truncated mid-section
("# Phase " with no closing content, 715 lines vs HEAD's 767). Pattern matches the
known Edit-tool / multi-byte corruption the prior runs flagged. NOT a user mid-edit
(no other files touched, no plausible intent for that ending). Restored TODO.md from
HEAD via `git show HEAD:TODO.md` written through Python. Branch=main. Client tsc: exit 0.
Server tsc: exit 0. Tests: 64 passed before starting.

**What changed**
- `supabase/migrations/020_oco_groups.sql` (new): adds nullable `trades.oco_group_id uuid`
  + partial index on `(oco_group_id) WHERE oco_group_id IS NOT NULL AND status='pending'`
  for fast sibling lookup. **NOT applied to live DB** -- apply before backend deploy:
  `SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/020_oco_groups.sql`
- `server/src/routes/orders.ts`: `OpenOrderSchema` gains optional `ocoGroupId: z.string().uuid()`.
  Rejects 400 invalid_input if combined with a market order (OCO only makes sense for pending
  legs since the worker is what cancels siblings). Stored on insert as `oco_group_id` (null
  for market, null when omitted for pending).
- `server/src/workers/ordersTrigger.ts`: imports `releaseMargin` / `requiredMargin`. Adds
  `oco_group_id` to the SELECT, PendingOrder interface, and per-row mapping. New
  `cancelOcoSiblings(app, ocoGroupId, filledId)` helper runs after every successful fill:
  selects pending siblings in the same group, CAS-updates them to status='cancelled'
  + close_time, then calls `releaseMargin()` with the margin reserved at submit time
  (volume * trigger_price * contractSize / leverage). Exposes `_ordersTriggerInternals`
  so tests can drive `tick` directly.
- `lib/api.ts`: `openOrder` input gains `ocoGroupId?: string`.
- `components/pro/OrderEntry.tsx`: when orderKind === 'limit', new "Pair as OCO" checkbox
  reveals an "OCO stop trigger price" input. On submit: mints a fresh uuid, posts the
  primary limit with `ocoGroupId`, then posts a sibling `stop` (same symbol/side/volume)
  with the same ocoGroupId. Client-side direction check on the sibling matches the server.
- `components/pro/TradeBook.tsx`: Trade interface gains `oco_group_id?`. Pending rows
  show " OCO" in the metadata line when set.
- `server/test/helpers/supabaseMock.ts`:
    * DbTrade gains `oco_group_id?: string | null`.
    * `seed.trade()` now passes through `order_type / trigger_price / limit_price /
      trail_distance / trail_high_water / oco_group_id` (silently dropping these
      was masking bugs in any worker-driven test).
    * Query gains `.in(col, vals)` -- needed for the ordersTrigger worker's
      `.in('order_type', [...])` filter so worker tests can run against the mock.
- `server/test/orders.test.ts`: +4 T.8 tests:
    1. pending buy-limit with ocoGroupId stores it on the row,
    2. market + ocoGroupId rejected 400 invalid_input,
    3. malformed (non-uuid) ocoGroupId rejected 400 invalid_input,
    4. driven `tick()` -- two pending legs sharing a group, quote moves so leg A fills,
       leg B flips to 'cancelled' and account.margin_used drops by leg B's reserve (105).
- `TODO.md`: T.8 marked [x].

**Verification**
- `npx --no-install tsc --noEmit` (client) -> exit 0 OK
- `cd server && npx --no-install tsc --noEmit` (server) -> exit 0 OK
- `npm run --prefix server test` -> **68 passed (was 64, +4) in 1.71s** OK
- Frontend deploy: sandbox has no Vercel access -- deploy manually or wait for CI.
- Backend deploy: sandbox has no Railway access -- apply migration 020 first, then deploy.

**Notes for next agent**
- **Apply migration 020 before backend deploy.** Single nullable column + partial index;
  existing rows unaffected.
- **Heads up: TODO.md on disk was corrupted at start of run.** Same multi-byte/Edit tool
  pattern earlier runs flagged. ALWAYS use Python to modify files. If you see a truncated
  TODO.md on disk with the workspace otherwise clean, restore from HEAD; do NOT bail out
  as if it were a user edit.
- Railway health unverifiable from sandbox (proxy blocks outbound).
- T.8 done. Next safe picks:
  1. **T.12 Symbol watchlist** -- new migration `user_watchlist(user_id, symbol)` (number 021)
     + star UI in symbol picker. No risk to existing trading core.
  2. **T.9 Hedging mode** -- `accounts.hedging_enabled boolean` + UI toggle + bypass of the
     netting logic on open. Migration 021. Slightly more delicate -- touches order open
     path.
  3. **T.10 Multiple accounts per user** -- `accounts.is_primary boolean`. UI surface
     (account switcher in header) is the bulk of the work.

---

## 2026-05-21T14:12Z -- T.7 Bracket orders

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **T.7 Bracket orders**
**Commit:** `82aef7d`

**Pre-run check**
Stale WSL index present (as usual). `git diff HEAD --stat` (fresh index) confirmed disk==HEAD.
Client tsc: exit 0. Server tsc: exit 0. Tests: 60 passed before starting.

**What changed**
- `server/src/routes/orders.ts`: T.7 bracket validation block inserted between the
  isPending order-type validation and the margin-reservation code. For market orders
  with stopLoss or takeProfit present: buy SL must be < ask (→ 400 invalid_sl), sell
  SL must be > bid (→ 400 invalid_sl), buy TP must be > ask (→ 400 invalid_tp), sell
  TP must be < bid (→ 400 invalid_tp). Pending orders skip this check (fill price not
  known at placement time). No migration needed — uses existing stop_loss/take_profit
  columns.
- `components/pro/OrderEntry.tsx`: T.7 client-side SL/TP pre-flight in submit() for
  market orders. Uses live quote to catch bad values before the network round-trip and
  surface a user-readable error. Added invalid_sl and invalid_tp cases to
  describeOrderError() so server-side rejections also render as friendly copy.
- `server/test/orders.test.ts`: +4 T.7 tests: valid buy bracket (SL+TP stored), buy
  SL above ask → 400 invalid_sl, buy TP below ask → 400 invalid_tp, sell SL below bid
  → 400 invalid_sl.
- `TODO.md`: T.7 marked [x].

**Verification**
- `npx --no-install tsc --noEmit` (client) → exit 0 ✅
- `cd server && npx --no-install tsc --noEmit` (server) → exit 0 ✅
- `npm run --prefix server test` → **64 passed (was 60, +4) in 2.30s** ✅
- Frontend deploy: sandbox has no Vercel access — deploy manually or wait for CI.
- Backend deploy: sandbox has no Railway access — no migration needed, deploy when accessible.

**Notes for next agent**
- No migration needed for T.7 — bracket SL/TP use existing columns.
- Railway health check passed at run start (curl returned ok:true).
- **Edit tool causes corruption on files with multi-byte chars.** ALWAYS use Python for all file modifications.
- T.7 done. Next safe picks:
  1. **T.8 OCO orders** — migration adds `trades.oco_group_id uuid`. Risk worker cancels
     the other leg when one fires. Next migration number: 020.
  2. **T.12 Symbol watchlist** — migration `user_watchlist(user_id, symbol)` + star UI in
     symbol picker. Next migration number: 020.
  3. **T.9 Hedging mode** — `accounts.hedging_enabled boolean` + UI toggle + netting logic
     in order open. Migration number: 020.

---


## 2026-05-21T13:07Z -- T.6 Partial close

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **T.6 Partial close**
**Commit:** `30a54b0`

**Pre-run check**
Stale WSL index present (as usual). `git diff HEAD --stat` confirmed disk==HEAD.
Client tsc: exit 0. Server tsc: exit 0. Tests: 57 passed before starting.

**What changed**
- `server/src/routes/orders.ts`: `CloseOrderSchema` gains optional `closeVolume`
  (positive number). In `/close` handler: if `closeVolume < trade.volume`, runs
  a partial-close path — inserts a child `trades` row (status='closed',
  reason='partial_close', volume=closeVolume, open_price/symbol/side/open_time
  inherited from parent), updates parent row volume to
  (trade.volume - closeVolume), releases proportional margin, applies partial
  P&L via `apply_trade_pnl` RPC, sends partial-close push notification.
  If closeVolume >= trade.volume (or omitted), falls through to the original
  full-close path unchanged.
- `lib/api.ts`: `closeOrder(tradeId, closeVolume?)` — passes closeVolume in
  body when provided.
- `components/pro/TradeBook.tsx`: added `Scissors` import from lucide. New
  partial-close state (partialCloseId, partialVolumeStr, partialClosing,
  partialError). New functions: startPartialClose, cancelPartialClose,
  submitPartialClose. TradeRow gains 8 new props for the partial-close UI.
  Action column width expands from 64 → 96px for open trades (to fit 3 buttons:
  Pencil / Scissors / X). A Scissors button appears on open rows; tapping it
  opens an inline sub-panel (same style as T.5 SL/TP edit panel) with a volume
  input pre-filled to trade.volume and a red "Close X lots" button.
- `server/test/orders.test.ts`: +3 T.6 tests: partial close inserts child row
  and reduces parent volume, vol>=full falls back to full close, zero
  closeVolume rejected with 400.

**Verification**
- `npx --no-install tsc --noEmit` (client) → exit 0 ✅
- `cd server && npx --no-install tsc --noEmit` (server) → exit 0 ✅
- `npm run --prefix server test` → **60 passed (was 57, +3) in 1.84s** ✅
- Frontend deploy: sandbox has no Vercel access — deploy manually or wait for CI.
- Backend deploy: sandbox has no Railway access — no migration needed (child
  trade row reuses existing schema), so can deploy when Railway is accessible.

**Notes for next agent**
- No migration needed for T.6 — partial close uses the existing trades schema.
  Child row has reason='partial_close' for easy filtering in history.
- Railway health unverifiable from sandbox (proxy blocks outbound).
- **Edit tool causes corruption on files with multi-byte chars.** ALWAYS use
  Python for all file modifications.
- T.6 done. Next safe picks:
  1. **T.7 Bracket orders** — entry + SL + TP placed atomically; SL/TP inputs
     already wired in OrderEntry so this is mostly a server-side atomic insert.
     No migration needed.
  2. **T.12 Symbol watchlist** — migration `user_watchlist(user_id, symbol)` +
     star UI in symbol picker. Next migration number: 020.
  3. **T.8 OCO orders** — migration adds `trades.oco_group_id uuid`. Risk worker
     cancels the other leg when one fires.

---


## 2026-05-21T22:12Z -- T.4 Trailing stops

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **T.4 Trailing stops**
**Commit:** `089bf58`

**Pre-run check**
Working tree had stale WSL index (MM on multiple files, D on 018_stop_limit.sql).
`git diff HEAD --stat` confirmed only the migration file was a real diff (identical content
on disk vs HEAD — stale index artefact). Used GIT_INDEX_FILE=/tmp/vanta_idx_t4 throughout.
Client tsc: exit 0. Server tsc: exit 0. Tests: 53 passed before starting.

**What changed**
- `supabase/migrations/019_trailing_stops.sql` (new): adds `trail_distance numeric(18,5)`
  and `trail_high_water numeric(18,5)` to trades. Nullable; existing rows unaffected.
  **NOT applied to live DB** — apply before backend deploy:
  `SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/019_trailing_stops.sql`
- `server/src/workers/risk.ts`: new `updateTrailingStop()` function. Called before the
  SL check for every open trade with trail_distance set. For buys: ratchets
  trail_high_water = max(prev_hw, mid), then stop_loss = hw - trail_distance (never lowers
  an existing SL). For sells: hw = min(prev_hw, mid), stop_loss = hw + trail_distance (never
  raises an existing SL). Uses CAS `.eq('status','open')` guard against race with close.
  Also added trail_distance/trail_high_water to the OpenTrade interface and SELECT query.
  Push notification title now says "trailing stop-loss hit" when trail_distance is set.
- `server/src/routes/orders.ts`: `trailDistance` added to `OpenOrderSchema` (positive,
  optional). Stored as `trail_distance` on insertRow for market orders only; set to null
  for all pending order types (limit/stop/stop_limit).
- `lib/api.ts`: `openOrder` input type gains `trailDistance?: number`.
- `components/pro/OrderEntry.tsx`: "Trail Distance (price units, optional)" field added
  below SL/TP in the market order UI. Passed to api.openOrder as trailDistance.
- `server/test/orders.test.ts`: +4 T.4 tests covering: buy market with trail stored,
  limit order ignores trail, omitting trail leaves column null, zero trail_distance rejected.
- `server/test/helpers/supabaseMock.ts`: DbTrade interface gains trail_distance and
  trail_high_water optional fields.

**Verification**
- `npx --no-install tsc --noEmit` (client) -> exit 0 (silent) OK
- `cd server && npx --no-install tsc --noEmit` (server) -> exit 0 (silent) OK
- `npm run --prefix server test` -> **57 passed (was 53, +4) in 1.94s** OK
- Frontend deploy: sandbox has no Vercel access -- deploy manually or wait for CI.
- Backend deploy: sandbox has no Railway access -- apply migration 019 first, then deploy.

**Notes for next agent**
- **Apply migration 019 before backend deploy.** Adds two nullable columns; no existing
  data is affected. trail_high_water is null until the risk worker ticks on an open trade.
- Railway health unverifiable from sandbox (proxy blocks outbound).
- **Edit tool causes corruption on files with multi-byte chars.** ALWAYS use Python for
  all file modifications.
- T.4 done. Next safe picks:
  1. **T.6 Partial close** -- extend `/close` to accept `closeVolume`, add slider in TradeBook.
     No migration needed (child trade row approach can reuse existing schema).
  2. **T.12 Symbol watchlist** -- migration `user_watchlist(user_id, symbol)` + star UI in picker.
  3. **T.7 Bracket orders** -- entry + SL + TP placed atomically; SL/TP inputs already wired in
     OrderEntry so this is mostly a server-side atomic insert.
