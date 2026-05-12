-- 010_notification_prefs.sql
-- Adds notification_prefs JSONB column to profiles.
-- Allows per-user opt-in/opt-out of push notification categories.
-- Categories: price_alerts, robot_signals, trade_results, promotional.
-- Default is all enabled (true) so existing users keep receiving pushes.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL
    DEFAULT '{"price_alerts":true,"robot_signals":true,"trade_results":true,"promotional":true}'::jsonb;

COMMENT ON COLUMN profiles.notification_prefs IS
  'Per-user push opt-in flags. Keys: price_alerts, robot_signals, trade_results, promotional.';
