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

## ✅ 2026-06-09 (auto) — Completed 19.1 ($ amount / notional sizing mode)
Phase 18 offline items remain exhausted/blocked; 20.x done or PARKED; 19.1 was the topmost
unchecked, fully offline-completable (client-only, no migration, "no backend change needed").

What changed (client-only):
- `stores/prefs.ts`: added three-way `sizingMode: 'lots' | 'stake' | 'notional'` (source of
  truth, persisted to `vanta:prefs:sizingMode`) + `setSizingMode`. `spreadBet` is now a derived,
  synced convenience (`=== sizingMode==='stake'`); legacy `vanta:prefs:spreadBet` key still
  written and read as fallback in `hydrate`. Profile toggle + `_layout` hydrate unchanged.
- `components/pro/OrderEntry.tsx`: toggle is now **Lots · $/pt · $ amount**. `$ amount` mode:
  label → "$ amount", placeholder "e.g. 10000", lots computed live as
  `dollars / (mid × contractSize(symbol))` on keystroke / price tick / symbol change; summary
  leads with "~<qty> <BASE> · $<notional> · $<margin>". `volume` (lots) stays canonical → submit
  path untouched. `lib/contracts.ts` unchanged (reused `notionalUSD`/`contractSize`).
- Client AND server `tsc --noEmit` CLEAN. Conversion math unit-checked offline (BTC@75k:
  $10k→0.1333 lots; EURUSD/AAPL/XAU round-trip exactly).

⚠️ NOT DEPLOYED / NOT LIVE-VERIFIED: no network this run (Railway/Vercel/Supabase curl 000; no
vercel/railway CLI installed). Next networked run (or user): `vercel --prod --yes`, then confirm
in browser — switch to "$ amount", type 10000 on BTC → ~0.1333 lot count; place order opens;
switch symbol → lots recompute. No backend change → no Railway deploy needed.

Parent commit (pre-this-run HEAD): db811b279dc59de324d9ba9e86b681f697c808b2.

## Earlier (pruned)
- 2026-06-09 (auto): Completed 20.3 (risk disclosure gates trading) client-only; committed
  db811b2; NOT deployed (no network that run).
- 2026-06-08: 20.1 (risk disclosure web scroll-lock) committed ff1436d.

## Untracked cruft the mount cannot delete (ignore; never `git add`)
`.sync_probe_18_1.txt`, `.write_probe_tmp`, `STATE.regen.md`, `TODO.regen.md`,
`components/pro/OrderEntry.fresh.tsx`, `components/pro/SymbolPickerModal.regen.tsx`,
`server/src/routes/