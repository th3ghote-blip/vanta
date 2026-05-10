-- Add is_admin flag to profiles
alter table profiles add column if not exists is_admin boolean not null default false;

-- Index for quick admin lookup (very few rows, but keeps the check fast)
create index if not exists profiles_is_admin_idx on profiles(is_admin) where is_admin = true;
