# Account Groups — design & scope mini-phase (TODO 21.14)

**Status:** design/scope pass complete (2026-07-09, auto run 74). This is the "design and
scope as its own mini-phase before estimating" deliverable that item 21.14 mandates as its
first step. No feature code shipped in this pass — this doc defines the schema, the pricing/risk
integration points, the admin surface, and a decomposition into offline-completable sub-items
(21.14b–f) so future auto-runs can pick one slice at a time. It also resolves the 21.12
dependency (per-account stop-out folds into the group model defined here).

Grounded in the current codebase as of run 74:
- `accounts` (supabase/migrations/001_init.sql:10): has `leverage int default 100`, `balance`,
  `equity`, `margin_used`, `free_margin`, `type`, `status`. **No** `group_id`, `credit`, or
  `stopout_level` columns exist today.
- Stop-out (server/src/workers/risk.ts, "Pass 2"): a **hard global rule** — for each account it
  sums unrealized P&L and force-closes the worst loser when `equity + totalUnrealized < 0`
  (i.e. a fixed 0%-equity floor, `reason='stopout'`). There is no configurable level.
- Spread (server/src/feed/pricefeed.ts): **hard-coded per-feed** bps multipliers — crypto
  `px * 0.0002` (2 bps), forex/futures `px * 0.0001` (1 bp) — applied symmetrically around the
  mid at quote time. There is no per-account or per-group markup.
- Balance ops (server/src/routes/admin.ts, transaction approve path): deposit/withdrawal/bonus/
  adjustment all move `accounts.balance`; there is no separate non-withdrawable credit bucket
  (that is the separate optional item 21.11).

---

## 1. Goal (from 21.14)

Introduce account **groups** and per-group **spread/markup**, **default leverage**, and
**stop-out level** — MT4's core grouping model. An account belongs to exactly one group; the
group supplies pricing and risk parameters that apply to all its members. This is the standard
broker lever for running different books (e.g. `standard`, `vip`, `demo`, `intro`) with
different costs and risk tolerances.

**Acceptance (parent 21.14):** Accounts can be assigned to a group; group-level
spread/markup/leverage/stop-out apply to its members.

---

## 2. Proposed data model

### 2.1 `account_groups` table (new)

```sql
create table account_groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,          -- 'standard', 'vip', 'demo', 'intro'
  description   text,
  markup_bps    numeric(6,2) not null default 0,   -- ADDED to the base synthesized spread, in bps
  leverage      int not null default 100,          -- default leverage for members
  stopout_pct   numeric(5,2) not null default 0,   -- stop-out equity/margin ratio, e.g. 20.00 = 20%
  is_default    boolean not null default false,    -- exactly one group is the fallback
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

Seed one `is_default = true` group named `standard` (markup_bps 0, leverage 100, stopout_pct 0)
in the same migration so existing accounts have a home and behaviour is unchanged at launch
(0 markup + 0% stop-out = today's behaviour exactly).

### 2.2 `accounts.group_id` (new column)

```sql
alter table accounts
  add column if not exists group_id uuid references account_groups(id);
-- backfill every existing account to the default group, then (optionally) NOT NULL:
update accounts set group_id = (select id from account_groups where is_default) where group_id is null;
```

Keep `accounts.leverage` as the effective per-account value (a group assignment sets it, but an
admin can still override a single account). Reads that need "the group's params" join
`accounts.group_id → account_groups`.

**Migration number:** next free is **032** (031 is the latest on disk). File:
`supabase/migrations/032_account_groups.sql`. Per the header, migration files ship offline and
are applied on a network-enabled run (`api.supabase.com` is NOT reachable from the auto-run
sandbox — confirmed run 74).

---

## 3. Integration points (where group params take effect)

### 3.1 Spread / markup — pricing layer

Today the quote is synthesized once in `pricefeed.ts` and cached in `quoteCache` (`getMid`,
`getQuote`) with a single global spread. Per-group markup must NOT be baked into the cached
quote (the cache is shared by all accounts). Instead, **apply markup at order-fill / quote-read
time**, per account:

- Add a helper `applyGroupMarkup(baseBid, baseAsk, markup_bps)` that widens the base quote by
  `markup_bps` around the mid (buy fills at `ask + mid*markup_bps/1e4`, sell at
  `bid - mid*markup_bps/1e4`).
- Call it in the order-open path (server/src/routes/orders.ts) using the opening account's
  group `markup_bps`. This keeps the shared quote cache untouched and makes markup a
  per-account/per-group cost, which is the whole point.
- Robots (`workers`) and admin force-close should continue to use the raw mid (`getMid`) — house
  operations shouldn't pay client markup.

This is the trickiest slice and is **partly untestable offline at the visual level**, but the
markup math itself is pure and unit-testable.

### 3.2 Leverage — account default

`account_groups.leverage` is the default applied when an account is (re)assigned to a group.
Margin math already reads `accounts.leverage` (`requiredMargin`), so assigning a group simply
writes `accounts.leverage = group.leverage` (unless an admin has set a per-account override).
No margin-engine change needed — only the assignment endpoint writes the value.

### 3.3 Stop-out level — risk worker (resolves 21.12)

Replace the hard `equity + totalUnrealized < 0` floor in `risk.ts` Pass 2 with a
group-configurable threshold:

- Fetch each account's `group_id → account_groups.stopout_pct` (or a per-account override column
  if 21.12 wants one — see below).
- Margin level = `equity_with_unrealized / margin_used * 100`. Force-close the worst loser when
  `margin_level_pct <= stopout_pct`. `stopout_pct = 0` reproduces today's "equity floor at 0"
  behaviour, so the default group is behaviour-preserving.
- Keep `reason='stopout'`, the notification, and the margin-release path unchanged.

**This is exactly what 21.12 ("per-account configurable stop-out level") asks for.** 21.12 can
now be satisfied either group-level (this doc) or, if a per-account override is wanted, by adding
`accounts.stopout_level numeric` that, when non-null, wins over the group value. Recommendation:
ship the group-level version (21.14e) first; only add the per-account override if the user
explicitly needs it. Update 21.12 to depend on 21.14e rather than the whole of 21.14.

### 3.4 Admin surface

- Backend CRUD: `GET/POST/PATCH/DELETE /api/admin/groups` (admin-only via `authAdmin`), plus
  `POST /api/admin/accounts/:id/group` to (re)assign an account (writes `group_id`, and
  `leverage` from the group unless overridden). Deleting a group reassigns its members to the
  default group (never orphan an account).
- Admin UI: a "Groups" page (`app/admin/groups.tsx`) listing groups with member counts and an
  edit form (markup_bps / leverage / stopout_pct); a group selector on the account detail page
  (`app/admin/user/`). Both are **visual** slices deferred to a screenshot-capable run.

---

## 4. Decomposition into offline-completable sub-items

Mirrors how 18.8 was split into 18.8a–f so each auto-run can take one bounded, unit-testable
slice. Ordering matters: 21.14b (schema) → 21.14c (CRUD + assignment) → 21.14d (markup at fill)
→ 21.14e (group stop-out, resolves 21.12) → 21.14f (admin UI, visual).

| Sub-item | What | Offline? | Acceptance |
|---|---|---|---|
| **21.14a** | This design/scope doc + decomposition | ✅ done (run 74) | `docs/account-groups-design.md` exists, grounded in real schema/risk/pricing; 21.14b–f carved with acceptance criteria |
| **21.14b** | Migration `032_account_groups.sql` (table + `accounts.group_id` + default group seed + backfill) | ✅ code offline; apply deferred to network run | Migration file present; tsc clean; backfill assigns every account to the default group; behaviour-preserving defaults |
| **21.14c** | Backend group CRUD + `POST /accounts/:id/group` assignment + `lib/api.ts` helpers + hermetic tests | ✅ unit-testable | CRUD returns groups with member counts; assignment writes `group_id`+`leverage`; delete reassigns members to default; 403 gating; tests green |
| **21.14d** | `applyGroupMarkup` in the order-open fill path + unit tests | ✅ math unit-testable (visual fill deferred) | Buy/sell fill prices widen by the group `markup_bps`; house ops (robots/admin) still use raw mid; markup math reconciles in tests |
| **21.14e** | Group-configurable stop-out in `risk.ts` (resolves 21.12) + tests | ✅ unit-testable | Setting a group `stopout_pct` changes when the risk worker force-closes a member; `stopout_pct=0` preserves today's behaviour |
| **21.14f** | Admin "Groups" page + account-detail group selector | ❌ visual — screenshot run | Admin can create/edit a group and assign an account; group params visibly apply |

Once 21.14b–e are `[x]` and applied+live-verified, the parent 21.14 acceptance is met and it can
be checked off. 21.14f is cosmetic and can trail.

---

## 5. Open product decisions (need the user, not an auto-run)

1. **Initial group set.** Proposed default: a single `standard` group (0 markup, 100x, 0%
   stop-out) so nothing changes at launch. Do you also want `vip` / `intro` / `demo` seeded, and
   with what params?
2. **Markup semantics.** Additive bps on top of the synthesized base spread (proposed) vs a
   multiplier vs a fixed per-symbol pip markup. Additive bps is simplest and MT4-like.
3. **Stop-out convention.** Margin-level percentage (proposed, MT4-standard: close when
   `equity/margin ≤ X%`) vs an equity floor. Percentage is the industry norm.
4. **Per-account override vs group-only for stop-out (21.12).** Recommendation: group-only first;
   add `accounts.stopout_level` override only if explicitly needed.
5. **Credit bucket interaction (21.11).** If a non-withdrawable credit bucket is later added,
   decide whether credit counts toward the stop-out equity figure (MT4: yes, credit is part of
   equity). Out of scope here; noted so 21.11 and 21.14e stay consistent.

These are business-model calls; the sub-items above default to the behaviour-preserving choices
so 21.14b–e can proceed offline without waiting on them, and the defaults can be re-tuned later
via the admin UI (21.14f).
