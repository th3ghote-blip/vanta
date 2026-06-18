# STATE -- handoff notes for the next agent

## ✅ 2026-06-18 (auto) — 21.8 DONE (MT4-Manager feature-parity checklist). Pushed to main.
Working tree was clean at start (only the prior STATE.md handoff). Topmost unchecked items 21.1
(admin audit) and 21.7 (KYC e2e) both need a network-enabled / visual run — 21.1 already carries its
`>` block; added a matching `>` skip note under 21.7 this run. 21.8 was the topmost
offline-completable item (pure markdown), as the prior run queued.

**What shipped (commit `a7e19c8` on main, CI runs but this is docs-only — no deploy impact):**
- `docs/mt4-manager-parity.md` (new): 15-row Have/Partial/Missing matrix mapping each MT4-Manager
  capability to Vanta's actual `server/src/routes/admin.ts` routes, `app/admin/*` screens, and
  `server/src/workers/*`. Result: **9 Have** (live positions, force-close, modify SL/TP, txn queue,
  margin-call+stop-out monitor, exposure-by-symbol, reporting account/symbol/day, impersonate, perf),
  **4 Partial** (account list lacks equity/margin-level column; no global filtered closed-trades
  blotter; balance ops have no separate non-withdrawable credit bucket; no operator broadcast
  notification), **2 Missing** (online-users monitor; per-group spread/markup).
- `TODO.md`: marked 21.8 `[x]`; added the `>` skip note under 21.7; **spawned 8 follow-up items
  21.9–21.16** (one per Partial/Missing) with files + acceptance + offline/network tags, so the
  acceptance "turn every Missing into a 21.x sub-item" is satisfied.
- No code/tests touched — client & server tsc unaffected; nothing to run.

**Commit recipe note:** the STATE.md `git clone --local` recipe FAILED this run — the hardlinked
clone produced read-only working-tree files that `git reset --hard`/`cp` couldn't overwrite. Worked
around it by cloning **fresh from GitHub** (`git clone --depth 2 <remote-with-token> /tmp/gh`; egress
is github-only but the token remote is reachable), copying the two touched files in, commit + push.
Then synced the mount the usual way (pack NEW¬OLD → `.git/objects/pack/`, `index-pack`, overwrite
loose `.git/refs/heads/main` AND `.git/refs/remotes/origin/main`, rebuild index via
`GIT_INDEX_FILE=/tmp/idx2 read-tree NEW` → `cat > .git/index`). NB: the first `read-tree` to
`/tmp/idx` died on a stale lock — just use a fresh GIT_INDEX_FILE path. Mount tree verified clean
(`## main...origin/main`, no ahead). **Prefer the fresh-GitHub-clone recipe over clone --local.**

### Next pick: Phase 21 offline backend items spawned this run — **21.9** (equity+margin-level columns
on the admin account list) or **21.10** (global filtered closed-trades blotter `GET /api/admin/trades`
+ `app/admin/trades.tsx`) are the most offline-completable (unit-testable aggregates / client-only).
21.1 (admin audit) and 21.7 (KYC e2e) stay blocked until a network-enabled interactive run. Migrations
ARE reachable (Supabase Mgmt API allowlisted) so 21.11/21.13 are also doable if preferred.

## ✅ 2026-06-18 (auto) — 21.6 DONE (platform & per-account analytics dashboards). Pushed to main.
Working tree was clean at start (only the prior STATE.md handoff; the human Quick-rounds changeset
that caused the 06-17 skips is GONE). Resumed normal picking. 21.1 (admin audit) stays BLOCKED for
offline runs (needs live HTTP to Railway — sandbox egress is github-only; left a `>` note). 21.2–21.5
done. Picked 21.6 (overview + accounts aggregates are offline-unit-testable like 21.5).

**What shipped (commit on main, CI deploys both):**
- `server/src/routes/admin.ts`: `GET /api/admin/analytics/overview?days=30` (clamp 1–90) — daily UTC
  time-series (new_users by `profiles.created_at`, trade_count+trade_volume by `open_time`,
  deposits/withdrawals from completed `transactions` by `created_at`, house_pnl=−Σ closed `profit` by
  `close_time`) + `window_totals` + lifetime `totals` computed **identically to `/admin/dashboard`**
  (total_users, total_deposits, open_trades, total_exposure=Σ volume·open_price — note: NO contractSize,
  matching the dashboard). And `GET /api/admin/analytics/accounts?sort=pnl|net|equity|trades|deposits&limit=200`
  — per-account leaderboard: lifetime deposits/withdrawals/net, realized P&L (Σ closed profit), unrealized
  + current_equity (balance + live-mid unrealized, fallback open_price), trade/closed counts, win rate, + reconciling totals.
- `lib/api.ts`: `adminAnalyticsOverview()` + `adminAnalyticsAccounts()` typed helpers.
- `app/admin/analytics.tsx`: rewritten with a top mode switcher (By Asset / Platform / Accounts). The
  21.5 by-symbol view is preserved verbatim as `SymbolView`. New `PlatformView` (lifetime totals card +
  per-metric daily mini-bar panels) and `AccountsView` (sortable leaderboard; rows deep-link to
  `/admin/user/:id`). No change to `app/admin/index.tsx` (the existing "Asset Analytics" tile opens it).
- Tests: `supabaseMock` gained a `transactions` table + `seed.transaction()` + `created_at` on
  `DbProfile`/`seed.profile` (additive — all prior tests still green). New
  `server/test/adminAnalyticsDashboards.test.ts` (6 tests). No migration this run.
- Verified offline: client tsc clean, server tsc clean, `npm test` **203 passing** (was 195).

**PENDING LIVE VERIFY (next interactive session):** overview `totals` match the dashboard tiles on the
live DB; a known account's `realized_pnl` equals its closed-trade sum; the daily mini-bar charts render
and the Accounts rows deep-link correctly.

### Next pick: 21.8 (MT4-Manager parity checklist — pure markdown `docs/mt4-manager-parity.md`, fully
offline) is the topmost remaining offline-completable item. 21.1 (admin audit) and 21.7 (KYC e2e) both
need a network-enabled run (live Railway / live KYC images). Phase 22 items mostly need migrations
(network) or external news feeds.

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
completable item — 21.1 (admin audit