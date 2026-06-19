-- 21.13 — Online-users monitor.
-- Track the last time each account made an authenticated request so the admin
-- panel can list who is "online now". Stamped (throttled ~60s) from authUser().
-- Safe to re-run (IF NOT EXISTS guards).

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_seen timestamptz;

-- Index for the "seen within the last N minutes" lookup (descending = newest first).
CREATE INDEX IF NOT EXISTS accounts_last_seen_idx ON accounts (last_seen DESC NULLS LAST);
