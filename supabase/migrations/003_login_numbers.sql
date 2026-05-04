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
