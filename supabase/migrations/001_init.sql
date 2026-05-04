-- Vanta — initial schema
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
