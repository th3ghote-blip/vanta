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
