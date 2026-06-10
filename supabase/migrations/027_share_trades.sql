-- 18.6 — "Share my trades" toggle, default ON for everyone.
-- When true, the user's closed trade history is visible to other logged-in
-- users (copy-trading discovery + leaderboards). Backend routes that return
-- another user's trades must check this and 403 when false.
alter table profiles add column if not exists share_trades boolean not null default true;
