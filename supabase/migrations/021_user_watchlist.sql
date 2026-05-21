-- T.12 Symbol watchlist / favourites
--
-- Allows each user to star symbols. Stars are stored in this table;
-- one row per (user, symbol). The server enforces a unique constraint so
-- duplicate inserts are safe (use ON CONFLICT DO NOTHING).

create table if not exists user_watchlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  symbol     text not null,
  created_at timestamptz not null default now()
);

-- A user can only star each symbol once.
create unique index if not exists user_watchlist_user_symbol_idx
  on user_watchlist (user_id, symbol);

-- Fast per-user listing ordered by insertion time.
create index if not exists user_watchlist_user_idx
  on user_watchlist (user_id, created_at desc);

-- RLS
alter table user_watchlist enable row level security;

create policy "users_select_own_watchlist"
  on user_watchlist for select
  using (auth.uid() = user_id);

create policy "users_insert_own_watchlist"
  on user_watchlist for insert
  with check (auth.uid() = user_id);

create policy "users_delete_own_watchlist"
  on user_watchlist for delete
  using (auth.uid() = user_id);
