-- T.14 Trade journal: add free-text notes field to trades
-- Safe to re-run: IF NOT EXISTS guard.
ALTER TABLE trades ADD COLUMN IF NOT EXISTS notes text;
