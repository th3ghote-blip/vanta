-- Migration 005: streak tracking columns on profiles
-- Adds current_streak (resets to 0 on loss) and best_streak (all-time high).
-- Both default 0 for existing rows.

alter table profiles
  add column if not exists current_streak integer not null default 0,
  add column if not exists best_streak    integer not null default 0;
