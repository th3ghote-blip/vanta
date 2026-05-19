-- T.1 follow-up: partial index for the orders-trigger worker.
--
-- This had to be split out of 016: Postgres rejects referencing a
-- newly-added enum value ('pending') from the same transaction that
-- added it ("unsafe use of new value"). The Management API runs each
-- apply as a single tx, so 016 adds 'pending' to trade_status and
-- 017 (a later tx) adds the index that filters on it.
CREATE INDEX IF NOT EXISTS trades_pending_idx
  ON trades (status, order_type)
  WHERE status = 'pending';
