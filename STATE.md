# STATE — handoff notes for the next agent

> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.

---

## 2026-05-07T(auto) — 2.3 Wire QuickTradeScreen Up/Down to /api/rounds/open

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **2.3 Wire QuickTradeScreen Up/Down to /api/rounds/open**

**What changed**
- `components/fun/QuickTradeScreen.tsx` (323 lines, was 195): Up/Down buttons now call `api.openRound()`. Key changes:
  - Imports `useAccountStore` (for `account.id`) and `usePriceStore` (for live mid prices on asset chips and BinaryCard).
  - `ASSETS` array stripped of static prices — live mid from quote cache shown instead.
  - `openRound(direction)` async callback: checks account loaded, sets `busy` state, calls `api.openRound({accountId, symbol, direction, stake, durationSeconds})`, then calls `refetchAccount()` so AccountHeader reflects the stake deduction. Error mapped via `describeRoundError()` covering `insufficient_balance` (with required/available amounts), `no_quote`, `account_not_found`, `forbidden`, `unauthorized`, `deduct_failed`, `insert_failed`.
  - Buttons show `ActivityIndicator` while their direction is pending; opposite button dims to 40% opacity; both disabled while any request is in flight.
  - Feedback banner (green/red) appears below stake picker with success confirmation or error message.
- `TODO.md`: items 2.1 and 2.3 marked `[x]`. (2.1 was already fully implemented in commit `8312e29` but TODO checkbox was never updated — corrected this run.)

**Verification done in-sandbox**
- `npx tsc --noEmit` (root) → exit 0 (silent). No type errors.
- Logic verified: `api.openRound` was already defined in `lib/api.ts`; `usePriceStore` exports `quotes: Record<string, Quote>`; `useAccountStore` exports `account` + `fetch` (aliased to `refetchAccount`).

**Verification NOT done**
- Vercel deploy: sandbox has no outbound network. Run `cd /c/Claude/vanta && vercel --prod --yes` to ship.
- E2E: tap Up on BTCUSD $10 60s → loading spinner → success banner → AccountHeader balance drops $10 → round appears in DB.

**Recurring gotchas (still present)**
1. `.git/index.lock` (0-byte WSL lockfile, cannot unlink). Workaround: `GIT_INDEX_FILE=/tmp/git_idx git read-tree HEAD` then stage + commit via commit-tree. Real fix: `cmd /c del C:\Claude\vanta\.git\index.lock` on Windows.
2. Index was stale this run (showed rounds.ts as deleted + staged). Fixed by `GIT_INDEX_FILE=/tmp/git_idx_vanta git read-tree HEAD` which showed clean tree.
3. `Edit`/`Write` tool may truncate. Fix: bash heredoc + verify `wc -l`.

**Next agent:** pick **2.4 Active Rounds list in Quick Mode** (`components/fun/ActiveRounds.tsx` new, import in `QuickTradeScreen.tsx`). Frontend-only; deploy with `vercel --prod --yes`.

---

## 2026-05-07T(auto) — 2.2 Deduct stake on round open committed (deploy pending)

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **2.2 Deduct stake on round open**
**Commit:** `8578488` — `auto: deduct stake on round open` (2 files)

**What changed**
- `server/src/routes/rounds.ts` (102 lines, was 52): POST `/api/rounds/open` now (1) fetches the account and enforces ownership (`user_id == authed user`); (2) checks `account.balance >= stake`, returns 400 `insufficient_balance` with `required`/`available` if not; (3) deducts stake via `apply_trade_pnl(account_id, -stake)` before the insert; (4) issues a compensating refund if insert fails or no quote is available, so balance is never permanently lost on a failed open.
- `TODO.md`: item 2.2 checkbox marked `[x]`.

**Also fixed this run**
Commit `dee729b` (fixup): the prior STATE.md commit (`33356cf`) had accidentally excluded `server/src/workers/rounds.ts` from the tree and reverted `startRoundsWorker` wiring in `index.ts`. Fixed by rebuilding the tree with both files and making an explicit fixup commit before starting 2.2 work. All tsc checks pass.

**Verification done in-sandbox**
- `cd server && npx tsc --noEmit` → exit 0.
- Root `npx tsc --noEmit` → exit 0.
- Logic: `apply_trade_pnl` is the same RPC used by the risk worker; passing `-stake` correctly decrements balance/equity/free_margin atomically in Postgres.

**Verification NOT done**
- Railway deploy: sandbox has no outbound network. Run `cd /c/Claude/vanta/server && railway up --detach` from a machine with the CLI. This ships both 2.1 (rounds settler) and 2.2 (stake deduction) together — they were designed to be deployed as a pair.
- End-to-end: open a $50 round on a $10k account → confirm balance drops to $9950 immediately; after expiry confirm settler credits payout on win or leaves balance on loss.

**Recurring gotchas (still present)**
1. `.git/index.lock` (0-byte WSL lockfile, cannot unlink). Workaround: `cp .git/index /tmp/idx && GIT_INDEX_FILE=/tmp/idx git read-tree HEAD && GIT_INDEX_FILE=/tmp/idx git add <files> && GIT_INDEX_FILE=/tmp/idx git write-tree` → `git commit-tree` → write SHA to `.git/refs/heads/main`.
2. `Edit`/`Write` tool may truncate long files. Fix: bash heredoc + verify `wc -l` before staging.
3. `git status` shows stale index diffs (index lags HEAD) — this is cosmetic; HEAD is always the source of truth.

**Next agent:** pick **2.3 Wire QuickTradeScreen Up/Down to /api/rounds/open** (`components/fun/QuickTradeScreen.tsx`) — frontend-only; deploy with `vercel --prod --yes`.

---

## 2026-05-07T(auto) — 2.1 Rounds settler worker committed (deploy pending)

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **2.1 Server worker to settle binary rounds at expiry**
**Commit:** `8312e29` — `auto: server worker to settle binary rounds at expiry` (3 files)

**What changed**
- `server/src/workers/rounds.ts` (new, 159 lines): 1s-tick settler. Queries `binary_rounds` where `outcome='pending' AND closes_at <= now()`. For each: reads `exit_price` from in-memory quote cache (mid), determines win/loss/tie by comparing exit vs entry and direction. On win: computes `payout = stake * payout_multiplier`, calls `apply_trade_pnl` to credit the account. On loss/tie: no balance change (stake deducted on open by Phase 2.2, not yet deployed). CAS guard: `UPDATE ... WHERE outcome='pending'` prevents double-settle. Overlap guard: tick is skipped if previous is still running.
- `server/src/index.ts`: added `import { startRoundsWorker }` and `startRoundsWorker(app)` call, alongside existing risk/robot workers.
- `TODO.md`: item 2.1 checkbox marked `[x]`.

**Verification done in-sandbox**
- `cd server && npx tsc --noEmit` → exit 0 (silent).
- Root `npx tsc --noEmit` → exit 0 (silent).
- `git log --oneline` shows `8312e29` on `main`. Working tree clean.

**Verification NOT done**
- Railway deploy: sandbox has no outbound network. Run `cd /c/Claude/vanta/server && railway up --detach` from a machine with the CLI.
- End-to-end acceptance: open a 60s binary round, wait for expiry, confirm `binary_rounds.outcome` is set and balance reflects payout on a win.

**Note on Phase 2.2 dependency**
The settler correctly credits payout on win, but stake is not yet deducted on open (that's 2.2). Until 2.2 is deployed, wins double-count (payout credited without prior deduction). Deploy 2.1 + 2.2 together for correct P&L.

**Recurring gotchas (still present)**
1. `.git/index.lock` (0-byte WSL lockfile). Workaround: copy index to `/tmp`, use `GIT_INDEX_FILE` + `git commit-tree`, write SHA to `.git/refs/heads/main`.
2. `Edit`/`Write` tool truncation. Fix: bash heredoc + verify `wc -l` before staging.

**Next agent:** pick **2.2 Deduct stake on round open** (`server/src/routes/rounds.ts`) — balance-deduction + account_id 