-- Add INSERT/UPDATE/DELETE policies on accounts and trades so the user's own
-- writes go through even when supabase-js is treating the `sb_secret_*` key
-- as `authenticated` instead of `service_role` (v2.45 quirk with the new key
-- format). Service role still bypasses these via BYPASSRLS.

-- ── accounts ─────────────────────────────────────────────────────────────
drop policy if exists "Users insert own accounts" on accounts;
create policy "Users insert own accounts" on accounts
  for insert with check (user_id = auth.uid());

drop policy if exists "Users update own accounts" on accounts;
create policy "Users update own accounts" on accounts
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── trades ───────────────────────────────────────────────────────────────
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

-- ── binary_rounds ────────────────────────────────────────────────────────
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
