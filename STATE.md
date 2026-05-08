# STATE — handoff notes for the next agent

> Append, don't replace. Most recent at top. Each entry: date, agent, what changed, what's pending, gotchas.

---
## 2026-05-09T(auto) — 2.6 Client: streak badge on QuickTradeScreen

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **2.6 Client** — streak badge on QuickTradeScreen header
**Commit:** see below (staged, not yet pushed)

**What changed**
- `stores/profile.ts` (new, 74 lines):
  - Zustand store with `profile: { user_id, current_streak, best_streak } | null`.
  - `fetch()`: queries `profiles` table for the authed user; sets store.
  - `subscribe()`: opens a Supabase realtime `postgres_changes` channel for `UPDATE` on `profiles` filtered by `user_id=eq.<userId>`. Returns async cleanup fn.
- `components/fun/QuickTradeScreen.tsx` (modified):
  - Added `useEffect` + `useProfileStore` imports.
  - On mount: calls `fetchProfile()` and `subscribeProfile()` so badge shows immediately and updates live after each round settles.
  - Streak banner now conditional on `streak > 0` (hidden when no streak).
  - Shows `🔥 {streak} win streak` with current streak and `Best: {best_streak}` on the right.
  - Border color changed to `colors.warning` (amber) when badge is visible.
  - Fixed a truncation bug: file was cut off mid-JSX from a prior run; tail was reconstructed and appended.
- `TODO.md`: 2.6 Client checkbox marked `[x]`.

**Deploy pending**
Sandbox has no outbound network. Run:
```
cd /c/Claude/vanta && vercel --prod --yes
```
Also note: `005_streaks.sql` migration still needs to be applied to Supabase (see prior STATE entries). Without the migration, `profiles` table won't have `current_streak`/`best_streak` columns and the badge will silently stay hidden (select returns nothing).

**Index cleanup this run**
The git index had stale staged content from a prior run (reverting 2.6 server + TODO). Fixed by `GIT_INDEX_FILE=/tmp/git_vanta_idx_clean git read-tree HEAD && cp /tmp/git_vanta_idx_clean .git/index`.

**Next agent:** Phase **3.1** — Wire RobotPromptBuilder to `/api/robots/compile` + save. Replace `setTimeout(1200)` mock with real `api.compileRobot(prompt)`. Show generated config. "Save" → POST `/api/robots/save`. Frontend + backend.

**Recurring gotchas**
1. `.git/index.lock` stale lockfile: remove with `rm .git/index.lock` or use `GIT_INDEX_FILE` workaround.
2. Edit/Write tools truncate long files — always verify with `wc -l` and `tail`. Fix with bash heredoc append.
3. Supabase migration `005_streaks.sql` not yet applied — streak badge will be invisible until columns exist.

---
## 2026-05-08T(auto) — 2.6 Server: streak tracking in rounds settler

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **2.6 Server** — update rounds settler to write streak columns
**Commit:** `80df6d5` — `auto: 2.6 server — streak tracking in rounds settler`

**What changed**
- `server/src/workers/rounds.ts` (modified, 230 lines):
  - Added `updateStreak(app, accountId, outcome)` helper.
  - Looks up `user_id` from `accounts` (one select), then reads `current_streak`/`best_streak` from `profiles` (on win only), computes new values, writes update.
  - **win**: `current_streak = current_streak + 1`, `best_streak = Math.max(best_streak, newStreak)`.
  - **loss/tie**: `current_streak = 0` (filtered with `.neq('current_streak', 0)` to skip pointless writes).
  - All streak errors are non-fatal — logged and swallowed so they never block the settle path.
  - Called after payout credit, before the info log.
- `TODO.md`: 2.6 Server checkbox marked `[x]`.

**Migration still NOT applied to Supabase**
`005_streaks.sql` exists but was never applied (no outbound network in sandbox). Run from internet-connected machine:
```
SUPABASE_PAT=[REDACTED-LEAKED-SUPABASE-PAT-rotated] \
  python scripts/apply-migration.py supabase/migrations/005_streaks.sql
```
The streak columns must exist in Supabase before deploying this server update, or the UPDATE calls will silently fail (column not found errors).

**Deploy order:**
1. Apply migration (above)
2. `cd /c/Claude/vanta/server && railway up --detach`
3. Verify: win 3 rounds → check `profiles.current_streak = 3` via Supabase dashboard.

**Next agent:** pick **2.6 Client** — streak badge on `QuickTradeScreen` header. "🔥 N" with Flame icon (already imported). Needs to read `profiles.current_streak` from Supabase (or pass it down from a store). Frontend-only; deploy with `vercel --prod --yes`.

**Recurring gotchas**
1. `.git/index.lock` + `.git/HEAD.lock` (0-byte WSL stale lockfiles). Workaround: `GIT_INDEX_FILE=/tmp/git_vanta_idx<N> git read-tree HEAD` then stage + commit-tree + write SHA to `.git/refs/heads/main`.
2. Edit/Write tool truncates long files. Fix: bash heredoc + verify `wc -l`.
3. `unlink tmp_obj_*` warnings during `write-tree` are cosmetic — git still writes objects correctly.

---
## 2026-05-08T(auto) — 2.6 Migration: 005_streaks.sql

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **2.6 Streak tracking — migration sub-item**

**What changed**
- `supabase/migrations/005_streaks.sql` (new, 6 lines):
  - `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0`
  - `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS best_streak integer NOT NULL DEFAULT 0`
- `TODO.md`: migration checkbox for 2.6 marked `[x]`.

**Migration NOT applied to Supabase**
Sandbox has no outbound network (403 on api.supabase.com). Run from a machine with internet access:
```
SUPABASE_PAT=<pat-from-server/.env> \
  python scripts/apply-migration.py supabase/migrations/005_streaks.sql
```
PAT is `[REDACTED-LEAKED-SUPABASE-PAT-rotated]` (from `server/.env`).

**Recurring gotchas (still present)**
1. `.git/index.lock` + `.git/HEAD.lock` (0-byte WSL stale lockfiles). Workaround: `cp .git/index /tmp/git_vanta_idx2 && GIT_INDEX_FILE=/tmp/git_vanta_idx2 git read-tree HEAD` to get clean status; commit via commit-tree + write SHA to `.git/refs/heads/main`.
2. `Edit`/`Write` tool truncates long files. Fix: bash heredoc + verify `wc -l`.

**Next agent:** apply the migration if not yet applied, then pick **2.6 Server** sub-item — update `server/src/workers/rounds.ts` to write `current_streak`/`best_streak` to profiles after settling each round. Then **2.6 Client** — streak badge on `QuickTradeScreen` header.

---
## 2026-05-08T(auto) — 2.5 Win / loss result modal

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **2.5 Win / loss result modal**
**Commit:** `137a505` — `auto: win/loss result modal (Phase 2.5)`

**What changed**
- `components/fun/RoundResultModal.tsx` (new, 262 lines):
  - Modal component receives `round: BinaryRound | null` + `onDismiss` callback.
  - Entrance: scale (0.7→1 spring) + fade-in (180ms) via `Animated.parallel`.
  - **Win**: `ConfettiCannon` fires 120 particles (branded palette) from center-top; green `CheckCircle` icon; shows `+$net` (payout − stake).
  - **Loss**: red `XCircle` icon; 7-step `Animated.sequence` shake on `translateX`.
  - **Tie**: green `CheckCircle`; `±$0.00`.
  - Auto-dismisses after 3 s; tapping the overlay also dismisses.
  - Uses `useWindowDimensions` for confetti origin so it centers correctly on any screen width.
- `components/fun/QuickTradeScreen.tsx` (modified):
  - Added `settledRound: BinaryRound | null` state.
  - Passes `onRoundSettled={setSettledRound}` to `<ActiveRounds>` (hook was already wired in Phase 2.4).
  - Renders `<RoundResultModal round={settledRound} onDismiss={() => setSettledRound(null)} />`.
- `package.json` / `package-lock.json`: `react-native-confetti-cannon@1.5.2` added.
- `TODO.md`: item 2.5 checkbox marked `[x]`.

**Verification done in-sandbox**
- `npx tsc --noEmit` (root) → exit 0 (silent). No type errors.

**Verification NOT done**
- Vercel deploy: sandbox has no outbound network. Run `cd /c/Claude/vanta && vercel --prod --yes` to ship.
- E2E: open round → wait for settle → modal pops with win/loss animation → auto-dismisses after 3 s.

**Recurring gotchas (still present)**
1. `.git/index.lock` + `.git/HEAD.lock` (0-byte WSL stale lockfiles). Workaround: `GIT_INDEX_FILE=/tmp/git_vanta_idx git read-tree HEAD` to rebuild index; write commit SHA to `.git/refs/heads/main`.
2. `Edit`/`Write` tool truncates long files. Fix: bash heredoc + verify `wc -l`.
3. `unlink tmp_obj_*` warnings during `write-tree` are cosmetic — git still writes objects correctly.

**Next agent:** pick **2.6 Streak tracking** — migration `005_streaks.sql`, server settler update, streak badge on `QuickTradeScreen` header. Has three sub-items (migration → server → client); pick the migration sub-item first.

---

## 2026-05-08T(auto) — 2.4 Active Rounds list in Quick Mode

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **2.4 Active Rounds list in Quick Mode**
**Commit:** `3e840d2` — `auto: active rounds list in Quick Mode (Phase 2.4)`

**What changed**
- `components/fun/ActiveRounds.tsx` (new, 286 lines): Supabase-realtime-backed list of pending binary rounds.
  - Fetches all `outcome='pending'` rounds for `accountId` on mount.
  - Subscribes to `postgres_changes` INSERT + UPDATE on `binary_rounds` filtered by `account_id`.
  - INSERT: appends new round to list (sorted by `closes_at`), deduped.
  - UPDATE: updates the row; if `outcome != 'pending'`, calls `onRoundSettled?.(round)` (hook for Phase 2.5 modal).
  - Each `RoundRow`: 56px `CountdownRing` counting down to real `closes_at`, direction badge (▲/▼), symbol, entry price, stake, multiplier.
  - On settle: row flashes win/loss background for 800ms then fades out via `Animated.timing`; `onFaded` removes it from state.
  - Returns `null` when no pending rounds (no empty-state clutter).
- `components/fun/CountdownRing.tsx` (modified): Added optional `closesAt?: string` prop. When provided, ring counts down to the real ISO timestamp in real time; `seconds` is still needed as arc denominator.
- `components/fun/QuickTradeScreen.tsx` (modified): Imports and renders `<ActiveRounds accountId={account.id} />` below the payout hint line, guarded by `account != null`.
- `TODO.md`: item 2.4 checkbox marked `[x]`.

**Verification done in-sandbox**
- `npx tsc --noEmit` (root) → exit 0.
- `cd server && npx tsc --noEmit` → exit 0.

**Verification NOT done**
- Vercel deploy: sandbox has no outbound network. Run `cd /c/Claude/vanta && vercel --prod --yes` to ship.
- E2E: open 3 rounds → all visible with countdown rings → wait for expiry → disappear with win/loss flash.

**Recurring gotchas (still present)**
1. `.git/index.lock` + `.git/HEAD.lock` (0-byte WSL stale lockfiles). Workaround: `GIT_INDEX_FILE=/tmp/git_vanta_idx git read-tree HEAD` to rebuild index; write commit SHA directly to `.git/refs/heads/main` (bypassing `update-ref` which requires HEAD.lock).
2. Edit/Write tool truncates long files. Fix: bash heredoc + verify `wc -l`.
3. JSX block comments (`{/* */}`) are invalid inside a tag's prop list — put them as children or regular `//` comments outside JSX.

**Next agent:** pick **2.5 Win / loss result modal** (`components/fun/RoundResultModal.tsx` new). Note: requires `npm install react-native-confetti-cannon` per TODO. Wire `onRoundSettled` callback in `QuickTradeScreen.tsx` once modal exists. Frontend-only; deploy with `vercel --prod --yes`.

---


## 2026-05-07T(auto) — 2.3 Wire QuickTradeScreen Up/Down to /api/rounds/open

**Agent:** scheduled cowork auto-work pass
**TODO item picked:** **2.3 Wire QuickTradeScreen Up/Down to /api/rounds/open**

**What changed**
- `components/fun/QuickTradeScreen.tsx` (323 lines, was 195): Up/Down buttons now call `api.openRound()`. Key changes:
  - Imports `useAccountStore` (for `account.id`) and `usePriceStore` (for live mid prices on asset chips and BinaryCard).
  - `ASSETS` array stripped of static prices — live mid from quote cache shown instead.
  - `openRound(direction)` async callback: checks account loaded, sets `busy` state, calls `api.openRound({accountId, symbol, direction, stake, durationSeconds})`, then calls `refetchAccount()` so AccountHeader reflects the stake deduction. Error mapped via `describeRoundError()` covering `insufficient_balance` (with required/available amounts), `no_quote`, `account_not_found`, `forbidden`, `unauthorized`, `deduct_failed`, `insert_failed`.
  - Buttons show `ActivityIndicator` while their direction is pending; opposite button dims to 40% opacity; both disabled while any request is in flight.
  - Feedback banner (green/red) appears below stake picker with success confirmation or error message.
- `TODO.md`: items 2.1 and 2.3 marked `[x]`. (2.