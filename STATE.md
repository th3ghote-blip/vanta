# STATE -- handoff notes for the next agent

## ⏸️ 2026-06-22 (auto, run 10) — NO ITEM PICKED. 10th consecutive no-op. Offline queue still drained.
Independently re-triaged from the TODO header rules (did NOT just trust prior STATE). Verified this run:
- **Tree is NOT a user edit.** Only `STATE.md` shows modified, and it is **byte-identical to `origin/main:STATE.md`**
  (`diff` = IDENTICAL). The flag is only because local HEAD trails `origin/main` by 2 handoff commits (run 8, run 9).
  Safe to proceed.
- **Egress independently re-tested, still github-only.** curl: `github.com`→200, `api.anthropic.com`→404 (reachable).
  `api.supabase.com`→**000 + no DNS**, `supabase.com`→**no DNS**, `vanta-jade.vercel.app`→**000**,
  `vanta-server-production.up.railway.app`→**000**. So the TODO header's claim that the Supabase Management API is
  allowlisted does NOT hold in this sandbox — **migrations cannot be applied here, and nothing live/visual can be verified.**
- **Full section-level triage** (awk: sections with an open `- [ ]` and no `- [x]`) → every non-PARKED open item is
  blocked for a safe offline, no-screenshot auto-run (CI auto-deploys to BOTH prod on any push, so a partial/visual
  change pushed to `main` is a blind prod deploy):
  - **18.2** chart drawing — interactive + persistence + visual; needs `026` migration live + screenshot.
  - **18.3** light/dark — ~58-component VISUAL refactor; a missed token = broken prod render, unverifiable offline.
    Recommend an **interactive** run splitting it into 18.3a–g, verifying each in browser preview.
  - **18.7** AI assistant — needs Claude API key + live DB + multi-page chat UI; network-gated + large.
  - **18.8** manager panel — oversized (~8 admin pages + ~10 routes); split into 18.8a… sub-items first.
  - **21.1** admin audit — acceptance is literally "live 200 on every `/api/admin/*`"; needs live Railway + admin token.
  - **21.7** KYC e2e — live upload + signed-URL image preview; visual.
  - **21.11** credit bucket — **"(optional)" PRODUCT DECISION** (do you want a credit/bonus concept? y/n) + needs a
    migration applied live. Per the autonomous rules I do not make product calls — left unchecked.
  - **21.12** stop-out level — depends on 21.14 → skip.
  - **21.14** account groups — "Large — design & scope as its own mini-phase first"; not a 60-min autonomous item.
  - **R.7** Better-Stack — third-party signup + live URL; externally gated.
  - **PARKED** (5.3 / 8.1 / 9.3 / 9.4 / 10.1–10.6 / 20.2) — externally gated; resume only on explicit user say-so.
  - NB: `- [ ] **Files:**` / `**What:**` sub-bullets under `- [x] Done` items are a formatting quirk — NOT open items.
- All genuinely non-visual, fully-offline-verifiable build items are already shipped. The residue is live-only, visual,
  large, or a product decision. **Did not fabricate work or risk a blind visual deploy to production.**

**⚠️ ACTION FOR THE USER — 10 runs with no safe offline work.** To unblock, ONE of:
(a) an **interactive / network-enabled run** (unblocks 18.2, 18.3 split, 18.7, 21.1, 21.7 AND applies migration 031);
(b) a **product decision** on **21.11** (credit/bonus bucket — yes/no?);
(c) **scope/split** 21.14 (account groups) or 18.3 (into 18.3a–g) or 18.8 (into 18.8a…) into bounded sub-items;
(d) unpark an external item (custom domain, mobile builds, Better-Stack, Sumsub, OANDA).

**CARRIED-OVER PENDING — migration 031** (`031_account_last_seen.sql`, for already-shipped 21.13) still NOT applied
(Supabase unreachable). Until applied, `/api/admin/online` 500s live and `accounts.last_seen` writes are swallowed
no-ops. Apply on the next network run:
`SUPABASE_PAT=... python scripts/apply-migration.py supabase/migrations/031_account_last_seen.sql`

**ENV GOTCHAS (carried):** `.git/index.lock` is STUCK & un-`rm`-able (sync-layer owned, "Operation not permitted"), so
plain `git add`/`commit` fail with "index.lock File exists". Commit workaround:
`GIT_INDEX_FILE=/tmp/i git read-tree origin/main && GIT_INDEX_FILE=/tmp/i git add <file> &&
TREE=$(GIT_INDEX_FILE=/tmp/i git write-tree) && C=$(git commit-tree $TREE -p origin/main -m '…') &&
git push origin $C:refs/heads/main`. Prefer Write/python over the `Edit` file-tool (it can truncate via the sync
layer); always verify with `wc -l`. STATE-only (`**.md`) pushes do NOT trigger a deploy (deploy.yml `paths-ignore`).

## ⏸️ 2026-06-21 (auto, run 9) — NO ITEM PICKED. 9th no-op. Re-triaged from TODO header (not just prior STATE).
Egress github-only (`api.supabase.com`/Vercel/Railway = 000). Every open item live/visual/large/product-gated.
Migration 031 still unapplied. No code/deploy.

## ⏸️ 2026-06-21 (auto, run 8) — NO ITEM PICKED. Dirty tree was NUL-byte corruption of `rateLimit.test.ts` (sync-layer,
not a user edit), since self-healed. Offline queue drained. Network github-only.

## ⏸️ 2026-06-21 (auto, run 7) — NO ITEM PICKED. Full offline-queue triage (superseded by later triage ab