-- T.3 Stop-limit orders
-- Adds limit_price column to trades so stop_limit orders can store both the
-- stop activation price (trigger_price, already present from 016) and the
-- limit fill price (limit_price, added here).
--
-- For stop orders and plain limit orders this column stays NULL.
-- For stop_limit orders both trigger_price and limit_price are populated:
--   buy  stop_limit: stop fires when ask >= trigger_price → fills when ask <= limit_price
--   sell stop_limit: stop fires when bid <= trigger_price → fills when bid >= limit_price
-- Constraint: for buy stop_limit  limit_price >= trigger_price
--             for sell stop_limit limit_price <= trigger_price
-- (enforced at application layer, not DB level, to keep migration simple)

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS limit_price numeric(18,5);
