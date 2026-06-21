# STATE -- handoff notes for the next agent

## ⏸️ 2026-06-21 (auto, run 8) — NO ITEM PICKED. Dirty tree (CORRUPTION, not a user edit) + offline queue still drained.
**New this run — the working tree IS genuinely dirty, but it is file corruption, NOT user mid-edit.** local HEAD ==
`origin/main` == `07d3195`, branch "up to date". One modified file: `server/test/rateLimit.test.ts` (4119 → 4250 bytes).
git shows it as a binary diff; `file` reports `data`. Inspected with xxd: the committed code is intact and ends
normally with `});\n`, then **~131 trailing NUL bytes (0x00)** are padded on. A human editor never appends NULs — this is
the sync-layer corruption the prior STATE entries warned about, not work-in-progress. I did NOT modify this file.
Per the dirty-tree guard I did no work and pushed nothing.
**→ NEXT RUN: restore it with `git checkout -- server/test/rateLimit.test.ts` (committed version is known-good and ==
origin) to clean the tree; otherwise a future `npm test`/tsc run may choke on the NUL-padded file.** I left it untouched
this run rather than risk a write under the stuck git locks.

**Network re-confirmed (curl):** `github.com`→200; `api.supabase.com`, `vanta-jade.vercel.app`→**000 UNREACHABLE**.
Egress is github-only — no migration can be applied, no live/visual acceptance verifiable offline. Offline queue
remains drained: every unchecked non-PARKED item needs network/live verify or a human judgment call (full per-item
triage in run-7 entry below still holds).

**⚠️ ACTION FOR THE USER — 8 consecutive runs with no safe offline work.** To unblock, ONE of: (a) an
**interactive / network-enabled run** (unblocks 18.2, 18.7, 21.1, 21.7, the 18.3 refactor, AND applies **migration
031**); (b) a **product decision** on 21.11 (credit/bonus bucket — yes/no?); (c) **scoping** 21.14 or **splitting**
18.8 / 18.3 into sub-items; or (d) unparking an external item (domain, mobile builds, Better-Stack).

**CARRIED-OVER PENDING:** migration **031** (`031_account_last_seen.sql`) still NOT applied (sandbox can't reach
Supabase Management API). Apply on next network run:
`SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/031_account_last_seen.sql`. Until then
`/api/admin/online` 500s live and `last_seen` writes are swallowed no-ops.

**ENV GOTCHAS (carried):** Three git locks STUCK & un-`rm`-able (sync-layer owned, "Operation not permitted"):
`.git/index.lock`, `.git/refs/heads/main.lock`, `.git/HEAD.lock`. Normal `git add`/`commit` fail with "index.lock File
exists". Commit workaround: `GIT_INDEX_FILE=mnt/outputs/i git read-tree origin/main && GIT_INDEX_FILE=… git add <file>
&& TREE=$(… write-tree) && C=$(git commit-tree $TREE -p origin/main -m '…') && git push origin $C:refs/heads/main`.
The `Edit` file-tool can TRUNCATE files through the sync layer — prefer Write/python and verify `wc -l`.

## ⏸️ 2026-06-21 (auto, run 7) — NO ITEM PICKED. Offline queue triage (still authoritative).
Independently re-triaged every open item; none offline-completable:
- **R.7** Better-Stack — third-party signup + live URL + live takedown to verify.
- **18.2** chart drawing (interactive + persistence + visual + migration) · **18.3** light/dark (~58-component VISUAL
  refactor; split into 18.3a–g, verify each in browser preview) · **18.7** AI assistant (Claude API key + live DB +
  chat UI) · **18.8** manager panel (oversized — split into 18.8a… first; mostly visual/live).
- **21.1** admin audit (acceptance = live 200 on every `/api/admin/*`) · **21.7** KYC e2e (live upload + signed-URL
  image preview) · **21.11** credit bucket — "(optional)" PRODUCT decision · **21.12** depends on 21.14 → skip ·
  **21.14** account groups — "Large — design & scope as its own mini-phase first"; not autonomous.
- **PARKED** (5.3 / 8.1 / 9.3 / 9.4 / 10.1–10.6 / 20.2) — externally gated; resume only on explicit user say-so.
- NB: `- [ ] **Files:**` sub-bullets under 21.8–21.10/21.13/21.15/21.16/22.1 are a formatting quirk under a `- [x] Done`
  first line — NOT open items. Phase 22 has only 22.1 (done).

## ⏸️ Runs 3–6 (2026-06-20 / 06-21) — all NO ITEM PICKED (offline queue drained, github-only egress). No code/deploy.

## ✅ 2026-06-20 (auto) — 22.1 DONE (expanded achievements catalogue). Pushed to main.
`server/src/lib/achievements.ts`: +15 badge codes (total 22). Wired fire-and-forget in `orders.ts`, `robots.ts`,
`auth.ts`. NO migration, NO client change. New `server/test/achievements.test.ts`; tsc clean, `npm test` 255 passing.
PENDING LIVE VERIFY: unlock badges, confirm render.

## ✅ 2026-06-19 (auto) — 21.16 DONE (operator broadcast / notify). Pushed to main.
`POST /api/admin/notify` (admin-only): zod title/body/audience. Inserts one `notifications` row per recipient +
best-effort `sendPushBatch`. `lib/api.adminNotify`, `app/admin/notify.tsx`, nav tile. New test (8). tsc clean,
