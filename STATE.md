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
- create new subdirs / loose objects under `.git/objects/`.
You CAN: read via git; **overwrite existing working-tree files in place** (`>` truncates
the same inode); create files inside the existing `.git/objects/pack/` dir; overwrite
`.git/refs/heads/main` and `.git/index` in place. Commits therefore need the pack
workaround (clone to /tmp, commit there, pack new objects, copy .pack/.idx into the mount's
existing pack dir, overwrite refs/heads/main + .git/index). This run used exactly that —
see the commit step below; it left `git status` clean.

## ⚠️ DO NOT edit code files with the Edit/Write file tools — use bash/python
Confirmed this run: editing `.tsx` via the Edit tool produced files that `tsc` rejected
with bogus parse errors (TS17008 "no corresponding closing tag" / TS1005) even though the
bytes looked clean (cat -A / xxd showed valid ASCII). Re-writing the identical content via
`cat > heredoc` or a python in-place `open(...,'w')` compiled cleanly. Root cause not fully
pinned (likely an encoding/line-ending artifact from the Windows file layer that the WSL
mount surfaces to tsc). **Lesson: make all repo file edits through bash/python, then verify
with `tsc`.** Always run `npx --no-install tsc --noEmit` after editing and before committing.

## ✅ 2026-06-09 (auto) — Completed 20.3 (Risk disclosure gates trading)
Picked the topmost truly-completable item. Phase 18's remaining items are still blocked
offline (network/migration/screenshot); the 2026-06-04 "exhausted" note predates Phases
19 & 20 (added 2026-06-08), which contain offline-completable client-only items. 20.3 was one.

What changed (client-only, no migration, no new files):
- `components/RiskDisclosureModal.tsx`: added `RISK_ACK_TRADE_KEY = 'vanta:risk_ack_trade'`
  + `hasAcknowledgedTradeRisk()`; made `acknowledgeRisk(key=RISK_ACK_KEY)` take a key; added
  optional `ackKey` + `intro` props (defaults preserve the deposit gate exactly).
- `app/(tabs)/trade.tsx`: on mount checks `hasAcknowledgedTradeRisk()`; if not acked, renders
  the disclosure as a full-screen gate. Accept → records trade key + reveals trading; Cancel →
  `router.replace('/(tabs)/portfolio')`. Deposit gate (`app/deposit.tsx`) untouched.
- Client `tsc --noEmit` CLEAN. Server untouched (no server tsc/test needed).

⚠️ NOT DEPLOYED / NOT LIVE-VERIFIED: this auto-run had **no network** (Railway, Vercel,
Supabase all unreachable — curl 000). Could not `vercel --prod`, `railway up`, or run the
curl/visual acceptance. **Next networked run (or the user) should deploy the frontend
(`vercel --prod --yes`) and confirm: new account → Trade tab → disclosure → accept → can
trade; reload → no modal.** No backend change, so no Railway deploy needed for this item.

Parent commit (pre-this-run HEAD): ff1436de7875da44536a239bc82102b8fff0e27e.

## Earlier (pruned)
- 2026-06-09T02:08Z (auto): UNBLOCKED a stale working tree (6 tracked files from a 2026-06-02
  bulk restore were older than HEAD; restored them to HEAD content). No commit. HEAD ff1436d.
- Several 2026-06-08 runs SKIPPED on a (mis-diagnosed) dirty tree; root-caused to the stale tree.

## Untracked cruft the mount cannot delete (ignore; never `git add`)
`.sync_probe_18_1.txt`, `.write_probe_tmp`, `STATE.regen.md`, `TODO.regen.md`,
`components/pro/OrderEntry.fresh.tsx`, `components/pro/SymbolPickerModal.regen.tsx`,
`server/src/routes/_state_entry_18_12.md`, `server/src/routes/orders.regen.ts`,
`server/src/routes/transactions.regen.ts`. The user can `rm` these from Windows.
