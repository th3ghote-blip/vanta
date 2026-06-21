# STATE -- handoff notes for the next agent

## ⏸️ 2026-06-21 (auto, run 9) — NO ITEM PICKED. 9th consecutive no-op. Offline queue still drained.
Independently re-triaged from the TODO header rules (NOT just trusting prior STATE). Verified this run:
- **Tree clean enough to work:** only `STATE.md` is dirty (run-managed handoff). The run-8 `rateLimit.test.ts`
  NUL-corruption is **GONE** — file is back to the known-good 4119 bytes and git shows it unmodified. No action needed.
- **Egress is still github-only.** curl: `github.com`→200, `api.anthropic.com`→404 (reachable). BUT
  `api.supabase.com`→**000 + no DNS**, `vanta-jade.vercel.app`→**000**. So the TODO header's claim that the Supabase
  Management API is allowlisted does NOT hold in this sandbox — **migrations cannot be applied here.**
- **Every open item is blocked for a safe offline auto-run** (CI auto-deploys to prod on push, and I cannot
  screenshot, hit the live API, or apply migrations — so tsc+unit-tests alone can't make a visual/live change safe):
  - **18.2** chart drawing — interactive + persistence + visual; needs `026` migration live + screenshot. Multi-hour.
  - **18.3** light/dark — ~58-component VISUAL refactor; a missed token = broken prod render, unverifiable offline.
    Recommend an **interactive** run that splits it into 18.3a–g and verifies each in browser preview.
  - **18.7** AI assistant — needs Claude API key + live DB + multi-page chat UI; network-gated + large.
  - **21.1** admin audit — acceptance is literally "live 200 on every `/api/admin/*`"; needs live Railway+admin token.
  - **21.7** KYC e2e — live upload + signed-URL image preview; visual.
  - **21.11** credit bucket — **"(optional)" PRODUCT DECISION** (do you want a credit/bonus concept? y/n) + needs a
    migration applied live. Per the autonomous rules I do not make product calls — left unchecked.
  - **21.12** stop-out level — depends on 21.14 → skip.
  - **21.14** account groups — "Large — design & scope as its own mini-phase first"; not a 60-min autonomous item.
  - **R.7** Better-Stack — third-party signup + live URL; externally gated.
  - **PARKED** (5.3 / 8.1 / 9.3 / 9.4 / 10.1–10.6 / 20.x) — externally gated; resume only on explicit user say-so.
  - NB: `- [ ] **Files:**` / `**What:**` sub-bullets under `- [x] Done` items (18.6, 18.10, 18.11, 21.8–21.10,
    21.13, 21.15, 21.16, 22.1, etc.) are a formatting quirk — NOT open items.
- All genuinely non-visual, fully-offline-verifiable build items have already been shipped (21.9/21.10/21.13/21.15/
  21.16/22.1). What remains is the hard residue: live-only, visual, large, or product-decision. **I did not fabricate
  work or risk a blind visual deploy to production.**

**⚠️ ACTION FOR THE USER — 9 runs with no safe offline work.** To unblock, ONE of:
(a) an **interactive / network-enabled run** (unblocks 18.2, 18.3 split, 18.7, 21.1, 21.7 AND applies migration 031);
(b) a **product decision** on **21.11** (credit/bonus bucket — yes/no?);
(c) **scope/split** 21.14 (account groups) or 18.3 (into 18.3a–g) into bounded sub-items;
(d) unpark an external item (custom domain, mobile builds, Better-Stack, Sumsub, OANDA).

**CARRIED-OVER PENDING — migration 031** (`031_account_last_seen.sql`, for already-shipped 21.13) still NOT applied
(Supabase unreachable). Until applied, `/api/admin/online` 500s live and `accounts.last_seen` writes are swallowed
no-ops. Apply on the next network run:
`SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/031_account_last_seen.sql`

**ENV GOTCHAS (carried):** `.git/index.lock` is STUCK & un-`rm`-able (sync-layer owned, "Operation not permitted"), so
plain `git add`/`commit` fail with "index.lock File exists". Commit workaround used this run:
`GIT_INDEX_FILE=/tmp/i git read-tree origin/main && GIT_INDEX_FILE=/tmp/i git add <file> &&
TREE=$(GIT_INDEX_FILE=/tmp/i git write-tree) && C=$(git commit-tree $TREE -p origin/main -m '…') &&
git push origin $C:refs/heads/main`. Prefer Write/python over the `Edit` file-tool (it can truncate via the sync
layer); always verify with `wc -l`.

## ⏸️ 2026-06-21 (auto, run 8) — NO ITEM PICKED. Dirty tree was NUL-byte corruption of `rateLimit.test.ts` (sync-layer,
not a user edit), since self-healed. Offline queue drained. Network github-only.

## ⏸️ 2026-06-21 (auto, run 7) — NO ITEM PICKED. Full offline-queue triage (superseded by run-9 triage above).

## ⏸️ Runs 3–6 (2026-06-20 / 06-21) — all NO ITEM PICKED (offline queue drained, github-only egress). No code/deploy.

## ✅ 2026-06-20 (auto) — 22.1 DONE (expanded achievements catalogue). Pushed to main.
`server/src/lib/achievements.ts`: +15 badge codes (total 22), wired fire-and-forget in `orders.ts`/`robots.ts`/
`auth.ts`. No migration, no client change. tsc clean, `npm test` 255 passing. PENDING LIVE VERIFY: unlock + render.

## ✅ 2026-06-19 (auto) — 21.16 DONE (operator broadcast / notify). Pushed to main.
`POST /api/ad