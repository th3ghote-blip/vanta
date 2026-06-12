-- 22.x — in-app notifications feed.
-- Robot tips (and future system alerts) are persisted here so they show up in
-- the app on web AND mobile. Mobile push is a bonus on top, not the only channel.
create table if not exists notifications (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null default 'robot_tip',   -- robot_tip | system | news
  title      text not null,
  body       text not null,
  symbol     text,
  data       jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on notifications(user_id, created_at desc);

-- RLS: a user can read + update (mark-read) only their own notifications.
-- The server uses the service role (bypasses RLS) to insert.
alter table notifications enable row level security;

create policy notifications_select_own on notifications
  for select using (auth.uid() = user_id);

create policy notifications_update_own on notifications
  for update using (auth.uid() = user_id);
