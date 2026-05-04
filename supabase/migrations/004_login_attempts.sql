-- Audit log for login attempts (security / compliance).

create type login_outcome as enum ('success', 'invalid_password', 'unknown_login', 'rate_limited', 'error');

create table login_attempts (
  id bigserial primary key,
  login bigint,                      -- account login number attempted
  email text,                        -- the synthetic email if known
  ip_address text,
  user_agent text,
  outcome login_outcome not null,
  details text,
  created_at timestamptz not null default now()
);

create index login_attempts_login_idx on login_attempts(login, created_at desc);
create index login_attempts_ip_idx on login_attempts(ip_address, created_at desc);
create index login_attempts_created_idx on login_attempts(created_at desc);

-- No RLS needed — only service role writes/reads this.
