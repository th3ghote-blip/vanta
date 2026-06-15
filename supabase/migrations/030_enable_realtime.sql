-- Re-enable Supabase Realtime for the tables the client subscribes to.
-- When the project was migrated (auavcfwytrwurawcvrsc → pepqcrzbxyuhwqesuejk) the
-- `supabase_realtime` publication came up EMPTY, so realtime delivered nothing:
--   - binary_rounds → Quick-mode rounds never appeared/settled in the UI
--   - trades        → Pro TradeBook + AccountHeader didn't update live
--   - profiles      → streak/profile changes didn't push
-- This adds them to the publication and sets REPLICA IDENTITY FULL so filtered
-- subscriptions (e.g. account_id=eq.X) and full-row payloads work on UPDATE.
-- Idempotent: safe to re-run.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'binary_rounds'
  ) then
    execute 'alter publication supabase_realtime add table public.binary_rounds';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trades'
  ) then
    execute 'alter publication supabase_realtime add table public.trades';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;
end $$;

alter table public.binary_rounds replica identity full;
alter table public.trades        replica identity full;
alter table public.profiles      replica identity full;
