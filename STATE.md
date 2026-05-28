# STATE -- handoff notes for the next agent

## ⚠️ READ THIS FIRST — Vercel git-author block

Every session must set this BEFORE the first commit:
```bash
git config user.email "229847808+th3ghote-blip@users.noreply.github.com"
git config user.name "th3ghote-blip"
```

## ⚠️ Git object write workaround (persistent)

The WSL-mounted `.git/objects/` dir will NOT create new subdirectories
or write new loose objects directly. The stale `tmp_obj_*` files in `9d/`
and `0b/` cannot be removed (Operation not permitted).

**Commit workflow that works:**
1. Clone the repo into `/tmp/vanta_staging`
2. Set git config in the staging clone
3. Make changes, `git add`, `git commit` in staging
4. `git pack-objects /tmp/missing_objs` for objects not in existing dirs
5. Copy the resulting `.pack` + `.idx` to `.git/objects/pack/`
6. Update `.git/refs/heads/main` (loose ref, takes precedence over packed-refs)

See the 16.3 run (2026-05-25) for the exact Python+bash sequence.

---

## 2026-05-28T~auto — 18.13 Trade row density fix

**TODO item picked:** **18.13 Trade row density — text too small, too many lines**

**Pre-run state**
- Git index had stale staged state from prior 18.9 run (index.lock unremovable, known WSL issue).
- Working tree matched HEAD (`git diff HEAD` was clean). Proceeded normally.
- Client tsc: exit 0 ✅

**What changed**
- `components/pro/TradeBook.tsx`:
  - Header: removed "Open → Now" column; now "Symbol / Side" (flex 2) + "P&L" (flex 1) + 72px spacer.
  - TradeRow main row:
    - Left section (flex 2): line 1 = symbol (15px bold) + coloured side badge (9px) + volume (10px mono); line 2 = open→current price + time ago (11px mono).
    - Removed notional/leverage/margin line from default view entirely.
    - SL/TP hint kept but downsized to 9px (only shows when set).
    - Note preview kept but downsized to 9px, prefixed with ✎.
    - P&L column: fixed width 72px, fontSize 18px bold — now the most visually dominant element.
    - minHeight: 56 on each row for consistent density.
    - All 7 action buttons: 28px → 32px, icon sizes bumped to 14-15px.
  - Removed unused `notionalUSD` import.
- `TODO.md`: 18.13 marked [x].

**Verification**
- `npx --no-install tsc --noEmit`: exit 0 ✅
- Vercel deploy: sandbox DNS blocked (expected) — GitHub Actions will deploy on push.

**⚠️ Persistent issues (same as before)**
- index.lock is unremovable — always use staging clone workflow.
- Edit/Write tools do NOT write through to the WSL mount. Always use Python `open(..., 'w')` for file writes.
- refs/heads/main may get a stray warning line prepended — fix before commits.

**Next agent picks (in priority order)**
- **18.1** Order entry simplification — `components/pro/OrderEntry.tsx` — pure frontend
- **18.4** Forex/stock price feed — Option C (hide empty categories) is 10-min cosmetic fix, then Option A (yahoo-finance2)
- **18.3** Light/dark mode fix — audit components using hardcoded dark hex, replace with theme tokens
- **18.5** Robot engine unit tests — `server/test/robotEngine.test.ts` — test only, no deploy
- **18.10** Risk disclosure accept flow — frontend + possible migration
- **18.11** Share to X — lib/shareCard.ts + TradeBook button
- **18.12** Security audit — server routes audit + docs/security-audit.md
- **18.2** Chart drawing tools overhaul — significant scope
- **18.6** Share my trades toggle — needs migration + backend + frontend
- **18.7** AI platform assistant — needs Anthropic key wired into backend
- **18.8** Manager panel — large; multiple new admin pages + endpoints
- **BetterStack R.7/13.3** — requires human signup.
- **Phase 10 items** — PARKED, require domain purchase.
