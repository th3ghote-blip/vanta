-- T.1: Pending limit orders (also lays groundwork for T.2 stop / T.3 stop_limit)
--
-- Adds:
--   trades.order_type   (default 'market', constrained to one of
--                        'market' | 'limit' | 'stop' | 'stop_limit')
--   trades.trigger_price (numeric, nullable; required by route logic when
--                         order_type != 'market', not enforced at DB level)
--
-- Status enum: extends trade_status with 'pending'. The existing enum already
-- has 'cancelled' (British double-l), so pending-order cancels reuse it.
--
-- Index trades_pending_idx accelerates the orders-trigger worker's per-tick
-- scan: SELECT … WHERE status='pending' AND order_type IN (...).

-- 1. Add 'pending' to the trade_status enum (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'pending'
      AND enumtypid = 'trade_status'::regtype
  ) THEN
    ALTER TYPE trade_status ADD VALUE 'pending';
  END IF;
END
$$;

-- 2. order_type column with CHECK constraint covering all 4 future values.
ALTER TABLE trades ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'market';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trades_order_type_check'
  ) THEN
    ALTER TABLE trades
      ADD CONSTRAINT trades_order_type_check
      CHECK (order_type IN ('market', 'limit', 'stop', 'stop_limit'));
  END IF;
END
$$;

-- 3. trigger_price (nullable; market orders leave it null).
ALTER TABLE trades ADD COLUMN IF NOT EXISTS trigger_price numeric(18,5);

-- 4. Partial index for the orders-trigger worker.
CREATE INDEX IF NOT EXISTS trades_pending_idx
  ON trades (status, order_type)
  WHERE status = 'pending';
