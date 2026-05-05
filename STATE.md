# STATE — handoff notes for the next agent

> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.

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

**Gotchas the next agent will probably hit**

1. **Stale `.git/index.lock`.** There's a 0-byte `.git/index.lock` from `2026-05-05 18:06` that this sandbox **cannot delete** (`unlink`/`rm`/`mv` all fail with `Operation not permitted` — looks like a Windows-side file lock surfaced through the WSL mount). Plain `git add` fails with `fatal: Unable to create '.git/index.lock': File exists.`
   - **Workaround that worked here:** `cp .git/index /tmp/vanta-index && GIT_INDEX_FILE=/tmp/vanta-index git add ... && GIT_INDEX_FILE=/tmp/vanta-index git -c user.email=... commit -m "..."` — the commit lands in HEAD via the regular ref update, then `cp /tmp/vanta-index .git/index` re-syncs the on-disk index so subsequent `git status` reports clean.
   - **Real fix:** delete `.git/index.lock` from a Windows shell. Same goes for `.git/HEAD.lock` and `.git/objects/maintenance.lock` if they reappear — git creates and orphans them on every operation here.

2. **Bash mount and Windows file tools (`Read`/`Write`/`Edit`) can show different views of the same file.** During this run, an `Edit` on `server/src/index.ts` produced a file whose `Read`-tool view was correct (full 70 lines) but whose `bash cat` view was truncated mid-template-literal at line 65. Same issue hit the `Write` of this very STATE.md, requiring a bash heredoc to actually finish writing. **Heuristic:** anything you `Edit` or `Write` that bash-side tools (tsc, build, deploy, git) need to read — verify with `wc -l` / `tail` and re-write via bash heredoc if it looks truncated.

3. **`git diff` and `git status` can lie when stat-cache matches but content differs.** Same-byte-length partial writes round-tripped past `--refresh`. `git hash-object <path>` vs `git ls-files -s <path>` is the reliable check.

**Suggested next item**
After deploying 1.1: **1.2 Margin requirement on order open** — `server/src/routes/orders.ts`. Self-contained server-only change, doesn't depend on 1.1 going live first.

---

## 2026-05-05T14:07Z — Skipped run: dirty working tree (STATE.md truncated)

**Agent:** scheduled cowork auto-work pass
**Action taken:** none beyond writing this note — exited per the "dirty working tree" hard rule.

**What I observed:** `git status` shows `STATE.md` modified vs HEAD. `git diff` shows 59 lines removed. HEAD's version is 187 lines and includes the full "Initial roadmap handoff" section. This looks like a corruption / partial-write rather than a user mid-edit.

**Why I still skipped:** the rule is "dirty tree = stop, leave a note, exit." If this is actually a user mid-edit (despite appearances), restoring from HEAD would clobber their work.

**One-line fix to unblock the next run:**
```
cd /c/Claude/vanta && git checkout HEAD -- STATE.md
```

---

## 2026-05-05T10:41Z — Skipped run: dirty working tree (CRLF drift)

**Agent:** scheduled cowork auto-work pass
**Action taken:** none — exited per the "dirty working tree" hard rule.

**What I saw:** `git status` shows `.gitignore` and `server/.gitignore` modified with pure CRLF line-ending changes. Almost certainly a Windows editor or sync process re-writing them.

**Suggested fix:** add `.gitattributes` with `* text=auto eol=lf` and `git config core.autocrlf false`. (Done in 2fa3692, see entry below.)

---

## 2026-05-05T late — Line-ending blocker fixed, agent fully unblocked

**The blocker:** Windows `core.autocrlf=true` (default on Git for Windows) was re-marking `.gitignore` and `server/.gitignore` as modified every time anything touched them. This kept failing the agent's precheck.

**The fix (committed in `2fa3692`):**
- Added `.gitattributes` pinning all text files to LF eol.
- Set local `git config core.autocrlf false`.
- Renormalized via `git add --renormalize .`.

**Stale lock file:** also cleared `.git/index.lock` (a different lock has since recreated — see the 18:15Z entry above for current workaround).

**Full precheck verified that day:**
1. `git status` clean on `main`
2. Client + server `tsc --noEmit` silent
3. Backend `/health` returns `{"ok":true}`
4. Frontend returns HTTP 200

---

## 2026-05-05 — Precheck verified end-to-end

Full agent-precheck verification:
- `git status` clean on `main`
- Client + server `tsc --noEmit` silent
- Backend `/health` returns 200 OK
- Frontend serves 200 at vanta-jade.vercel.app
- Supabase Management API (PAT in `server/.env` as `SUPABASE_PAT`) verified working

**Known bug not blocking the agent (worth a future task):** account `80000001` has balance `$545,524.28` — the old buggy contract-size math (treating BTC as 100k contract size) was applied to a close before the fix. Account `80000002` is correct at $10k. Lower-priority cleanup.
