-- T.9 Hedging mode
--
-- Adds `hedging_enabled` to accounts. When false (the default), the server
-- nets opposing positions on the same symbol (MT4-style netting account).
-- When true, opposing positions coexist independently (hedging account).

alter table accounts
  add column if not exists hedging_enabled boolean not null default false;
