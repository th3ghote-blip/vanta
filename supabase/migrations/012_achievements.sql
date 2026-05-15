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
