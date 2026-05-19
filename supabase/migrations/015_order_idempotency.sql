-- R.5: Order-open idempotency
-- Allows callers to supply a client_request_id (UUID) with an order-open request.
-- If the same (account_id, client_request_id) pair is seen again the server returns
-- the existing trade row rather than opening a duplicate.

ALTER TABLE trades ADD COLUMN IF NOT EXISTS client_request_id text;

-- Partial unique index: only enforced when client_request_id is not null,
-- so legacy / non-idempotent requests are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS trades_account_client_request_uidx
  ON trades (account_id, client_request_id)
  WHERE client_request_id IS NOT NULL;
