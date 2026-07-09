-- 21.14 — Account groups (per-group spread/markup / default leverage / stop-out level).
-- See docs/account-groups-design.md §2. Introduces an `account_groups` table and an
-- `accounts.group_id` FK. A group supplies pricing/risk parameters that apply to all its
-- members (MT4's core grouping model). This migration is behaviour-preserving: it seeds a
-- single default `standard` group (0 markup, 100x, 0% stop-out) and backfills every existing
-- account into it, so nothing about pricing or risk changes at launch.
-- Safe to re-run (IF NOT EXISTS / idempotent guards throughout).

-- 2.1 — the groups table.
create table if not exists account_groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,               -- 'standard', 'vip', 'demo', 'intro'
  description   text,
  markup_bps    numeric(6,2) not null default 0,    -- ADDED to the base synthesized spread, in bps
  leverage      int not null default 100,           -- default leverage for members
  stopout_pct   numeric(5,2) not null default 0,    -- stop-out margin-level ratio, e.g. 20.00 = 20%
  is_default    boolean not null default false,     -- exactly one group is the fallback
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- At most one default group. Partial unique index enforces "exactly one is_default = true".
create unique index if not exists account_groups_one_default_idx
  on account_groups (is_default) where is_default;

-- Seed the behaviour-preserving default group (0 markup + 0% stop-out = today's behaviour).
insert into account_groups (name, description, markup_bps, leverage, stopout_pct, is_default)
  values ('standard', 'Default group — behaviour-preserving (no markup, 100x, 0% stop-out).', 0, 100, 0, true)
  on conflict (name) do nothing;

-- 2.2 — attach accounts to a group.
alter table accounts add column if not exists group_id uuid references account_groups(id);

create index if not exists accounts_group_id_idx on accounts (group_id);

-- Backfill: every existing account lands in the default group (never orphaned).
update accounts
  set group_id = (select id from account_groups where is_default limit 1)
  where group_id is null;

-- RLS: groups are admin-managed data. The server uses the service role (bypasses RLS) for all
-- CRUD and for joining accounts -> account_groups at pricing/risk time; clients never read it
-- directly. Enable RLS with no client policies so it stays locked down by default (mirrors the
-- security posture of the other server-only tables).
alter table account_groups enable row level security;

-- keep updated_at fresh on edits (reuse the standard trigger pattern if present; otherwise the
-- server stamps updated_at on PATCH — see 21.14c).
