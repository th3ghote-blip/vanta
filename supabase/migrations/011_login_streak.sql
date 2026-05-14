-- Migration 011: daily login streak tracking on profiles
alter table profiles
  add column if not exists last_login_date date,
  add column if not exists login_streak int not null default 0;
