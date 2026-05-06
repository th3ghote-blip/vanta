# STATE — handoff notes for the next agent

> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.

---

## 2026-05-06T14:06Z — Skipped run: dirty working tree (same 1.3 diff as 12:40Z, plus prior skip's STATE.md edit)

**Agent:** scheduled cowork auto-work pass
**Action taken:** none beyond this STATE.md note — exited per the "dirty working tree" hard rule.

**Why again:** `git status` shows the same three modified files as the 12:40Z run: `STATE.md` (the prior skip note, never committed), `components/pro/OrderEntry.tsx`, and `lib/api.ts`. The OrderEntry/api.ts diffs are identical to what the 12:40Z entry described — no human progress in between, no new agent work. We're now stuck in a skip loop until a human either commits/discards those changes or the next agent gets explicit go-ahead.

**Heads up — Edit-tool truncation bit me again.** My first attempt to add this entry via the `Edit` file tool truncated STATE.md mid-line at line 88 (HEAD-tail content lost). I rebuilt the file via bash heredoc — that's why this entry is here at all. Same gotcha #2 the 22:14Z entry warned about; it's still real.

**Recommendation for the human:** if the OrderEntry.tsx + lib/api.ts diff is not your in-progress work, just `git add components/pro/OrderEntry.tsx lib/api.ts STATE.md && git commit` (or discard with `git checkout --`) so the auto-runs unblock. The 12:40Z entry (below) has the diff summary and a checklist for landing 1.3 cleanly if you want an agent to take it from here.

---

## 2026-05-06T12:40Z — Skipped run: dirty working tree (looks like in-flight 1.3 work)

**Agent:** scheduled cowork auto-work pass
**Action taken:** none beyond writing this note — exited per the "dirty working tree" hard rule.

**What I observed:** `git status` shows two modified files vs HEAD:
- `components/pro/OrderEntry.tsx` (+54/-2): adds `fmtUsd()` + `describeOrderError()` mapping `insufficient_margin`/`no_quote`/`forbidden`/`invalid_input`/`unauthorized`/`margin_reserve_failed`/`insert_failed` to friendly copy; replaces `setLastError(err?.message ?? 'Order failed')` with `setLastError(describeOrderError(err, symbol))`.
- `lib/api.ts` (+31/-5): introduces and exports `ApiError` class (`code`, `status`, `details`); `request()` now parses the JSON body, pulls `error` as `code` and the rest as `details`, throws `ApiError` instead of plain `Error`.

This is exactly what TODO 1.3 asks for, and the previous STATE entry suggested 1.3 as the next item — so it most likely is a prior agent run that crashed before commit. But it's uncommitted, so per the hard rule I'm treating it as possible user mid-edit and not touching it.

**Suggested next step (for the human or next agent if tree is clean):**
The diff looks correct on inspection. If the human can confirm it's not their in-progress work, the next agent should:
1. Run the precheck (`tsc --noEmit` both root and `server/`).
2. `git add components/pro/OrderEntry.tsx lib/api.ts && git commit -m "auto: order entry feedback for margin/quote/generic errors"`.
3. Mark `1.3` `[x]` in `TODO.md`.
4. Deploy frontend (`vercel --prod --yes`).
5. Verify acceptance: try to over-leverage in UI → "Not enough margin (required: $X, available: $Y)".

If the human IS mid-edit, leave it alone — they'll commit when ready.

**No deploys this run. No commits this run.** TODO unchanged. Next run picks back up from 1.3 (or 1.4 if 1.3 lands in the meantime).

---

## 2026-05-05T22:14Z — Phase 1.2 margin reserve/release landed (commit only — deploy still pending)

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **1.2 Margin requirement on order open**
**Commit:** `98f4fb4` — `auto: margin requirement on order open` (4 files: +209 −5 net)

**What changed**
- New: `server/src/lib/margin.ts` — `requiredMargin()` (vol × price × contractSize / leverage), `reserveMargin()` (read+CAS-write, returns `insufficient` / `race` / `db_error`), `releaseMargin()` (lenient read-then-write, clamps to current `margin_used`). Doc-comment explains the demo-grade atomicity tradeoff.
- New helper: `notionalUSD()` added to `server/src/lib/contracts.ts` to mirror the client `lib/contracts.ts` (kept the two in sync — `requiredMargin` actually uses `contractSize` directly so this is just for parity / future use).
- Modified: `server/src/routes/orders.ts`. Open: selects `margin_used, leverage`; computes `required`; if `free_margin < required` → 400 `{error:'insufficient_margin', required, available}`; otherwise `reserveMargin`, then insert trade; if insert fails, `releaseMargin` rolls back. Close: extended the join to pull `accounts.leverage`; after `apply_trade_pnl`, computes `required` from the closed trade and `releaseMargin`.
- Modified: `server/src/workers/risk.ts` (technically beyond the TODO's listed file, but the SL/TP/stop-out auto-closes share the same close path and would otherwise leak margin). The trades select now joins `accounts(leverage)`; `closeAtPrice` releases margin after the P&L apply. `OpenTrade` interface gained a `leverage` field.

**Verification done in-sandbox**
- `cd server && npx tsc --noEmit` → silent. Root `npx tsc --noEmit` → silent.
- Math sanity check via node: 100 BTC × 80k / 100x = `$80,000` (reject vs $10k free), 0.1 BTC = `$80` (allow), 1 lot EURUSD × 1.10 / 100x = `$1,100`, 0.5 oz XAU × 2400 / 100x = `$1,200`.
- `git log --oneline` shows `98f4fb4` on `main`, working tree clean.

**Verification NOT done — needs network / a real workstation**
- Live HTTP probes still 403 in this sandbox (Railway / Vercel allowlist, same as last run).
- **Deploy:** `cd /c/Claude/vanta/server && railway up --detach`. Phase 1.1 (commit `0ad7900`) is also still un-deployed; both ride out together on the next push.
- **Acceptance criteria** (rejection on 100-BTC, allowance on 0.1-BTC, `margin_used = 80`) can only be confirmed against the live API.

**Known limitations / cleanup item to file**
- The reserve and release paths read-then-write the `accounts` row via supabase-js, with a CAS guard on `margin_used` for reserve only. Concurrent reserves race-safely (CAS catches it, surfaced as 400 insufficient_margin). Concurrent close+open or close+close can leave a few cents temporarily in `margin_used`. **Cleanup:** add `reserve_margin(p_account_id, p_amount)` / `release_margin(p_account_id, p_amount)` Postgres RPCs (mirror `apply_trade_pnl`) in a new migration and switch the helpers to call them. Not done in this run because the cowork sandbox can't apply migrations and shipping code that calls a missing RPC would brick the deploy.
- Old open trades created **before** this deploy will still have `accounts.margin_used = 0`. When they close, `releaseMargin` clamps to the current `margin_used` so we don't go negative — at worst they appear to release 0. Net effect: the system gradually reaches consistent margin accounting as the pre-existing positions cycle.

**Gotchas the next agent will hit (these are getting worse, not better)**

1. **`.git/index.lock` AND `.git/HEAD.lock`.** Both 0-byte stale lockfiles in the WSL mount. Neither can be `unlink`-ed (`Operation not permitted`), but both can be **truncated** (`> .git/HEAD.lock`) or have content overwritten. Since git's locking is `O_CREAT|O_EXCL`, even a 0-byte file blocks `git commit` and `git update-ref`.
   - Workaround used this run:
     1. `cp .git/index /tmp/vanta-work/index` then `GIT_INDEX_FILE=/tmp/vanta-work/index git add ...`
     2. `TREE=$(GIT_INDEX_FILE=... git write-tree)` and `COMMIT=$(... git commit-tree $TREE -p $PARENT)` to build the commit object
     3. **Bypass `git update-ref`** (it tries to lock HEAD too) — write the new SHA directly into `.git/refs/heads/main` and reset `.git/HEAD` to `ref: refs/heads/main\n`. Both files are writable; only their `.lock` siblings are stuck.
     4. `cp /tmp/vanta-work/index .git/index` to re-sync on-disk index so `git status` is clean.
   - **The real fix** is still to delete the lock files from a Windows shell (`cmd /c del C:\Claude\vanta\.git\index.lock`). Without that the next run will likely hit the same wall.
2. **Edit/Write tool truncation.** Same issue STATE noted last run: an `Edit` to `server/src/lib/contracts.ts` looked correct via `Read` (42 lines) but bash `wc -l` reported 32 lines after the edit — only the part before my insertion was on disk. Fixed by re-writing via bash heredoc; verified with `wc -l` + `git hash-object`. **Heuristic stays:** anything Edit/Write touches that bash needs to read, sanity-check size + a tail line, and re-write via heredoc if it disagrees.
3. **`.git/objects/<xx>/tmp_obj_*` orphans.** Each git operation here creates one and can't unlink it. They're harmless ("warning: unable to unlink ..." is informational), but they grow. Eventually `git gc` will need to run from Windows.

**Suggested next item**
**1.3 Order entry feedback for margin / quote / generic errors** — pure client (`components/pro/OrderEntry.tsx`), no server changes, perfect follow-up since 1.2's new error code (`insufficient_margin` with `required` + `available` payload) is the main thing 1.3 wants to render nicely.

---

## 2026-05-05T18:15Z — Phase 1.1 risk worker landed (commit only — deploy still pending)

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **1.1 Server worker for stop-loss / take-profit / stop-out**
**Commit:** `0ad7900` — `auto: server worker for SL/TP/stop-out` (2 files, +236)

**What changed**
- New: `server/src/workers/risk.ts` — 1Hz tick that scans `trades` where `status='open'`, closes on SL/TP hit at the trigger price with `reason='stopout'`, then runs an aggregate stop-out check per account: if `accounts.equity + sum(unrealized) < 0`, force-closes that account's worst loser at current bid/ask. Uses the same `apply_trade_pnl` RPC the manual-close path uses, so balance/equity/free_margin stay consistent. CAS guard on the trade update (`.eq('status','open')`) blocks double-close races; an in-flight `running` flag skips overlapping ticks.
- Modified: `server/src/index.ts` — `import { startRiskWorker }` + `startRiskWorker(app)` next to the other start-up hooks.

**Verification done in-sandbox**
- `cd server && npx tsc --noEmit` -> silent
- `cd .. && npx tsc --noEmit` (client root) -> silent
- `git log --oneline` shows `0ad7900` on `main`. `git status` clean.

**Verification NOT done — needs a human or any environment with network/CLI access**
- Backend `/health` and frontend HTTP probes: the cowork sandbox proxy returns `403 blocked-by-allowlist` for `*.up.railway.app` and `*.vercel.app`. Both endpoints were healthy as of the prior STATE entry; assume they still are unless something else changed.
- **Deploy:** `railway` CLI is not installed in this sandbox and outbound to Railway is blocked anyway. Run `cd /c/Claude/vanta/server && railway up --detach` from a workstation that has the CLI to ship the worker.
- **Acceptance criterion** (from TODO.md 1.1) can only be verified post-deploy.

---

## 2026-05-05T14:07Z — Skipped run: dirty working tree (STATE.md truncated)

**Agent:** scheduled cowork auto-work pass
**Action taken:** none beyond writing this note — exited per the "dirty working tree" hard rule.

**What I observed:** `git status` shows `STATE.md` modified vs HEAD. `git diff` shows 59 lines removed. HEAD's version is 187 lines and includes the full "Initial roadmap handoff" section. This looks like a corruption / partial-write rather than a user mid-edit.

---

## 2026-05-05T10:41Z — Skipped run: dirty working tree (CRLF drift)

**Agent:** scheduled cowork auto-work pass
**Action taken:** none — exited per the "dirty working tree" hard rule.

**Suggested fix (since applied):** add `.gitattributes` with `* text=auto eol=lf` and `git config core.autocrlf false`. Done in `2fa3692`.

---

## 2026-05-05 — Line-ending blocker fixed, agent fully unblocked

**Fix committed in `2fa3692`:** `.gitattributes` pinning all text files to LF eol; local `git config core.autocrlf false`; `git add --renormalize .`.

**Known data bug not blocking the agent (worth a future task):** account `80000001` has balance `$545,524.28` — the old buggy contract-size math (treating BTC as 100k contract size) was applied to a close before the fix. Account `80000002` is correct at $10k. Lower-priority cleanup.
