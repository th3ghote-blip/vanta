# STATE -- handoff notes for the next agent

## ⚠️ READ THIS FIRST — Vercel git-author block
Set this BEFORE the first commit every session:
```bash
git config user.email "229847808+th3ghote-blip@users.noreply.github.com"
git config user.name "th3ghote-blip"
```

## ⚠️ WSL mount permission wall (persistent)
The mounted repo CANNOT:
- unlink/remove ANY file (`rm` → "Operation not permitted"), incl. `.git/index.lock`.
- reliably create loose objects under `.git/objects/` (`git add`/`commit` warn "unable to unlink
  tmp_obj" and may not persist).
You CAN: read via git; **overwrite existing working-tree files in place** (`>` truncates the same
inode); **create files inside the existing `.git/objects/pack/` dir**; overwrite
`.git/refs/heads/main` and `.git/index` in place. Commits therefore use the **pack workaround**
(clone the mount to /tmp, commit there, `git pack-objects --revs` the new objects only, copy the
`.pack`/`.idx` into the mount's existing `.git/objects/pack/`, overwrite `refs/heads/main` with the
new sha, and rebuild `.git/index` via `GIT_INDEX_FILE=/tmp/... git read-tree <sha>` then
`cat` it over `.git/index`). This run used exactly that and left `git status` clean.
NB: `.git/packed-refs` also has a stale `refs/heads/main` (8beb509); the **loose** ref wins, so
always overwrite the loose `.git/refs/heads/main`.

## ⚠️ DO NOT edit code files with the Edit/Write file tools — use bash/python
Editing `.tsx` via the Edit tool has produced files `tsc` rejected with bogus parse errors even
though the bytes looked clean. Make all repo code edits through bash/python heredoc or in-place
`open(...,'w')`, then verify with `npx --no-install tsc --noEmit` before committing. (.md files are
fine via Edit/Write — no compile step.)

## ⏭️ 2026-06-09 (auto) — No-op run: all remaining items blocked under this env
Picked nothing. Verified every unchecked, non-PARKED item is un-completable AND un-verifiable in
this run's environment, so per the hard rules I did NOT fabricate work or ship a blind refactor.
No code changed; only this STATE.md entry.

ENV FINDING (more precise than past "no network" notes): this run DID have general internet
(github.com → 200, api.anthropic.com → 404=reachable) BUT all three VANTA domains return 000 on
repeated tries — `vanta-server-production.up.railway.app`, `vanta-jade.vercel.app`,
`auavcfwytrwurawcvrsc.supabase.co` (REST too). Likely an egress allowlist, not infra downtime.
Also: neither `railway` nor `vercel` CLI is installed (only python3). Net effect = cannot deploy,
cannot apply migrations, cannot live/visually verify. `SUPABASE_PAT` IS present in server/.env.

REMAINING ITEMS — why each is blocked here (re-confirmed):
- R.7 Better-Stack → external signup (user). 18.2 chart-drawing → migration + interactive/visual
  + multi-hour. 18.3 light/dark → confirmed 58/60 files import static dark `colors`, only 1 uses
  `useThemeColors()`; full hook refactor is multi-hour and acceptance is visual-only (unsafe to
  ship blind — tsc can't catch a missed token). 18.6 share-trades → migration (Supabase
  unreachable). 18.7 AI assistant → Railway backend unreachable + multi-page UI + live verify.
  18.8 manager panel → oversized, must be split first. 18.10 risk-accept → migration + visual.
  18.11 share-to-X → new dependency + user decision + X-web platform limit. 19.2 robots E2E →
  pure live verification vs unreachable Vercel/Railway. 20.2 PARKED. Phase 17 optional/future.

TO UNBLOCK (pick any, for the user or a future run): (1) grant the sandbox egress to the
railway/vercel/supabase domains + install the deploy CLIs → unblocks 19.2 verify, 18.7, and the
deploy of already-committed-but-undeployed work (19.1, 20.3); (2) run on a screenshot-capable
host → unblocks 18.3 / 18.2 visual acceptance; (3) pre-apply the 18.6 / 18.10 migrations via
`scripts/apply-migration.py` (PAT is in server/.env); (4) split 18.8 into per-page sub-items;