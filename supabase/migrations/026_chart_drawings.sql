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
