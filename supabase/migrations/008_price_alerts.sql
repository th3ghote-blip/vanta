-- Migration 008: price_alerts table
-- Direction: 'above' fires when mid >= threshold; 'below' fires when mid <= threshold.
-- triggered_at is NULL until the alert fires; after firing it is set to now() and the
-- worker stops watching it.

create table if not exists price_alerts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  symbol        text not null,
  threshold     numeric(20, 8) not null,
  direction     text not null check (direction in ('above', 'below')),
  triggered_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- Each user can have at most one active (un-triggered) alert per symbol+direction
-- to avoid alert storms. Partial unique index on active alerts only.
create unique index if not exists price_alerts_active_unique
  on price_alerts (user_id, symbol, direction)
  where triggered_at is null;

-- Fast worker scan: all active alerts across all users
create index if not exists price_alerts_active_idx
  on price_alerts (symbol)
  where triggered_at is null;

-- Fast per-user listing
create index if not exists price_alerts_user_idx
  on price_alerts (user_id, created_at desc);

-- RLS
alter table price_alerts enable row level security;

-- Users can only see their own alerts
create policy "users_select_own_alerts"
  on price_alerts for select
  using (auth.uid() = user_id);

-- Users can insert their own alerts
create policy "users_insert_own_alerts"
  on price_alerts for insert
  with check (auth.uid() = user_id);

-- Users can delete their own alerts (to cancel)
create policy "users_delete_own_alerts"
  on price_alerts for delete
  using (auth.uid() = user_id);
