-- Atomic margin reservation / release as Postgres functions.
-- Replaces the read-then-write CAS in `server/src/lib/margin.ts` which was
-- failing to return updated rows through supabase-js (the manual SQL UPDATE
-- with the same predicates works, so the issue is in how the JS client
-- composes its PostgREST request — not worth debugging further when the
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
