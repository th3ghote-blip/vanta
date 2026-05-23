-- T.10: Add is_primary flag to track which account the user has selected as active.
-- Safe to re-run (IF NOT EXISTS guard).

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

-- Backfill: mark the oldest account per user as their primary.
-- Only touches rows where is_primary is still false for all of a user's accounts.
WITH first_per_user AS (
  SELECT DISTINCT ON (user_id) id
  FROM accounts
  ORDER BY user_id, created_at ASC
)
UPDATE accounts a
SET is_primary = true
FROM first_per_user f
WHERE a.id = f.id
  AND a.is_primary = false;
