# STATE -- handoff notes for the next agent

## ⚠️ READ THIS FIRST — Vercel git-author block
Set this BEFORE the first commit every session:
```bash
git config user.email "229847808+th3ghote-blip@users.noreply.github.com"
git config user.name "th3ghote-blip"
```

## ⚠️ WSL mount permission wall (persistent)
The mounted repo CANNOT:
- unlink/remove ANY file (`rm` → "Operation not permitted"), incl. `.git/index.lock` (a stale
  zero-byte `.git/index.lock` is sitting there and cannot be deleted — so in-mount `git add`/
  `git commit` fail).
You CAN: read via git; **overwrite existing working-tree files in place** (`>` truncates the same
inode); **create files inside the existing `.git/objects/pack/` dir**; overwrite
`.git/refs/heads/main` and `.git/index` in place.
**Proven commit+push recipe (used this run, works):**
1. `git clone --local <mount> /tmp/vw` then in /tmp/vw add the GitHub remote
   (`git remote set-url origin <github-url-with-token>` — grab the token from the mount's
   `git remote -v`).
2. Copy your touched files from the mount into /tmp/vw, `git add <files>`, `git commit`,
   `git push origin main`. **GitHub now has the commit and CI deploys.**
3. Sync the mount so its next run sees a clean tree: from /tmp/vw
   `git pack-objects --revs --stdout <<<"<NEW>\n^<OLD>"` → write the pack into the mount's
   `.git/objects/pack/`, `git index-pack` it, overwrite the loose `.git/refs/heads/main` with
   `<NEW>`, then rebuild the index: `GIT_INDEX_FILE=/tmp/idx git --git-dir=<mount>/.git read-tree
   <NEW>` and `cat /tmp/idx > <mount>/.git/index`.
NB: `.git/packed-refs` has a stale `refs/heads/main` (8beb509); the **loose** ref wins, so always
overwrite the loose `.git/refs/heads/main`.

## ⚠️ DO NOT edit code files with the Edit/Write file tools — use bash/python
Editing `.tsx` via the Edit tool has produced files `tsc` rejected with bogus parse errors. Make
all repo code edits through bash/python heredoc or in-place `open(...,'w')`, then verify with
`npx --no-install tsc --noEmit` before committing. (.md files are fine via Edit/Write.)

## ✅ 2026-06-17 (auto) — 21.5 DONE (analytics by-symbol). Pushed to main.
Working tree was clean (only prior STATE.md handoff). Topmost OFFLINE-completable item: 21.1 (admin
audit) is still blocked (needs live HTTP to Railway — sandbox egress is github-only; added a `>` note
under it). 21.2/21.3/21.4 done. Picked 21.5 (pure aggregate over `trades`, unit-testable) per the
prior run's queued pick.

**What shipped (commit on main, CI deploys both):**
- `server/src/routes/admin.ts`: new admin-only `GET /api/admin/analytics/by-symbol?window=24h|7d|30d|all&threshold=N`.
  Window filters trades by INCEPTION (`open_time` via `.gte`; `all`=no filter — documented choice).
  Per symbol: trade/open/closed counts; `volume_lots`; `volume_notional` (notional at **open_price** —
  deterministic so it reconciles); open interest `open_buy_lots`/`open_sell_lots`/`net_open_lots` +
  `net_open_notional` at live mid (B-book); `realized_client_pnl` (Σ closed `profit`) + `realized_house_pnl`
  (=−client); `win_rate`; `avg_hold_seconds`; `top_accounts` (most-active); `over_exposure` flag
  (|net_open_notional| > threshold, default 100k). Sorted by volume_notional desc; `totals` + `generated_at`.
- `lib/api.ts`: `api.adminAnalyticsBySymbol(window, threshold?)`.
- `app/admin/analytics.tsx` (new): window selector (24h/7d/30d/All) + totals card + sort tabs
  (Volume/Exposure/House P&L/Win%) + per-symbol cards with exposure ⚠ flag.
- `app/admin/index.tsx`: "Asset Analytics" nav tile (PieChart icon, newly imported).
- Tests: `supabaseMock` `DbTrade` + `seed.trade` gained `open_time`/`close_time`/`profit` defaults
  (additive — all prior tests still green). New `server/test/adminAnalyticsBySymbol.test.ts` (6 tests:
  403 unauth/non-admin, full BTCUSD reconciliation, window 24h vs 30d filter, threshold→over_exposure,
  empty window). No migration this run.
- Verified offline: client tsc clean, server tsc clean, `npm test` **195 passing** (was 189).

**PENDING LIVE VERIFY (next interactive session):** numbers reconcile against raw `trades` for one
symbol on the live DB; switching the window changes them correctly.

### Next pick: 21.6 (platform/per-account dashboards) — overview + accounts aggregates are
offline-unit-testable like 21.5, though the time-series charts are visual (defer chart verify); OR
21.8 (MT4-parity doc, pure markdown — fully offline). 21.1 stays blocked until a network-enabled run
can curl live Railway. 21.7 needs live KYC images (network/visual).

## ✅ 2026-06-16 (auto) — 21.4 DONE (admin force-close / modify any position). Pushed to main.
Built directly on 21.3's blotter. Working tree was clean (only prior STATE.md handoff). Topmost
completable item — 21.1 (admin audit) is still blocked offline (needs live HTTP to Railway; sandbox
egress is github-only). 21.2/21.3 done.

**What shipped (commit on main, CI deploys both):**
- `server/src/routes/admin.ts`: `POST /api/admin/positions/:id/close` (admin-only) — closes any open
  trade at the live mid (`getMid`, falls back to open_price), realized P&L via `calculatePnL`,
  open→closed with a CAS guard (`.eq('status','open').select('id')`; 409 `already_closed` on race),
  settles via `apply_trade_pnl` RPC, releases margin via `releaseMargin`, stamps `reason='admin_close'`.
  `PATCH /api/admin/positions/:id { stopLoss?, takeProfit? }` — null clears a level, ≥1 field required,
  directional validation vs live mid (400 `invalid_sl`/`invalid_tp`), 404 if not open. GET `/positions`
  now also returns `stop_loss`/`take_profit` (modal prefill).
- `lib/api.ts`: `adminClosePosition()`, `adminModifyPosition()`; positions type gained `stop_loss`/`take_profit`.
- `app/admin/positions.tsx`: per-row **Force close** (web `window.confirm` / native `Alert` destructive
  confirm) + **SL/TP** button → Modify modal (two numeric inputs, blank = clear); per-row busy spinner,
  reload on success.
- Tests: new `server/test/adminPositionManage.test.ts` (9). Imports `getTable` from supabaseMock to
  assert post-state. No migration this run.
- Verified offline: client tsc clean, server tsc clean, `npm test` **189 passing** (was 180).

**PENDING LIVE VERIFY (next interactive session):** admin force-closes a real open trade → row goes
`closed`, client balance updates, margin released; modify SL/TP persists and reflects on the client device.

### Next pick: 21.5 (analytics by-symbol, `GET /api/admin/analytics/by-symbol` + `app/admin/analytics.tsx`)
is offline-unit-testable (aggregate over `trades`); or 21.8 (MT4-parity doc, pure markdown). 21.1 stays
blocked until a network-enabled run can curl live Railway. 21.6/21.7 need charts/live KYC (visual/network).

## ✅ 2026-06-16 (auto) — 21.3 DONE (admin Live Positions blotter). Pushed to main.
Dirty-tree blocker is CLEARED: the human Quick-rounds changeset that caused the 7 prior skips is
gone; working tree was clean except the prior run's STATE.md note. Resumed normal picking.

Items above 21.3 are all blocked for offline auto-runs (R.7 Better-Stack = external signup; 18.2
chart drawings + 18.3 light/dark = visual/screenshot; 18.7 AI assistant = needs Claude API key;
18.8 manager panel = oversized→split into 21.x; 20.2 = PARKED; 21.1 admin audit = needs live HTTP
to Railway, which the sandbox can't reach — left unchecked, see its note). So 21.3 was topmost
offline-completable.

**What shipped (commit on main, CI deploys both):**
- `server/src/routes/admin.ts`: new admin-only `GET /api/admin/positions` — every open trade across
  all accounts, stitched to its `login` via `accounts!inner`, with live mid (`getMid`), unrealized
  P&L (`calculatePnL`), notional (`notionalUSD`), held margin (`requiredMargin` at open_price).
  Summary: total_open / total_notional / buy_notional / sell_notional / net_notional. Sorted by |P&L|.
- `lib/api.ts`: typed `api.adminGetPositions()`.
- `app/admin/positions.tsx` (new): summary card + P&L/Symbol/Age sort tabs + per-row blotter.
- `app/admin/index.tsx`: "Live Positions" nav tile (Activity icon, already imported).
- Tests: `supabaseMock` gained `DbProfile.is_admin` + `seed.profile({is_admin})`; trades
  `accounts!inner` embed now surfaces `login`/`balance`/`margin_used` (additive — orders tests still
  green). `buildApp` helper now registers `adminRoutes`. New `server/test/adminPositions.test.ts`
  (5 tests). No migration this run.
- Verified offline: client tsc clean, server tsc clean, `npm test` **180 passing** (was 175).

**PENDING LIVE VERIFY (next interactive session):** open a trade on any account → it shows in
`/admin/positions` with correct live P&L within a refresh; check the summary net-exposure number.

### Next pick: 21.4 (force-close / modify any position) builds directly on this route — it needs
`POST /api/admin/positions/:id/close` + `PATCH /api/admin/positions/:id` (close at live mid, settle
P&L, release margin, log reason='admin_close'). Backend is unit-testable offline like 21.3; the
per-row buttons are visual (defer live verify). 21.1 (admin audit) stays blocked until a
network-enabled run can curl the live Railway API.

## Earlier (pruned)
- 2026-06-13 (auto): 18.6 — share_trades privacy: `PATCH /api/account/privacy` + `GET /api/traders/:id/trades`
  403 `trades_private` gate + leaderboard `.eq('share_trades',true)` + Profile Privacy switch. 175 passing.
  ⚠️ DEPLOY DEBT to confirm live: 19.1 ($ sizing) + 20.3 (trade-risk gate) + 18.10 (risk accept) + 18.6.
- 2026-06-13 (auto): 18.10 — risk acceptance persisted server-side (`POST /api/account/risk-accept`,
  `profiles.risk_accepted_at`; `app/_layout.tsx` syncs ack keys on start). 167→passing the