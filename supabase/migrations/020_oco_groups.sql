-- T.8 OCO (one-cancels-other) orders
--
-- Two pending orders that share an OCO group are linked: when one fills,
-- the orders-trigger worker cancels the others in the same group and
-- releases their reserved margin.
--
-- oco_group_id: nullable uuid. Clients mint a fresh UUID for each OCO pair
--               and submit two pending orders sharing that id. The worker
--               looks for siblings via this column on fill.
--
-- Nullable so existing rows (and non-OCO orders) are unaffected.

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS oco_group_id uuid;

-- Partial index speeds up the sibling lookup the worker performs on every
-- successful fill. Only pending rows that belong to an OCO group qualify,
-- so the index stays small.
CREATE INDEX IF NOT EXISTS trades_oco_group_idx
  ON trades (oco_group_id)
  WHERE oco_group_id IS NOT NULL AND status = 'pending';
