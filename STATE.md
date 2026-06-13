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
`cat` it over `.git/index`). NB: `.git/packed-refs` also has a stale `refs/heads/main` (8beb509);
the **loose** ref wins, so always overwrite the loose `.git/refs/heads/main`.

## ⚠️ DO NOT edit code files with the Edit/Write file tools — use bash/python
Editing `.tsx` via the Edit tool has produced files `tsc` rejected with bogus parse errors even
though the bytes looked clean. Make all repo code edits through bash/python heredoc or in-place
`open(...,'w')`, then verify with `npx --no-install tsc --noEmit` before committing. (.md files are
fine via Edit/Write — no compile step.)

## ⏭️ 2026-06-13 00:48 UTC (auto) — No-op: precheck fails (deploy targets unreachable, no CLIs). Tree CLEAN.
Tree is clean (only STATE.md dirty — this handoff). HEAD `061a381`, branch main, up to date with
origin/main. The 06-11/06-12 source-file corruption is gone and the dirty-tree block is resolved.

Re-probed the env (didn't trust notes): `curl` to railway `/health` → **000**, vanta-jade.vercel.app
→ **000**, github.com → **200** (control passes, so egress works only for allowlisted domains).
`which railway vercel` → neither installed (only python3/node/npx/git). Client `tsc --noEmit` ran
clean. The TODO header makes the two live-URL curls a MANDATORY precheck and `railway up`/
`vercel --prod` a mandatory step — both impossible here. Per "if any precheck fails, do not start a
task" I picked nothing, committed nothing, changed nothing but this note. No fabrication, no blind
ship. Topmost actionable item remains **18.10** — fully scoped in the entry below; a networked run
can execute it fast.

### 18.10 — persist risk acceptance server-side (topmost unchecked, pure code, migration 028 applied)
Current state: acceptance is AsyncStorage-only. `components/RiskDisclosureModal.tsx` writes
`vanta:risk_ack` (deposit gate, used by `app/deposit.tsx`) and `vanta:risk_ack_trade` (trade gate,
used by `app/(tabs)/trade.tsx`) via `acknowledgeRisk(key)`. Nothing hits the server. The
`profiles.risk_accepted_at timestamptz` column exists (028 applied per prior note).
EXACT changes for the next run:
1. **Server** `server/src/routes/account.ts` (mounted at `/api/account`; already has `GET /profile`
   returning the full profile row incl. `risk_accepted_at`, and `PUT /notification-prefs` as a
   pattern to copy): add `POST /risk-accept` → `authUser(req.headers.authorization)`; if null 401;
   `supabaseAdmin.from('profiles').update({ risk_accepted_at: new Date().toISOString() })
   .eq('id', userId).select('risk_accepted_at').single()`; return `{ risk_accepted_at }`.
2. **Client** `lib/api.ts`: add `acceptRiskServer()` POST to `/api/account/risk-accept`
   (copy an existing authed POST helper for the base-URL + bearer pattern).
3. **Client** `components/RiskDisclosureModal.tsx` `handleAccept`: after `acknowledgeRisk(ackKey)`,
   also `void acceptRiskServer().catch(()=>{})` — best-effort, must NOT block the UX.
4. **Client app start** (`app/_layout.tsx`, after the session is set — same place push-token/prefs
   hydrate): GET `/api/account/profile`; if `profile.risk_accepted_at != null`, set BOTH
   AsyncStorage keys (`vanta:risk_ack`, `vanta:risk_ack_trade`) to `'1'` so acceptance survives
   device changes (the "existing users go straight through" acceptance criterion).
5. **Server test** `server/test/account.test.ts` (extend if it exists, else new, hermetic
   supabaseMock — see `server/test/helpers/supabaseMock.ts`): assert `POST /risk-accept` 401s
   without auth, and with auth writes `risk_accepted_at` + returns it.
Verify offline: client `npx --no-install tsc --noEmit`; `cd server && npx --no-install tsc
--noEmit && npm test`. Then DEPLOY: `cd server && railway up --detach` (new route) +
`cd .. && vercel --prod --yes`. Live-verify: accept on device A → confirm `profiles.risk_accepted_at`
set → open fresh browser B → trade gate passes without re-accepting.

After 18.10, the next pure-code item is **18.6** (share_trades 403 + Profile Privacy toggle;
migration 027 applied). 18.2/18.3 (above 18.10) stay BLOCKED for offline auto-runs (interactive +
visual). 18.7/18.8 blocked (network / oversized).

⚠️ CARRIED DEPLOY DEBT (still NOT live): 19.1 ($ amount sizing) + 20.3 (trade risk gate) are
committed but never deployed/verified. Next networked run: `vercel --prod --yes` then browser-check.
Both client-only — no Railway deploy needed.

TO UNBLOCK auto-runs (user action): give the sandbox egress to the railway/vercel/supabase domains
+ install the deploy CLIs. That alone unblocks 18.10, 18.6, the 19.1/20.3 deploy debt, and 19.2
live verification.

## Earlier (pruned)
- 2026-06-12 (auto): three runs — two SKIPPED on a dirty tree (9 modified code files with large
  deletions, suspected truncation/CRLF corruption, not my edits) and one no-op (offline env). All
  resolved: tree is clean again as of this run (user restored or committed).
- 2026-06-11 (auto): SKIPPED (corrupted-source dirty tree, since resolved) + 18.11 finished by user.
- 2026-06-09/10 (auto): 19.1 + 20.3 completed client-only & committed (NOT deployed — see debt
  above); other runs no-op (all remaining items blocked offline). `SUPABASE_PAT` is in `server/.env`.
- 2026-06-08: 20.1 (risk disclosure web scroll-lock) committed ff1436d.

## Untracked cruft the mount cannot delete (ignore; never `git add`)
`.sync_probe_18_1.txt`, `.write_probe_tmp`, `STATE.regen.md`, `TODO.regen.md`,
`components/pro/OrderEntry.fresh.tsx`, `components/pro/SymbolPickerModal.regen.tsx`,
`server/src/routes/_state_entry_18_12.md`, `server/src/routes/orders.regen.ts`,
`server/src/routes/transactions.regen.ts`, plus prior probe leftovers under `.git/`. The user can
`rm` these from Windows.
