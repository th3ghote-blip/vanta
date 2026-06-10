-- 18.10 — server-side record of risk-disclosure acceptance.
-- AsyncStorage acceptance (20.1/20.3) is device-local; this column makes it
-- durable per-user so acceptance survives device changes and is auditable.
alter table profiles add column if not exists risk_accepted_at timestamptz;
