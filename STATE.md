# STATE — handoff notes for the next agent

> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.

---

## 2026-05-05T14:07Z — Skipped run: dirty working tree (STATE.md truncated)

**Agent:** scheduled cowork auto-work pass
**Action taken:** none beyond writing this note — exited per the "dirty working tree" hard rule.

**What I observed:** `git status` shows `STATE.md` modified vs HEAD. `git diff` shows 59 lines removed: the file on disk is 128 lines and ends mid-sentence ("Confirm Railway/Vercel deploy sources don't depend on git" — no newline, no trailing entries). HEAD's version is 187 lines and includes the full "Initial roadmap handoff" section. This looks like a corruption / partial-write rather than a user mid-edit.

**Why I still skipped:** the rule is "dirty tree = stop, leave a note, exit." If this is actually a user mid-edit (despite appearances), restoring from HEAD would clobber their work. I left the truncated content untouched below and just prepended this entry.

**One-line fix to unblock the next run:**
```
cd /c/Claude/vanta
git checkout HEAD -- STATE.md   # restore the full file
```

**Next agent:** if working tree is clean, start with Phase 1.1 (server worker for SL/TP/stop-out) per the prior handoff.

**Nothing else was modified.**

---

## 2026-05-05T10:41Z — Skipped run: dirty working tree (CRLF drift)

**Agent:** scheduled cowork auto-work pass
**Action taken:** none — exited per the "dirty working tree" hard rule. Only modified this STATE.md entry.

**What I saw:** `git status` on `main` shows two modified files I didn't touch:
- `.gitignore` — last two lines (` ` and `.vercel`) re-saved with CRLF (`\r\n`) instead of LF
- `server/.gitignore` — single line `.vercel` re-saved with CRLF

The diffs are pure line-ending changes (verified with `git diff | cat -A` — `^M$` markers on the new sides). No content drift. This is almost certainly a Windows editor or sync process re-writing these files with CRLF line endings, not an in-flight user edit.

**Why I still skipped:** the rule is "dirty tree = stop, leave a note, exit." Erring conservative. If this recurs every run it'll permanently block scheduled work.

**Suggested fix for the user (one-time, then runs unblock):**
```
cd /c/Claude/vanta
# Option A — accept the CRLF and move on:
git add .gitignore server/.gitignore && git commit -m "chore: normalize .gitignore line endings"
# Option B — restore LF and add a .gitattributes to keep them LF:
git checkout -- .gitignore server/.gitignore
printf "*.gitignore text eol=lf\n" >> .gitattributes
git add .gitattributes && git commit -m "chore: pin .gitignore to LF endings"
```

Alternatively, set `git config core.autocrlf false` in this repo if you'd prefer no automatic conversion at all.

**Next agent:** if the tree is clean, start with Phase 1.1 (server worker for SL/TP/stop-out) per the prior handoff.

---

## 2026-05-05T late — Line-ending blocker fixed, agent fully unblocked

**The blocker:** Windows `core.autocrlf=true` (default on Git for Windows) was re-marking `.gitignore` and `server/.gitignore` as modified every time anything touched them. This kept failing the agent's "working tree clean" precheck, so it was skipping every scheduled run.

**The fix (committed in `2fa3692`):**
- Added `.gitattributes` pinning all text files to LF eol with `* text=auto eol=lf` plus explicit per-extension rules.
- Set local `git config core.autocrlf false`.
- Renormalized the working tree via `git add --renormalize .`.
- Verified `git check-attr eol .gitignore` returns `lf`.

**What this means for future agents:** any clone of this repo on any platform will get LF line endings consistently. The CRLF drift can't recur unless someone changes `.gitattributes`.

**Stale lock file:** also cleared `.git/index.lock` (was a leftover from a prior interrupted git op).

**Full precheck verified:**
1. `pwd` → /c/Claude/vanta
2. `git status` clean
3. `git branch --show-current` → main
4. Client `tsc --noEmit` silent
5. Server `tsc --noEmit` silent
6. Backend `/health` returns `{"ok":true}`
7. Frontend returns HTTP 200
8. `.gitignore` and `server/.gitignore` resolve to `eol: lf` per `.gitattributes`

**Next agent:** all green, pick up Phase 1.1 — Server worker for stop-loss / take-profit / stop-out.

---

## 2026-05-05 — Precheck verified end-to-end

Backed up the git restoration with full agent-precheck verification:
- `git status` clean on `main`, 3 commits (initial + restore + tsconfig fix)
- Client `tsc --noEmit` silent (was previously sweeping in `server/` and erroring on top-level await — fixed by adding `exclude: ["server", ...]` to root `tsconfig.json`)
- Server `tsc --noEmit` silent
- Backend `/health` returns 200 OK
- Frontend serves 200 at vanta-jade.vercel.app
- Supabase Management API (PAT in `server/.env` as `SUPABASE_PAT`) verified working

**Known bug not blocking the agent (worth a future task):** account `80000001` has balance `$545,524.28` — the old buggy contract-size math (treating BTC as 100k contract size) was applied to a close before the fix. Account `80000002` is correct at $10k. Lower-priority cleanup.

**Next agent:** start with Phase 1.1 (server worker for SL/TP/stop-out).

---

## 2026-05-05 — Git restored, agent unblocked

**Action taken:** Initialized git repo at `/c/Claude/vanta`. `main` branch. User identity configured locally as `Vanta Dev <vanta-dev@local>` (change later if you want commits attributed to a real account).

**Initial commit:** `20b4420` — covers all 73 tracked files (entire current state of scaffold + backend + docs). Secrets verified ignored: `.env`, `server/.env`, `.vercel/`, `node_modules/`, `dist/`, `.expo/`.

**No remote configured.** Work happens locally for now. If you want a GitHub/GitLab remote, add one with `git remote add origin <url>` and push. Not required for the cowork loop.

**Next agent:** working tree is clean on `main`. Run the standard precheck and proceed with **Phase 1.1 — Server worker for stop-loss / take-profit / stop-out** from `TODO.md`.

---

## 2026-05-05T00:00Z — Skipped run (repeat): no git repository

**Agent:** scheduled cowork auto-work pass
**Action taken:** none — exited without doing work.

**Status:** Same condition as the prior entry below. Re-checked: `/c/Claude/vanta` has no `.git/` directory; `git status` returns `fatal: not a git repository`. No files were modified except this STATE.md entry.

**Reminder for the user:** until git is restored, every scheduled run will keep skipping. See the entry below for full diagnosis and the suggested fix (`git init` + initial commit, or reclone from remote and migrate uncommitted work). Once git is back, the next run will pick up the topmost unchecked item — currently **1.1 Server worker for stop-loss / take-profit / stop-out**.

---

## 2026-05-04T18:06Z — Skipped run: no git repository

**Agent:** scheduled cowork auto-work pass
**Action taken:** none — exited without doing work.

**Why:** `/c/Claude/vanta` has no `.git` directory. `git status` returns `fatal: not a git repository`. The TODO.md workflow requires `git status` (precheck), `git add <paths>` (staging), and `git commit` (history) for every completed item. Without a repo I can't:
1. Verify the working tree is clean before starting (the mandatory precheck).
2. Commit my changes per the `auto: <title>` convention.
3. Leave a recoverable history for the next agent.

**What I checked:**
- `ls -la /c/Claude/vanta` — only `.gitignore` is present, no `.git/` directory.
- `find ... -maxdepth 3 -name "*.git*"` — only `.gitignore` files (project + nested in node_modules).
- No `.git` in `server/` either.
- `node_modules/` is intact and `package.json` looks normal, so this isn't a fresh-clone-in-progress.

**Possible causes (for the user to investigate):**
- The repo was deleted or never initialized in this workspace.
- A previous run or manual operation removed `.git/` (e.g. `rm -rf .git`).
- The folder was copied from another machine without `.git/`.
- The repo lives at a different path and this is a working copy.

**What the user should do:**
- If there's a remote (GitHub/GitLab), reclone into a temp dir and copy `.git/` over, OR clone fresh and migrate any uncommitted work.
- If there's no remote yet: `cd /c/Claude/vanta && git init && git add . && git commit -m "initial commit"` — but verify what should/shouldn't be committed first (the existing `.gitignore` should handle node_modules, .env, etc.).
- Confirm Railway/Vercel deploy sources don't depend on git
