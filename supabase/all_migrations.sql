-- Vanta: all migrations in order
-- Generated 2026-06-08

-- ============================================================
-- 001_init.sql
-- ============================================================
-- Vanta â€” initial schema
-- B-book trading platform: trades settle internally, no LP execution

-- ============================================================
-- ACCOUNTS
-- ============================================================
create type account_type as enum ('demo', 'live');
create type account_status as enum ('pending_kyc', 'active', 'suspended', 'closed');

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type account_type not null default 'demo',
  status account_status not null default 'pending_kyc',
  currency text not null default 'USD',
  balance numeric(18,2) not null default 0,
  equity numeric(18,2) not null default 0,
  margin_used numeric(18,2) not null default 0,
  free_margin numeric(18,2) not null default 0,
  leverage int not null default 100,
  affiliate_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_user_id_idx on accounts(user_id);
create index accounts_type_idx on accounts(type);

-- ============================================================
-- TRADES (matches the CRM trade table from existing system)
-- ============================================================
create type trade_side as enum ('buy', 'sell');
create type trade_status as enum ('open', 'closed', 'cancelled');
create type trade_reason as enum ('mobile', 'web', 'desktop', 'robot', 'admin', 'stopout');

create table trades (
  id bigserial primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  symbol text not null,
  side trade_side not null,
  volume numeric(10,3) not null,
  open_price numeric(18,5) not null,
  current_price numeric(18,5),
  close_price numeric(18,5),
  stop_loss numeric(18,5),
  take_profit numeric(18,5),
  swaps numeric(18,2) not null default 0,
  commission numeric(18,2) not null default 0,
  profit numeric(18,2) not null default 0,
  reason trade_reason not null default 'mobile',
  comment text,
  robot_id uuid,
  status trade_status not null default 'open',
  open_time timestamptz not null default now(),
  close_time timestamptz
);

create index trades_account_id_idx on trades(account_id);
create index trades_status_idx on trades(status);
create index trades_symbol_idx on trades(symbol);
create index trades_open_time_idx on trades(open_time desc);

-- ============================================================
-- BINARY ROUNDS (Quick Mode / Fun Mode)
-- ============================================================
create type round_outcome as enum ('pending', 'win', 'loss', 'tie', 'cancelled');

create table binary_rounds (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  symbol text not null,
  direction trade_side not null,        -- buy = up, sell = down
  stake numeric(18,2) not null,
  payout_multiplier numeric(4,2) not null default 1.85,
  entry_price numeric(18,5) not null,
  exit_price numeric(18,5),
  duration_seconds int not null,         -- 60, 300, 3600, etc.
  outcome round_outcome not null default 'pending',
  payout numeric(18,2) not null default 0,
  opened_at timestamptz not null default now(),
  closes_at timestamptz not null
);

create index binary_rounds_account_id_idx on binary_rounds(account_id);
create index binary_rounds_outcome_idx on binary_rounds(outcome);
create index binary_rounds_closes_at_idx on binary_rounds(closes_at);

-- ============================================================
-- DEPOSITS / WITHDRAWALS
-- ============================================================
create type tx_type as enum ('deposit', 'withdrawal', 'bonus', 'adjustment');
create type tx_status as enum ('pending', 'approved', 'rejected', 'completed');

create table transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  type tx_type not null,
  amount numeric(18,2) not null,
  currency text not null default 'USD',
  status tx_status not null default 'pending',
  method text,                           -- 'crypto_btc', 'wire', 'card', etc.
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index transactions_account_id_idx on transactions(account_id);
create index transactions_type_idx on transactions(type);
create index transactions_status_idx on transactions(status);

-- ============================================================
-- AI ROBOTS
-- ============================================================
create type robot_status as enum ('draft', 'active', 'paused', 'stopped', 'error');

create table robots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  name text not null,
  description text,
  prompt text not null,                  -- the user's natural language description
  config jsonb not null default '{}',    -- compiled rules: schedule, symbols, max_volume, etc.
  status robot_status not null default 'draft',
  total_trades int not null default 0,
  winning_trades int not null default 0,
  total_profit numeric(18,2) not null default 0,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index robots_account_id_idx on robots(account_id);
create index robots_status_idx on robots(status);

create table robot_runs (
  id bigserial primary key,
  robot_id uuid not null references robots(id) on delete cascade,
  triggered_at timestamptz not null default now(),
  action text not null,                  -- 'open_trade', 'close_trade', 'tip', 'noop'
  payload jsonb,
  trade_id bigint references trades(id),
  notes text
);

create index robot_runs_robot_id_idx on robot_runs(robot_id);
create index robot_runs_triggered_at_idx on robot_runs(triggered_at desc);

-- ============================================================
-- KYC
-- ============================================================
create type kyc_status as enum ('not_started', 'pending', 'approved', 'rejected');
create type kyc_doc_type as enum ('id_front', 'id_back', 'selfie', 'proof_of_address');

create table kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status kyc_status not null default 'not_started',
  rejection_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table kyc_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references kyc_submissions(id) on delete cascade,
  doc_type kyc_doc_type not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

create index kyc_user_id_idx on kyc_submissions(user_id);

-- ============================================================
-- USER PROFILE EXTRAS (mode preference, online status, etc.)
-- ============================================================
create type ui_mode as enum ('pro', 'quick');
create type online_status as enum ('online', 'away', 'offline', 'in_call');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  country text,
  ui_mode ui_mode not null default 'pro',
  online_status online_status not null default 'offline',
  last_seen_at timestamptz,
  push_token text,
  notification_prefs jsonb not null default '{"price_alerts":true,"robot_signals":true,"trade_results":true}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- MESSAGING (in-app support chat)
-- ============================================================
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id uuid references auth.users(id),
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id bigserial primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_conversation_id_idx on messages(conversation_id);
create index messages_created_at_idx on messages(created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table accounts enable row level security;
alter table trades enable row level security;
alter table binary_rounds enable row level security;
alter table transactions enable row level security;
alter table robots enable row level security;
alter table robot_runs enable row level security;
alter table kyc_submissions enable row level security;
alter table kyc_documents enable row level security;
alter table profiles enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

create policy "Users see own accounts" on accounts for select using (user_id = auth.uid());
create policy "Users see own trades" on trades for select using (
  exists (select 1 from accounts a where a.id = trades.account_id and a.user_id = auth.uid())
);
create policy "Users see own binary rounds" on binary_rounds for select using (
  exists (select 1 from accounts a where a.id = binary_rounds.account_id and a.user_id = auth.uid())
);
create policy "Users see own transactions" on transactions for select using (
  exists (select 1 from accounts a where a.id = transactions.account_id and a.user_id = auth.uid())
);
create policy "Users see own robots" on robots for select using (
  exists (select 1 from accounts a where a.id = robots.account_id and a.user_id = auth.uid())
);
create policy "Users see own profile" on profiles for select using (id = auth.uid());
create policy "Users update own profile" on profiles for update using (id = auth.uid());

-- ============================================================
-- TRIGGERS
-- ============================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger accounts_updated_at before update on accounts for each row execute function set_updated_at();
create trigger profiles_updated_at before update on profiles for each row execute function set_updated_at();
create trigger robots_updated_at before update on robots for each row execute function set_updated_at();


-- ============================================================
-- 002_signup_trigger.sql
-- ============================================================
-- Auto-create profile + demo account when a new auth user signs up.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_account_id uuid;
begin
  -- Create profile
  insert into profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;

  -- Create a demo account with $10,000 starting balance
  insert into accounts (user_id, type, status, balance, equity, free_margin, currency)
  values (new.id, 'demo', 'active', 10000, 10000, 10000, 'USD')
  returning id into new_account_id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Helper: apply trade P&L to account balance (used by orders/close)
create or replace function apply_trade_pnl(p_account_id uuid, p_amount numeric)
returns void
language plpgsql
security definer
as $$
begin
  update accounts
  set balance = balance + p_amount,
      equity = equity + p_amount,
      free_margin = free_margin + p_amount,
      updated_at = now()
  where id = p_account_id;
end;
$$;

-- Backfill: create profile + account for any existing auth users that don't have one
insert into profiles (id, display_name)
select u.id, split_part(u.email, '@', 1)
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);

insert into accounts (user_id, type, status, balance, equity, free_margin, currency)
select u.id, 'demo', 'active', 10000, 10000, 10000, 'USD'
from auth.users u
where not exists (select 1 from accounts a where a.user_id = u.id);

-- Allow users to read their own KYC submissions
drop policy if exists "Users see own KYC submissions" on kyc_submissions;
create policy "Users see own KYC submissions"
  on kyc_submissions for select using (user_id = auth.uid());


-- ============================================================
-- 003_login_numbers.sql
-- ============================================================
-- MT4-style numeric login numbers for accounts.
-- Each account gets a unique login (e.g. 80000001, 80000002, ...).

create sequence if not exists account_login_seq start 80000001;

alter table accounts
  add column if not exists login bigint;

-- Backfill existing rows
update accounts set login = nextval('account_login_seq') where login is null;

alter table accounts
  alter column login set default nextval('account_login_seq'),
  alter column login set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'accounts_login_unique'
  ) then
    alter table accounts add constraint accounts_login_unique unique (login);
  end if;
end $$;

-- Helper function: look up auth.users.email for a given login number.
-- Used by /api/auth/login on the server (called via service role).
create or replace function get_email_for_login(p_login bigint)
returns text
language sql
security definer
set search_path = public, auth
as $$
  select u.email
  from accounts a
  join auth.users u on u.id = a.user_id
  where a.login = p_login
  limit 1;
$$;

-- Update the signup trigger to create a profile + account with a login.
-- The login is auto-assigned by the column default.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;

  insert into accounts (user_id, type, status, balance, equity, free_margin, currency)
  values (new.id, 'demo', 'active', 10000, 10000, 10000, 'USD');

  return new;
end;
$$;


-- ============================================================
-- 004_login_attempts.sql
-- ============================================================
-- Audit log for login attempts (security / compliance).

create type login_outcome as enum ('success', 'invalid_password', 'unknown_login', 'rate_limited', 'error');

create table login_attempts (
  id bigserial primary key,
  login bigint,                      -- account login number attempted
  email text,                        -- the synthetic email if known
  ip_address text,
  user_agent text,
  outcome login_outcome not null,
  details text,
  created_at timestamptz not null default now()
);

create index login_attempts_login_idx on login_attempts(login, created_at desc);
create index login_attempts_ip_idx on login_attempts(ip_address, created_at desc);
create index login_attempts_created_idx on login_attempts(created_at desc);

-- No RLS needed â€” only service role writes/reads this.


-- ============================================================
-- 005_streaks.sql
-- ============================================================
-- Migration 005: streak tracking columns on profiles
-- Adds current_streak (resets to 0 on loss) and best_streak (all-time high).
-- Both default 0 for existing rows.

alter table profiles
  add column if not exists current_streak integer not null default 0,
  add column if not exists best_streak    integer not null default 0;


-- ============================================================
-- 006_public_robots.sql
-- ============================================================
-- Migration 006: public robots flag for leaderboard
-- Adds is_public to robots so owners can opt-in to the leaderboard.

alter table robots
  add column if not exists is_public boolean not null default false;

-- Index so the leaderboard query (WHERE is_public = true ORDER BY total_profit DESC) is fast
create index if not exists robots_leaderboard_idx
  on robots(is_public, total_profit desc)
  where is_public = true;

-- Allow anyone (including anon) to read public robots (leaderboard view)
-- The existing policy "Users see own robots" already covers owner reads;
-- this policy covers public reads.
create policy "Anyone can view public robots" on robots
  for select
  using (is_public = true);


-- ============================================================
-- 007_admin.sql
-- ============================================================
-- Add is_admin flag to profiles
alter table profiles add column if not exists is_admin boolean not null default false;

-- Index for quick admin lookup (very few rows, but keeps the check fast)
create index if not exists profiles_is_admin_idx on profiles(is_admin) where is_admin = true;


-- ============================================================
-- 008_price_alerts.sql
-- ============================================================
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


-- ============================================================
-- 009_kyc_policies.sql
-- ============================================================
-- Phase 5.1 â€” KYC real upload
-- Adds missing RLS policies for kyc_submissions + kyc_documents,
-- and creates the 'kyc' Storage bucket with per-user upload policies.

-- â”€â”€ kyc_submissions policies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Users can insert their own submission row
create policy "Users insert own KYC submission"
  on kyc_submissions for insert
  with check (user_id = auth.uid());

-- Users can update their own submission (e.g. status not_started â†’ pending)
create policy "Users update own KYC submission"
  on kyc_submissions for update
  using (user_id = auth.uid());

-- â”€â”€ kyc_documents policies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Users can insert documents on their own submissions
create policy "Users insert own KYC documents"
  on kyc_documents for insert
  with check (
    exists (
      select 1 from kyc_submissions s
      where s.id = kyc_documents.submission_id
        and s.user_id = auth.uid()
    )
  );

-- Users can read documents on their own submissions
create policy "Users see own KYC documents"
  on kyc_documents for select
  using (
    exists (
      select 1 from kyc_submissions s
      where s.id = kyc_documents.submission_id
        and s.user_id = auth.uid()
    )
  );

-- â”€â”€ Storage bucket â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Create private 'kyc' bucket (idempotent)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc',
  'kyc',
  false,
  10485760,   -- 10 MB max per file
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Authenticated users may upload to their own folder: kyc/<user_id>/
create policy "Users upload own KYC docs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'kyc'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users may overwrite (update) files in their own folder
create policy "Users update own KYC docs"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'kyc'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users may read their own KYC docs
create policy "Users read own KYC docs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'kyc'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all KYC docs (for review screen 5.2)
create policy "Admins read all KYC docs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'kyc'
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );


-- ============================================================
-- 010_notification_prefs.sql
-- ============================================================
-- 010_notification_prefs.sql
-- Adds notification_prefs JSONB column to profiles.
-- Allows per-user opt-in/opt-out of push notification categories.
-- Categories: price_alerts, robot_signals, trade_results, promotional.
-- Default is all enabled (true) so existing users keep receiving pushes.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL
    DEFAULT '{"price_alerts":true,"robot_signals":true,"trade_results":true,"promotional":true}'::jsonb;

COMMENT ON COLUMN profiles.notification_prefs IS
  'Per-user push opt-in flags. Keys: price_alerts, robot_signals, trade_results, promotional.';


-- ============================================================
-- 011_login_streak.sql
-- ============================================================
-- Migration 011: daily login streak tracking on profiles
alter table profiles
  add column if not exists last_login_date date,
  add column if not exists login_streak int not null default 0;


-- ============================================================
-- 012_achievements.sql
-- ============================================================
-- 012_achievements.sql
-- Achievements / badges table for Phase 11.3

create table if not exists achievements (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  code        text not null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, code)
);

create index if not exists achievements_user_id_idx on achievements (user_id);

alter table achievements enable row level security;

create policy "users can read own achievements"
  on achievements for select
  using (auth.uid() = user_id);


-- ============================================================
-- 013_margin_rpc.sql
-- ============================================================
-- Atomic margin reservation / release as Postgres functions.
-- Replaces the read-then-write CAS in `server/src/lib/margin.ts` which was
-- failing to return updated rows through supabase-js (the manual SQL UPDATE
-- with the same predicates works, so the issue is in how the JS client
-- composes its PostgREST request â€” not worth debugging further when the
-- right fix is to make this atomic in the database anyway).

create or replace function reserve_margin(
  p_account_id uuid,
  p_amount numeric
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if p_amount is null or p_amount <= 0 then
    return true;
  end if;
  update accounts
    set free_margin = free_margin - p_amount,
        margin_used = margin_used + p_amount,
        updated_at  = now()
  where id = p_account_id
    and free_margin >= p_amount;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function release_margin(
  p_account_id uuid,
  p_amount numeric
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current numeric;
  v_release numeric;
begin
  if p_amount is null or p_amount <= 0 then
    return;
  end if;
  select margin_used into v_current from accounts where id = p_account_id for update;
  if v_current is null then return; end if;
  v_release := least(p_amount, v_current);
  if v_release <= 0 then return; end if;
  update accounts
    set margin_used = margin_used - v_release,
        free_margin = free_margin + v_release,
        updated_at  = now()
  where id = p_account_id;
end;
$$;


-- ============================================================
-- 014_write_policies.sql
-- ============================================================
-- Add INSERT/UPDATE/DELETE policies on accounts and trades so the user's own
-- writes go through even when supabase-js is treating the `sb_secret_*` key
-- as `authenticated` instead of `service_role` (v2.45 quirk with the new key
-- format). Service role still bypasses these via BYPASSRLS.

-- â”€â”€ accounts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
drop policy if exists "Users insert own accounts" on accounts;
create policy "Users insert own accounts" on accounts
  for insert with check (user_id = auth.uid());

drop policy if exists "Users update own accounts" on accounts;
create policy "Users update own accounts" on accounts
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- â”€â”€ trades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
drop policy if exists "Users insert own trades" on trades;
create policy "Users insert own trades" on trades
  for insert with check (
    exists (select 1 from accounts a where a.id = trades.account_id and a.user_id = auth.uid())
  );

drop policy if exists "Users update own trades" on trades;
create policy "Users update own trades" on trades
  for update using (
    exists (select 1 from accounts a where a.id = trades.account_id and a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from accounts a where a.id = trades.account_id and a.user_id = auth.uid())
  );

-- â”€â”€ binary_rounds â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
drop policy if exists "Users insert own binary rounds" on binary_rounds;
create policy "Users insert own binary rounds" on binary_rounds
  for insert with check (
    exists (select 1 from accounts a where a.id = binary_rounds.account_id and a.user_id = auth.uid())
  );

drop policy if exists "Users update own binary rounds" on binary_rounds;
create policy "Users update own binary rounds" on binary_rounds
  for update using (
    exists (select 1 from accounts a where a.id = binary_rounds.account_id and a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from accounts a where a.id = binary_rounds.account_id and a.user_id = auth.uid())
  );


-- ============================================================
-- 015_order_idempotency.sql
-- ============================================================
-- R.5: Order-open idempotency
-- Allows callers to supply a client_request_id (UUID) with an order-open request.
-- If the same (account_id, client_request_id) pair is seen again the server returns
-- the existing trade row rather than opening a duplicate.

ALTER TABLE trades ADD COLUMN IF NOT EXISTS client_request_id text;

-- Partial unique index: only enforced when client_request_id is not null,
-- so legacy / non-idempotent requests are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS trades_account_client_request_uidx
  ON trades (account_id, client_request_id)
  WHERE client_request_id IS NOT NULL;


-- ============================================================
-- 016_pending_orders.sql
-- ============================================================
-- T.1: Pending limit orders (also lays groundwork for T.2 stop / T.3 stop_limit)
--
-- Adds:
--   trades.order_type   (default 'market', constrained to one of
--                        'market' | 'limit' | 'stop' | 'stop_limit')
--   trades.trigger_price (numeric, nullable; required by route logic when
--                         order_type != 'market', not enforced at DB level)
--
-- Status enum: extends trade_status with 'pending'. The existing enum already
-- has 'cancelled' (British double-l), so pending-order cancels reuse it.
--
-- Index trades_pending_idx accelerates the orders-trigger worker's per-tick
-- scan: SELECT â€¦ WHERE status='pending' AND order_type IN (...).

-- 1. Add 'pending' to the trade_status enum (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'pending'
      AND enumtypid = 'trade_status'::regtype
  ) THEN
    ALTER TYPE trade_status ADD VALUE 'pending';
  END IF;
END
$$;

-- 2. order_type column with CHECK constraint covering all 4 future values.
ALTER TABLE trades ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'market';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trades_order_type_check'
  ) THEN
    ALTER TABLE trades
      ADD CONSTRAINT trades_order_type_check
      CHECK (order_type IN ('market', 'limit', 'stop', 'stop_limit'));
  END IF;
END
$$;

-- 3. trigger_price (nullable; market orders leave it null).
ALTER TABLE trades ADD COLUMN IF NOT EXISTS trigger_price numeric(18,5);

-- 4. Partial index for the orders-trigger worker.
CREATE INDEX IF NOT EXISTS trades_pending_idx
  ON trades (status, order_type)
  WHERE status = 'pending';


-- ============================================================
-- 017_pending_orders_index.sql
-- ============================================================
-- T.1 follow-up: partial index for the orders-trigger worker.
--
-- This had to be split out of 016: Postgres rejects referencing a
-- newly-added enum value ('pending') from the same transaction that
-- added it ("unsafe use of new value"). The Management API runs each
-- apply as a single tx, so 016 adds 'pending' to trade_status and
-- 017 (a later tx) adds the index that filters on it.
CREATE INDEX IF NOT EXISTS trades_pending_idx
  ON trades (status, order_type)
  WHERE status = 'pending';


-- ============================================================
-- 018_stop_limit.sql
-- ============================================================
-- T.3 Stop-limit orders
-- Adds limit_price column to trades so stop_limit orders can store both the
-- stop activation price (trigger_price, already present from 016) and the
-- limit fill price (limit_price, added here).
--
-- For stop orders and plain limit orders this column stays NULL.
-- For stop_limit orders both trigger_price and limit_price are populated:
--   buy  stop_limit: stop fires when ask >= trigger_price â†’ fills when ask <= limit_price
--   sell stop_limit: stop fires when bid <= trigger_price â†’ fills when bid >= limit_price
-- Constraint: for buy stop_limit  limit_price >= trigger_price
--             for sell stop_limit limit_price <= trigger_price
-- (enforced at application layer, not DB level, to keep migration simple)

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS limit_price numeric(18,5);


-- ============================================================
-- 019_trailing_stops.sql
-- ============================================================
-- T.4 Trailing stops
--
-- trail_distance: the distance (in price units) the stop-loss trails
--                 behind the best price reached since open.
-- trail_high_water: the best price the trade has seen since opening.
--                   NULL means the risk worker has not yet set it
--                   (it initialises on the first tick after open).
--
-- Logic (handled in server/src/workers/risk.ts):
--   Buy:  high_water = max(high_water ?? open_price, mid)
--         trailing_sl = high_water - trail_distance
--         stop_loss   = max(stop_loss ?? -inf, trailing_sl)
--   Sell: high_water = min(high_water ?? open_price, mid)
--         trailing_sl = high_water + trail_distance
--         stop_loss   = min(stop_loss ?? +inf, trailing_sl)
--
-- Both columns stay NULL for non-trailing trades so existing rows are unaffected.

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS trail_distance   numeric(18,5),
  ADD COLUMN IF NOT EXISTS trail_high_water numeric(18,5);


-- ============================================================
-- 020_oco_groups.sql
-- ============================================================
-- T.8 OCO (one-cancels-other) orders
--
-- Two pending orders that share an OCO group are linked: when one fills,
-- the orders-trigger worker cancels the others in the same group and
-- releases their reserved margin.
--
-- oco_group_id: nullable uuid. Clients mint a fresh UUID for each OCO pair
--               and submit two pending orders sharing that id. The worker
--               looks for siblings via this column on fill.
--
-- Nullable so existing rows (and non-OCO orders) are unaffected.

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS oco_group_id uuid;

-- Partial index speeds up the sibling lookup the worker performs on every
-- successful fill. Only pending rows that belong to an OCO group qualify,
-- so the index stays small.
CREATE INDEX IF NOT EXISTS trades_oco_group_idx
  ON trades (oco_group_id)
  WHERE oco_group_id IS NOT NULL AND status = 'pending';


-- ============================================================
-- 021_user_watchlist.sql
-- ============================================================
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


-- ============================================================
-- 022_hedging_mode.sql
-- ============================================================
-- T.9 Hedging mode
--
-- Adds `hedging_enabled` to accounts. When false (the default), the server
-- nets opposing positions on the same symbol (MT4-style netting account).
-- When true, opposing positions coexist independently (hedging account).

alter table accounts
  add column if not exists hedging_enabled boolean not null default false;


-- ============================================================
-- 023_trade_notes.sql
-- ============================================================
-- T.14 Trade journal: add free-text notes field to trades
-- Safe to re-run: IF NOT EXISTS guard.
ALTER TABLE trades ADD COLUMN IF NOT EXISTS notes text;


-- ============================================================
-- 024_account_is_primary.sql
-- ============================================================
-- T.10: Add is_primary flag to track which account the user has selected as active.
-- Safe to re-run (IF NOT EXISTS guard).

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

-- Backfill: mark the oldest account per user as their primary.
-- Only touches rows where is_primary is still false for all of a user's accounts.
WITH first_per_user AS (
  SELECT DISTINCT ON (user_id) id
  FROM accounts
  ORDER BY user_id, created_at ASC
)
UPDATE accounts a
SET is_primary = true
FROM first_per_user f
WHERE a.id = f.id
  AND a.is_primary = false;


-- ============================================================
-- 025_copy_relationships.sql
-- ============================================================
-- T.18: Copy trading â€” allow users to follow another trader's positions.
-- Applies on top of: 024_account_is_primary.sql

-- 1. Opt-in flag on profiles: a user must opt in before followers can copy them.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS copy_leader_enabled boolean NOT NULL DEFAULT false;

-- 2. Core relationship table.
CREATE TABLE IF NOT EXISTS copy_relationships (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leader_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  follower_account_id uuid     NOT NULL REFERENCES accounts(id)   ON DELETE CASCADE,
  -- allocation_pct: what fraction of the leader's lot-size to mirror (1-100).
  allocation_pct   numeric(5,2) NOT NULL CHECK (allocation_pct > 0 AND allocation_pct <= 100),
  started_at       timestamptz NOT NULL DEFAULT now(),
  -- each follower can only follow a given leader once
  UNIQUE (follower_id, leader_id)
);

CREATE INDEX IF NOT EXISTS copy_rel_leader_idx   ON copy_relationships(leader_id);
CREATE INDEX IF NOT EXISTS copy_rel_follower_idx ON copy_relationships(follower_id);

-- 3. RLS â€” match the pattern used by the rest of the schema.
ALTER TABLE copy_relationships ENABLE ROW LEVEL SECURITY;

-- Followers can see/manage their own relationships.
CREATE POLICY "follower_owns_row"
  ON copy_relationships
  FOR ALL
  USING  (follower_id = auth.uid())
  WITH CHECK (follower_id = auth.uid());

-- Leaders can see who is following them (read-only).
CREATE POLICY "leader_sees_followers"
  ON copy_relationships
  FOR SELECT
  USING (leader_id = auth.uid());


-- ============================================================
-- 026_chart_drawings.sql
-- ============================================================
-- 026_chart_drawings: persist chart annotations per user + symbol
-- Apply via Supabase dashboard SQL editor.

create table if not exists chart_drawings (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  symbol     text        not null,
  drawing    jsonb       not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chart_drawings_user_symbol
  on chart_drawings(user_id, symbol);

alter table chart_drawings enable row level security;

create policy "users manage own drawings"
  on chart_drawings
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);



