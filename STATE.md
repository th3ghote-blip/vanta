# STATE -- handoff notes for the next agent

## ⏸️ 2026-06-21 (auto, run 4) — NO ITEM PICKED. Offline queue still DRAINED (4th consecutive no-op).
origin/main = `bf89ccb` (treated as truth; local `refs/heads/main` = `c6ce3ae`, behind by 3 — cannot fast-forward
because BOTH `.git/index.lock` and `.git/refs/heads/main.lock` (plus a `.git/HEAD.lock`) are STILL stuck
("Operation not permitted" — sync-layer owned, `rm` fails). **Verified safe to run:** built a fresh temp index off
origin/main (`GIT_INDEX_FILE=/tmp/vidx git read-tree origin/main`) and diffed — the working tree is byte-for-byte
identical to origin/main. The git-status "uncommitted changes" are purely the stale-index artifact (the already-pushed
22.1 work sitting in the dead local index), NOT a user mid-edit.

**Network empirically re-confirmed this run** (curl, not inherited): `github.com` 200; `api.supabase.com`,
`vanta-server-production.up.railway.app/health`, `vanta-jade.vercel.app` all **000 UNREACHABLE**. Egress is
github-only — the TODO header's "apply-migration.py IS reachable" line is WRONG for this sandbox. So no migration
can be applied and no live/visual acceptance can be verified offline.

**Re-triaged every unchecked non-PARKED `- [ ]` independently this run. None offline-completable:**
- **R.7** Better-Stack — needs a third-party account signup + a reachable live URL + a live takedown to verify. Has its `>` note.
- **18.2** chart drawing (interactive+persistence+visual) / **18.3** light-dark (~58-component VISUAL refactor; a missed token = broken render)
  / **18.7** AI assistant (Claude API + live DB) / **18.8** manager panel (oversized — split into 18.8a… first). Each carries its `>` note.
- **21.1** admin audit (acceptance = live 200 on every `/api/admin/*`) / **21.7** KYC e2e (live upload + signed-URL image preview). Network/visual gated.
- **21.11** credit bucket — "(optional)" PRODUCT decision for the owner (build a non-withdrawable bonus bucket or not?). **21.12** — depends on 21.14 → skip.
- **21.14** account groups — explicitly "Large — design & scope as its own mini-phase first"; not an autonomous pick.
- **PARKED** (5.3 / 8.1 / 9.3 / 9.4 / 10.1–10.6 / 20.2) — externally gated; resume only on explicit user say-so.
- Phase 22 has only 22.1 (done); no 22.2/22.3 checkboxes exist in the file yet.

**This run shipped:** docs/handoff only — NO code, NO migration, NO deploy. Just this STATE entry (committed via the
`GIT_INDEX_FILE` + `commit-tree` + push-by-sha workaround onto origin/main; all three git locks still stuck). TODO.md
unchanged — every blocked item already carries its `>` skip note.

**⚠️ ACTION FOR THE USER — auto-runs have had no safe offline work for 4 runs straight.** To unblock, ONE of:
(a) an **interactive / network-enabled run** (unblocks 18.2, 18.7, 21.1, 21.7, the 18.3 visual refactor, AND finally lets us
apply **migration 031**); (b) a **product decision** on 21.11 (do we want a credit/bonus bucket?); (c) **scoping** 21.14
(account groups) or **splitting** 18.8 into sub-items; or (d) unparking an external item (domain, mobile builds, Better-Stack).

**CARRIED-OVER PENDING (unchanged):** migration **031** (`031_account_last_seen.sql`) still NOT applied — sandbox can't
reach the Supabase Management API. Apply on the next network run:
`SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/031_account_last_seen.sql`. Until then
`/api/admin/online` 500s on live and `last_seen` writes are swallowed no-ops. Commit workaround while locks are stuck:
`GIT_INDEX_FILE=/tmp/i git read-tree origin/main && … add <file> && TREE=$(… write-tree) && C=$(git commit-tree $TREE -p origin/main -m '…') && git push origin $C:refs/heads/main`.
The `Edit` file-tool can TRUNCATE files through the sync layer — prefer Write/python and verify `wc -l` before trusting a write.

## ⏸️ 2026-06-20 (auto, run 3) — NO ITEM PICKED. Offline queue still DRAINED (3rd consecutive no-op).
HEAD local = `c6ce3ae` (TRAILS origin/main by 2 — origin = `fc2daae`); prior runs pushed STATE-only commits by sha
because BOTH `.git/index.lock` (0B, 2026-06-18) and `.git/refs/heads/main.lock` (41B, 2026-06-20) are STILL stuck and
un-removable, so local `refs/heads/main` cannot be advanced. **Verified safe to run:** built a fresh temp index off
origin/main and diffed — the working tree is byte-for-byte identical to origin/main (the git-status "uncommitted
changes" are purely the stale-index artifact, NOT a user mid-edit). Next run: `git fetch` and treat origin as truth.

**Re-triaged every unchecked non-PARKED `- [ ]` independently this run (not inherited). None offline-completable:**
- **R.7** (topmost) — externally gated (Better-Stack signup + live URL + live takedown to verify). Already has its `>` note.
- **18.2** chart drawing / **18.3** light-dark (~58-component VISUAL refactor) / **18.7** AI assistant (needs Claude API + live DB)
  / **18.8** manager panel (oversized — needs splitting first) — each blocked for an offline/no-screenshot run; each carries its `>` note.
- **21.1** admin audit (acceptance = live 200 on every `/api/admin/*`) / **21.7** KYC e2e (live + visual) — network/visual gated.
- **21.11** credit bucket — "(optional)" PRODUCT decision for the owner. **21.12** — "(Depends on 21.14.)" dependency unmet → skip.
- **21.14** account groups — explicitly "Large — design & scope as its own mini-phase first"; not an autonomous pick.
- **PARKED** (5.3 / 8.1 / 9.3 / 9.4 / 10.1–10.6 / 20.2) — externally gated; resume only on explicit user say-so.
- NB for the next agent: 21.8–21.10, 21.13, 21.15, 21.16 and 22.1 are all DONE — their `- [ ] **Files:**` sub-bullets are a
  formatting quirk sitting under a `- [x] Done` first line, NOT open items. Phase 22 currently has only 22.1 (done); no
  22.2/22.3 checkboxes exist in the file yet (the Phase-22 intro mentions a future market-news feed but it isn't written as items).

**Network empirically re-confirmed this run** (not inherited): `git ls-remote origin` OK; `curl https://api.supabase.com`
→ 000 UNREACHABLE. Egress is github-only — the TODO header's "apply-migration.py IS reachable" line is WRONG for this sandbox.

**This run shipped:** docs/handoff only — NO code, NO migration, NO deploy. Just this STATE entry (committed via the
`GIT_INDEX_FILE` + `commit-tree` + push-by-sha workaround; both locks still stuck). TODO.md unchanged — every blocked item already carries its `>` note.

**⚠️ ACTION FOR THE USER — auto-runs have had no safe offline work for 3 runs straight.** To unblock, ONE of:
(a) an **interactive / network-enabled run** (unblocks 18.2, 18.7, 21.1, 21.7, the 18.3 visual refactor, AND finally lets us
apply **migration 031**); (b) a **product decision** on 21.11 (do we want a credit/bonus bucket?); (c) **scoping** 21.14
(account groups) or **splitting** 18.8 into sub-items; or (d) unparking an external item (domain, mobile builds, Better-Stack).

**CARRIED-OVER PENDING (unchanged):** migration **031** (`031_account_last_seen.sql`) still NOT applied — the sandbox
can't reach the Supabase Management API. Apply on the next network run:
`SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/031_account_last_seen.sql`. Until then
`/api/admin/online` 500s on live and `last_seen` writes are swallowed no-ops. Both git locks remain stuck — commit via
`GIT_INDEX_FILE=/tmp/i git read-tree origin/main && … add <file> && TREE=$(… write-tree) && C=$(git commit-tree $TREE -p origin/main -m '…') && git push origin $C:refs/heads/main`.
The `Edit` file-tool can TRUNCATE files through the sync layer — prefer Write/python and verify `wc -l` before trusting a write.

## ✅ 2026-06-20 (auto) — 22.1 DONE (expanded achievements catalogue). Pushed to main.
Working tree was clean at start (after clearing a STALE `.git/index.lock` dated 2026-06-18 that the
sandbox could NOT `rm` — sync-layer owned; used the precheck's `GIT_INDEX_FILE` workaround to commit).
22.1 was the recommended next offline pick: 21.1 (admin audit) and 21.7 (KYC e2e) remain BLOCKED for
offline runs (network/visual, each carries its `>` skip note); 21.11 (credit bucket) needs a product
decision; 21.12 depends on 21.14; 21.14 (account groups) is a large design-first item.

**What shipped (commit on main, CI deploys both):**
- `server/src/lib/achievements.ts`: +15 badge codes (total 22). New `checkX` helpers (each fetches rows and
  reduces in JS so the in-memory test mock exercises the same path — no `.gt()` needed):
  `checkVolumeMilestones` (volume_1/10/100, Σ lots over open+closed), `checkTradeCountMilestones`
  (trades_10/50/100), `checkProfitMilestones` (first_green + profit_100/1000 over CLOSED profit; open trades
  excluded), `checkGain10pct` (balance ≥ $11k), `checkTakeProfitPlanner` (≥10 closed w/ take_profit),
  `checkDiversified` (≥5 distinct symbols), `checkRobotMaster` (≥10 robots). All idempotent via `awardAchievement`.
- Wiring (fire-and-forget, mirrors existing): `orders.ts` open block → volume/trade-count/diversified;
  close block (Promise.all) → profit/tp-planner/gain_10pct. `robots.ts` create → robot_master.
  `auth.ts` login streak → three_day_streak (≥3) + thirty_day_streak (≥30) alongside the existing 7-day.
- NO migration (codes are free-text in the `achievements` table). NO client change: `app/(tabs)/profile.tsx`
  renders one tile per `ACHIEVEMENT_META` entry from `GET /api/achievements`, so new badges show automatically.
- Tests: new `server/test/achievements.test.ts` (13). IMPORTANT FIX: the routes now call the new helpers, so the
  achievements `vi.mock` in `orders/robots/auth/auth-boundaries/copyTrading/rounds` tests had to gain the 7 new fns
  — otherwise `void checkVolumeMilestones(...)` is `undefined(...)` → synchronous TypeError → the open/close route
  500s (this is what broke 10 orders hedging tests until the mocks were extended). Verified offline: client tsc clean,
  server tsc clean, `npm test` **255 passing** (was 242).

**⚠️ ENVIRONMENT GOTCHAS for the next run:**
1. The `Edit` file-tool TRUNCATED several files when writing through the Windows→bash sync layer this run (e.g.
   achievements.ts came out 110 lines on the bash disk vs the full content the tool reported). The `Write` tool and
   direct bash/python writes were fine. **Recommendation: apply code edits via bash (python/sed) or the Write tool and
   verify line counts with `wc -l` from bash before trusting them.** Restored the corrupted files with
   `git show HEAD:<path> > <path>` then re-applied edits via python — all good now.
2. `.git/index.lock` (0 bytes, dated 2026-06-18) is STUCK — `rm` fails (permission/sync-layer). Normal `git add`/
   `commit`/`checkout` error with "index.lock File exists". Workaround used: `GIT_INDEX_FILE=/tmp/<idx> git read-tree HEAD
   && GIT_INDEX_FILE=/tmp/<idx> git add <paths> && GIT_INDEX_FILE=/tmp/<idx> git commit ...`. If a future run can remove
   the lock, prefer that.

**PENDING LIVE VERIFY (next interactive session):** unlock a few new badges (place trades to cross volume/trade-count,
grow to $11k, build robots, 3-day login streak) and confirm they render on the profile Achievements grid.
(Carried over: **migration 031 still NOT applied** — apply on the next network-enabled run:
`SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/031_account_last_seen.sql`.)

## ✅ 2026-06-19 (auto) — 21.16 DONE (operator broadcast / notify). Pushed to main.
Working tree was clean at start (only the STATE.md/TODO.md handoff). 21.16 was the topmost
offline unit-testable item, as the prior run queued. 21.11 (credit bucket) needs a product decision;
21.12 depends on 21.14; 21.14 (account groups) is a large design-first item; 21.1 (admin audit) and
21.7 (KYC e2e) stay BLOCKED for offline runs (network/visual).

**What shipped (commit on main, CI deploys both):**
- `server/src/routes/admin.ts`: `POST /api/admin/notify` (admin-only). zod body: `title`(1–200),
  `body`(1–4000), `audience` `'all'|'account'` (default account), `login`(account login NUMBER) OR
  `userId`(uuid), optional `symbol`/`data`. account-mode resolves ONE recipient by userId else by
  login→owner user_id (unknown login → **404 account_not_found**; neither → **400 missing_target**).
  all-mode fans out to every distinct `profiles.id`. Inserts one `notifications` row per recipient
  (`kind='system'`, `data={...,broadcast,from_admin}`) — in-app feed is source of truth — then a
  best-effort `sendPushBatch` (never fails the request). Returns `{ok,audience,recipients}`.
  Added `import { sendPushBatch } from '../lib/push.js'` + `NotifySchema`.
- `lib/api.ts`: `api.adminNotify({title,body,audience?,login?,userId?,symbol?,data?})`.
- `app/admin/notify.tsx` (NEW): audience toggle, login input, title + multiline body, all-clients
  warning banner, success/error states, Send button.
- `app/admin/index.tsx`: "Broadcast / Notify" nav tile (Send icon).
- Tests: `server/test/adminNotify.test.ts` (8). Verified offline: client tsc clean, server tsc clean,
  `npm test` **242 passing** (was 234). No migration (reuses `notifications` table from migration 029).

**PENDING LIVE VERIFY (next interactive session):** a composed message appears in the target client's
in-app notifications; "all clients" reaches every account; push arrives on devices with a token.
