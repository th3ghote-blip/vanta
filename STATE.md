# STATE -- handoff notes for the next agent

## 2026-05-22T11:33Z -- T.9 Hedging mode

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **T.9 Hedging mode**
**Commit:** `e6f57fa`

**Pre-run check**
Stale WSL HEAD.lock as usual. `git read-tree HEAD` confirmed disk==HEAD except:
- `server/src/routes/bars.ts` — pre-corrupted with partial T.21 work (truncated
  mid-word). Restored from HEAD.
- `components/pro/Chart.tsx` — same: partial T.21 additions but truncated. Restored.
Both restorations done via Python before any T.9 work started.
Client tsc: exit 0. Server tsc: exit 0. Tests: 68 passed before starting.

**What changed**
- `supabase/migrations/022_hedging_mode.sql` (new): adds
  `hedging_enabled boolean not null default false` to accounts. **NOT applied
  to live DB** — apply before backend deploy:
  `SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/022_hedging_mode.sql`
- `server/src/routes/orders.ts`: netting block runs after margin reservation
  for market orders when `hedging_enabled=false`. Queries for an open opposing
  position on (account, symbol, opposite-side). On match: full or partial close
  of the opposing trade (updates status + close_time + profit + reason='netting',
  or reduces volume for partial). Calls `apply_trade_pnl` and `releaseMargin`
  for the closed slice. Returns `{ netted: true, closedTradeId, ... }` when the
  incoming trade is fully absorbed; reduces `body.volume` and continues to insert
  a remainder trade otherwise.
- `server/src/routes/account.ts`: new `PATCH /api/account/hedging` endpoint.
  Body: `{ accountId: string, enabled: boolean }`. Verifies ownership, updates
  `accounts.hedging_enabled`.
- `server/test/helpers/supabaseMock.ts`: `hedging_enabled?: boolean` on
  `DbAccount`; seed default = false.
- `server/test/orders.test.ts`: +3 T.9 tests covering hedging-ON coexistence,
  netting full-close, and netting partial-volume-reduce. 71 tests pass.
- `stores/account.ts`: `hedging_enabled: boolean` on the `Account` interface.
- `lib/api.ts`: `setHedgingEnabled(accountId, enabled)` exported helper.
- `app/(tabs)/profile.tsx`: Switch toggle inside Trading Mode card. Shows
  descriptive label (ON/OFF state). Calls `setHedgingEnabled` then `fetchAccount`.
- `TODO.md`: T.9 marked [x].

**Verification**
- `npx --no-install tsc --noEmit` (client) -> exit 0 ✅
- `cd server && npx --no-install tsc --noEmit` (server) -> exit 0 ✅
- `npm run --prefix server test` -> **71 passed (was 68, +3) in 2.32s** ✅
- Frontend deploy: sandbox has no Vercel access — deploy manually or wait for CI.
- Backend deploy: sandbox has no Railway access — apply migration 022 first, then deploy.

**Notes for next agent**
- **Apply migration 022 before backend deploy.** Single `ALTER TABLE accounts ADD
  COLUMN` — no existing data affected.
- **Pre-existing truncated files at run start:** bars.ts and Chart.tsx both had
  partial T.21 (chart history pan) work that was corrupted mid-word. Restored both
  from HEAD. If they appear corrupted again, restore from HEAD before proceeding.
  T.21 is not yet started — these appear to be Edit-tool corruption artifacts.
- Same WSL HEAD.lock / index.lock pattern — use GIT_INDEX_FILE + plumbing to commit.
- T.9 done. Next safe picks:
  1. **T.10 Multiple accounts per user** — `accounts.is_primary boolean`. Account
     switcher UI in header. Migration 023. Mostly UI work.
  2. **T.14 Trade journal** — `trades.notes text` migration + notes textarea in
     TradeBook drawer. Low risk, pure addition. Migration 023.
  3. **T.15 Technical indicators** — chart overlay toggles (RSI, MACD, MA20, MA50,
     Bollinger). Pure frontend, no migration.

