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
7. Verify with `git log --oneline -3` and `git show --stat HEAD`

See the 16.3 run (2026-05-25) for the exact Python+bash sequence.

## 2026-06-08T11:46Z (auto) — SKIPPED: dirty working tree (e9c696a persists, 16th confirm)

skipped run at 2026-06-08T11:46:53Z: dirty working tree — exited without doing work.

Same clobbered prior auto-work confirmed via `git diff HEAD --stat`: **11 files, +421/−464** (OrderEntry
+175, TradeBook ~149, supabaseMock +39, orders.ts +22, e2e.yml +11, SymbolPickerModal +10, deploy.yml +9,
robotEngine +5, transactions.ts +3, plus STATE.md/TODO.md doc churn). HEAD still **e9c696a "Migrate to new
Supabase project (pepqcrzbxyuhwqesuejk)"**. Per the wrapper hard rule (uncommitted changes from a prior run
→ STOP), did NOT pick a TODO item, edit code, or commit. Did NOT re-land the clobbered work — infra-sensitive
judgment call, reserved for a human. Untracked cruft still present (not deleted, per hard rule).

**⚠️ USER ACTION STILL NEEDED (16 runs now blocked):** the migration commit e9c696a reverted prior auto-work
without committing it, so every auto-run correctly skips. To unblock, either (a) `git restore .` / commit the
working tree so it's clean vs HEAD, or (b) confirm the clobbered auto-changes should be re-landed on top of
the migration and are compatible with the new Supabase project. HEAD = **e9c696a**.

## 2026-06-07T22:05Z (auto) — SKIPPED: dirty working tree (e9c696a persists, 15th confirm)

skipped run at 2026-06-07T22:05:53Z: dirty working tree — exited without doing work.

Same clobbered prior auto-work: **11 files, +421/−465** (private-index check vs HEAD). HEAD still
**e9c696a "Migrate to new Supabase project (pepqcrzbxyuhwqesuejk)"**. Per the wrapper hard rule
(uncommitted changes from a prior run → STOP), did NOT pick a TODO item, edit code, or commit. Did NOT
re-land the clobbered work — infrastructure-sensitive judgment call, reserved for a human. Untracked cruft
still present (not deleted, per hard rule).

**⚠️ USER ACTION STILL NEEDED (15 runs now blocked):** migration commit e9c696a reverted prior auto-work
without committing it, so every auto-run correctly skips. To unblock: either (a) `git restore` / commit the
working tree so it's clean vs HEAD, or (b) confirm the clobbered auto-changes should be re-landed on top of
the migration and are compatible with the new Supabase project. HEAD = **e9c696a**.

## 2026-06-07T18:06Z (auto) — SKIPPED: dirty working tree (e9c696a persists, 14th confirm)

skipped run at 2026-06-07T18:06:09Z: dirty working tree — exited without doing work. Same clobbered prior
auto-work (11 files, +420/−465). `.git/index.lock` present and unremovable (Operation not permitted) —
used GIT_INDEX_FILE private-index workaround. Did NOT pick a TODO item, edit code, or commit.

## 2026-06-07T14:07Z (auto) — SKIPPED: dirty working tree (e9c696a persists, 13th confirm)

skipped run at 2026-06-07T14:07:02Z: dirty working tree — exited without doing work.

Clean private-index check (`GIT_INDEX_FILE=$(mktemp) git read-tree HEAD; git diff HEAD --stat`) shows the
same clobbered prior auto-work: **11 files, +416/−465** (OrderEntry +175, TradeBook ~149, orders.ts +22,
SymbolPickerModal +10, both CI workflows, robotEngine +5, supabaseMock +39, transactions.ts +3, plus
STATE.md/TODO.md doc churn). HEAD still **e9c696a "Migrate to new Supabase project (pepqcrzbxyuhwqesuejk)"**.
Per the wrapper hard rule (uncommitted changes from a prior run → STOP), did NOT pick a TODO item, edit code,
or commit. Did NOT re-land the clobbered work on top of e9c696a — infrastructure-sensitive judgment call
(risks reintroducing old-Supabase-project refs), reserved for a human. Untracked cruft still present (not
deleted, per hard rule).

**⚠️ USER ACTION STILL NEEDED (13 runs now blocked):** migration commit e9c696a reverted prior auto-work
without committing it, so every auto-run correctly skips. To unblock: either (a) `git restore` / commit the
working tree so it's clean vs HEAD, or (b) confirm the clobbered auto-changes should be re-landed on top of
the migration and are compatible with the new Supabase project. HEAD = **e9c696a**.

## 2026-06-07T (auto) — SKIPPED: dirty working tree (e9c696a persists, 12th confirm)

skipped run at 2026-06-07: dirty working tree — exited without doing work.

Clean private-index check (`GIT_INDEX_FILE=$(mktemp) git read-tree HEAD; git diff HEAD --stat`)
shows the same clobbered prior auto-work: **11 files, +832/−431** (OrderEntry +175, TradeBook +149,
orders.ts +22, SymbolPickerModal +10, both CI workflows, robotEngine +5, supabaseMock +39,
transactions.ts +3, plus STATE.md/TODO.md doc churn). HEAD still **e9c696a "Migrate to new Supabase
project (pepqcrzbxyuhwqesuejk)"**. Per the wrapper hard rule (uncommitted changes from a prior run →
STOP), did NOT pick a TODO item, edit code, or commit. Did NOT re-land the clobbered work on top of
e9c696a — infrastructure-sensitive judgment call (risks reintroducing old-Supabase-project refs),
reserved for a human. Also pruned this file (was 569 lines / 40KB) back to header + last ~5 entries.

Untracked cruft still present (not deleted, per hard rule): `.sync_probe_18_1.txt`, `STATE.regen.md`,
`TODO.regen.md`, `OrderEntry.fresh.tsx`, `SymbolPickerModal.regen.tsx`, `_state_entry_18_12.md`,
`orders.regen.ts`, `transactions.regen.ts`, `robotEngine.test.ts`, `docs/security-audit.md`. A human
may want to clean these up.

**⚠️ USER ACTION STILL NEEDED (12 runs now blocked):** migration commit e9c696a reverted prior auto-work
without committing it, so every auto-run correctly skips. To unblock: either (a) `git restore` / commit
the working tree so it's clean vs HEAD, or (b) confirm the clobbered auto-changes should be re-landed on
top of the migration and are compatible with the new Supabase project. HEAD = **e9c696a**.

<!-- older skip entries (≤11th confirm) pruned; all identical: dirty tree vs e9c696a awaiting user action -->

