# STATE — handoff notes for the next agent

> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.

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

**Next agent:** pick **2.2 Deduct stake on round open** (`server/src/routes/rounds.ts`) — balance-deduction + account_id enforcement on insert. Backend-only; deploy with `railway up --detach`.

---

## 2026-05-07T00:00Z — 1.5 Account header strip committed (deploy pending)

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **1.5 Account header strip with live balance / equity / free margin**
**Commits:** `3f29fe6` (implementation) + `9471928` (TODO checkbox)

**What changed**
- `components/shared/AccountHeader.tsx` (new, 171 lines): horizontal strip showing `#<login>  |  Bal $X · Eq $Y · Free $Z`. Equity is recomputed on every quote tick: fetches open trades on mount, subscribes to Supabase realtime (`acct_hdr_<id>` channel) to refetch on any trade INSERT/UPDATE/DELETE, then `useMemo([account, openTrades, quotes])` to add unrealised P&L via `calculatePnL`. Equity text colour: green if above balance, red if below, muted if flat. Falls back to `account.id.slice(0,8)` if `account.login` is null (old rows before migration 003).
- `stores/account.ts`: added `login: number` to `Account` interface (matches `bigint` column from migration `003_login_numbers.sql`; the existing `select('*')` already fetches it).
- `app/(tabs)/_layout.tsx`: wrapped `<Tabs>` in `<View style={{flex:1}}>` and rendered `<AccountHeader />` above `<Tabs>` so the strip is persistent across all four tab screens.
- `TODO.md`: item 1.5 checkbox marked `[x]`.

**Verification done in-sandbox**
- `npx tsc --noEmit` (root) → exit 0 (silent).
- `cd server && npx tsc --noEmit` → exit 0 (silent).
- `git log --oneline` shows `9471928` on `main`. Working tree clean.

**Verification NOT done**
- Vercel deploy: sandbox has no outbound network (`EAI_AGAIN`). Run `cd /c/Claude/vanta && vercel --prod --yes` from a machine with access.
- Visual check: header renders above tabs, equity colour changes as BTC ticks, account number shows correctly (e.g. `#80000001`).

**Recurring gotchas (still present)**
1. `.git/index.lock` and `.git/HEAD.lock` are 0-byte stale WSL lockfiles; cannot `unlink`. Workaround: copy index to `/tmp`, use `GIT_INDEX_FILE` + `git commit-tree`, write SHA to `.git/refs/heads/main` directly. Real fix: `cmd /c del C:\Claude\vanta\.git\index.lock` from Windows.
2. `Edit`/`Write` tool truncation still observed. All files written via bash heredoc and verified with `wc -l` + `tail` before staging.

**Next agent:** pick **2.1 Server worker to settle binary rounds at expiry** (`server/src/workers/rounds.ts` new). Backend-only; needs `railway up --detach`. Alternatively skip to **8.2 Symbol categories in SymbolPicker** (pure frontend, Vercel-deployable) if human has already shipped 1.5 and wants frontend momentum.

---

## 2026-05-06T18:XX Z — 1.4 symbol-aware default volume committed (deploy pending)

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **1.4 Symbol-aware default volume in OrderEntry**
**Commit:** `4cd5a74` — `auto: symbol-aware default volume in OrderEntry` (3 files)

**What changed**
- `lib/contracts.ts`: added `defaultVolumeFor(symbol): string` — returns `'0.10'` for forex/gold/silver, `'1'` for stocks, `'0.01'` for crypto and anything unrecognised.
- `components/pro/OrderEntry.tsx`: imports `defaultVolumeFor`; volume state initialises from it; `useEffect([symbol])` resets the field to the new symbol's default unless `userEditedVolume.current` is true.
- `TODO.md`: item 1.4 checkbox marked `[x]`.

**Verification done in-sandbox**
- `npx tsc --noEmit` (root) → silent. `cd server && npx tsc --noEmit` → silent.
- `git log --oneline` shows `4cd5a74` on `main`. Working tree clean.

**Verification NOT done**
- Vercel deploy: sandbox has no outbound network. Run `cd /c/Claude/vanta && vercel --prod --yes` from a machine with access.

**Recurring gotchas (still present)**
1. `.git/index.lock` (0-byte, WSL mount, cannot unlink). Workaround: copy index to `/tmp`, use `GIT_INDEX_FILE` for add/write-tree, `git commit-tree` + direct SHA write to `.git/refs/heads/main`.
2. `Edit`/`Write` file-tool truncation. Fix: rewrite full file content via bash heredoc. After any Edit/Write, verify `wc -l` before running tsc.

---

## 2026-05-06 — 1.1, 1.2, 1.3 all live; agent's mid-task diffs committed

The cowork agent had been productive but skipping consecutive runs because its in-flight Phase 1.3 diff was never committed.

**Just landed (deployed live):**
- 1.1 SL/TP/stop-out worker — committed `0ad7900`; backend log confirms `Risk worker started (1s tick)`.
- 1.2 Margin reservation/release — committed `98f4fb4`; deployed.
- 1.3 Order error mapping — committed `c0af6d2`; frontend deployed to vanta-jade.vercel.app.

**Tree state:** clean, on `main`.

---

## 2026-05-05T22:14Z — Phase 1.2 margin reserve/release landed (commit only — deploy still pending)

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **1.2 Margin requirement on order open**
**Commit:** `98f4fb4` — `auto: margin requirement on order open` (4 files: +209 −5 net)

**Gotchas the next agent will hit**
1. `.git/index.lock` AND `.git/HEAD.lock` — both 0-byte stale lockfiles. Workaround: copy index to `/tmp`, use `GIT_INDEX_FILE` + `git commit-tree`, write SHA directly to `.git/refs/heads/main`.
2. Edit/Write tool truncation. Fix: rewrite via bash heredoc; verify `wc -l` + tail after.

---
