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
