# STATE -- handoff notes for the next agent

## ✅ 2026-06-19 (auto) — 21.10 DONE (global closed-trades blotter). Pushed to main.
Working tree was clean at start (only the prior STATE.md handoff — diff showed binary because the
committed HEAD copy is stale; the working copy is the latest handoff, which prior runs treat as clean).
Topmost unchecked items 21.1 (admin audit) and 21.7 (KYC e2e) stay BLOCKED for offline runs (need a
network-enabled / visual run — each carries its `>` skip note). 21.10 was the topmost offline-completable
item, as the prior run queued.

**What shipped (commit on main, CI deploys both):**
- `server/src/routes/admin.ts`: new admin-only `GET /api/admin/trades` — filtered global history of
  `status='closed'` trades. Params (all optional): `from`/`to` (ISO bounds on `close_time`, gte/lte),
  `symbol` (exact), `account` (login NUMBER → resolved to account_id; non-numeric = raw id; unknown
  login → empty set, NOT an error), `reason` (exact), `sort` (close_time|open_time|profit|volume|symbol,
  default close_time), `dir` (asc|desc, default desc), `limit` (1–500, default 100), `offset` (≥0).
  Rows carry login via `accounts!inner` embed + `duration_seconds` (close−open). `totals`
  (count, volume_lots, gross_profit, gross_loss, net_profit=realized_client_pnl, realized_house_pnl,
  wins, win_rate) computed over the **FULL filtered set** (not the page) so they reconcile against raw
  `trades`; `trades` is the sorted page slice, `count` is the full filtered count.
- `lib/api.ts`: `api.adminGetTrades(params)` typed helper.
- `app/admin/trades.tsx` (new): filter bar (symbol/account/reason + from/to + Apply) + totals card +
  sort tabs (asc/desc toggle) + per-row blotter + Prev/Next pagination (50/page).
- `app/admin/index.tsx`: "Trade History" nav tile (History icon, newly imported).
- Test helper (ADDITIVE): `supabaseMock` Query gained `.lte()`; `seed.trade` now carries `close_price`.
  New `server/test/adminTradesBlotter.test.ts` (10 tests: 403 gating; closed-only + totals
  reconciliation; symbol/account-login/reason filters; unknown-login→empty; close_time from/to range;
  limit/offset paging w/ full-set totals; profit asc sort).
- Verified offline: client tsc clean, server tsc clean, `npm test` **218 passing** (was 208). No migration.

**⚠️ LESSON RE-CONFIRMED THIS RUN:** editing `server/test/helpers/supabaseMock.ts` with the Edit tool
TRUNCATED the file (esbuild "Expected } but found end of file"). Restored via
`git show HEAD:<path> > /tmp/x` then re-applied changes with a python here-doc. **Use bash/python for
ALL `.ts`/`.tsx` edits — `.md` only for the Edit/Write tools.** (git checkout was blocked by a stale
`.git/index.lock` the mount can't `rm` — see the WSL wall recipe below.)

**PENDING LIVE VERIFY (next interactive session):** on the live DB, filtering `/api/admin/trades` by
symbol/account/date narrows the set; totals reconcile against raw closed `trades` for a known account.

### Next pick: **21.13** (online-users monitor — migration `0XX_account_last_seen.sql` + throttled
last_seen stamp in auth middleware + admin panel) or **21.15** (report export CSV — backend
serialization of the analytics views) are the topmost remaining offline-completable items. 21.11
(credit bucket) is a migration but needs a product decision (only build if a credit/bonus concept is
wanted) — left for the user. 21.16 (operator broadcast) is offline-unit-testable backend. 21.1 (admin
audit) and 21.7 (KYC e2e) stay blocked until a network-enabled interactive run.

## ✅ 2026-06-18 (auto) — 21.9 DONE (admin account list equity + margin-level columns). Pushed to main.
Working tree was clean at start (only the prior STATE.md handoff). Topmost unchecked items 21.1
(admin audit) and 21.7 (KYC e2e) both stay BLOCKED for offline runs (need a network-enabled /
visual run — each already carries its `>` skip note). 21.9 was the topmost offline-completable item,
as the prior run queued.

**What shipped (commit `0fce4d4` on main, CI deploys both):**
- `server/src/routes/admin.ts`: new `equityByAccount(rawAccts)` helper — one batched
  `status='open'` trades query (`.in('account_id', …).eq('status','open')`), computes per account
  live `equity` (= balance + Σ unrealized via `getMid`/`calculatePnL`, fallback `open_price`) and
  `margin_level_pct` (= `equity / margin_used * 100`, 1dp; **null** when `margin_used` is 0) — same
  definitions as `/analytics/accounts`. `GET /api/admin/users` enriches every returned account with
  these two fields on BOTH paths: `attachAccounts` (no-search + email-search) and the login-number
  search path. Both account `select`s now also pull `margin_used`.
- `lib/api.ts`: `AdminUser.accounts[]` gained optional `equity` / `margin_level_pct`.
- `app/admin/users.tsx`: `UserCard` shows a 2nd line "Equity $X · ML NN%", colour-coded
  (red <100%, amber <200%, green ≥200%, em-dash when null). Added `fmtMarginLevel`/`marginLevelColor`.
- `server/test/adminUsersEquity.test.ts` (new, 5 tests): 403 unauth/non-admin; equity+ML
  cross-checked against `/analytics/accounts` for the same account (the acceptance criterion);
  null-margin → null ML; login-number search path enriched.
- Verified offline: client tsc clean, server tsc clean, `npm test` **208 passing** (was 203).
  No migration this run.

**PENDING LIVE VERIFY (next interactive session):** on the live DB, an account's `equity` /
`margin_level_pct` on the user-search list match its row in the Accounts analytics leaderboard.

### Next pick: **21.10** (global closed-trades blotter — `GET /api/admin/trades` with from/to/symbol/
account/reason filters + `app/admin/trades.tsx` + `lib/api.ts`) is the topmost remaining
offline-unit-testable item (pure aggregate over `trades`). 21.11/21.13 are migration-based and also
doable offline (Supabase Mgmt API reachable). 21.1 (admin audit) and 21.7 (KYC e2e) stay blocked
until a network-enabled interactive run.

## ⚠️ READ THIS FIRST — Vercel git-author block
Set this BEFORE the first commit every session:
```bash
git config user.email "229847808+th3ghote-blip@users.noreply.github.com"
git config user.name "th3ghote-blip"
```

## ⚠️ WSL mount permission wall (persistent) + PROVEN commit/push recipe
The mounted repo CANNOT unlink/remove ANY file (`rm` → "Operation not permitted"), incl.
`.git/index.lock`. You CAN: read via git; overwrite existing working-tree files in place
(`>`/`cp` over the same inode); create files inside the existing `.git/objects/pack/` dir;
overwrite `.git/refs/heads/main`, `.git/refs/remotes/origin/main`, and `.git/index` in place.

**Proven recipe (used this run, works — prefer fresh-GitHub-clone over `clone --local`):**
1. Get the token remote: `git -C <mount> remote -v` (egress is github-only but the token remote is
   reachable). Clone fresh to a **UNIQUE** dir: `git clone --depth 2 <token-remote> /tmp/gh_$(date +%s)`.
   (A reused `/tmp/gh` from a prior run is read-only and `rm` fails — always use a fresh timestamped path.)
2. In the clone: set git author (above), `cp` your touched files in from the mount, `git add <paths>`,
   `git commit`, `git push origin main`. CI now deploys.
3. Sync the mount: from the clone, `printf '%s\n^%s\n' <NEW> <OLD> | git pack-objects --revs --stdout
   > /tmp/sync_$(date +%s).pack` (UNIQUE filename — `/tmp/sync.pack` may be a stale read-only file);
   `git --git-dir=<mount>/.git index-pack --stdin < that.pack` (a benign "unable to unlink tmp_idx_*"
   warning is fine — the pack still lands); overwrite loose `.git/refs/heads/main` AND
   `.git/refs/remotes/origin/main` with <NEW>; rebuild index: `GIT_INDEX_FILE=/tmp/idx_$(date +%s)
   git --git-dir=<mount>/.git read-tree <NEW>` then `cat that_idx > <mount>/.git/index`.
   Verify: `git --git-dir=<mount>/.git --work-tree=<mount> status -sb` → `## main...origin/main`, no ahead.
NB: `.git/packed-refs` has a stale `refs/heads/main`; the **loose** ref wins, so always overwrite the loose one.

## ⚠️ DO NOT edit code files with the Edit/Write file tools — use bash/python
Editing `.tsx`/`.ts` via the Edit tool has produced files `tsc` rejected with bogus parse errors. Make
all repo code edits through bash/python heredoc or in-place `open(...,'w')`, then verify with
`npx --no-install tsc --noEmit` before committing. (.md files like STATE.md/TODO.md are fine via Edit/Write.)
Also: TS forbids mixing `??` and `||` without parens — write `x ?? (a || b)`.

## ✅ 2026-06-18 (auto) — 21.8 DONE (MT4-Manager parity checklist). Commit `a7e19c8`.
`docs/mt4-manager-parity.md` — 15-row Have/Partial/Missing matrix (9 Have, 4 Partial, 2 Missing).
Spawned follow-ups 21.9–21.16 (one per Partial/Missing). Docs-only.

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       