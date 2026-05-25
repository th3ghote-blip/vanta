-- T.18: Copy trading — allow users to follow another trader's positions.
-- Applies on top of: 024_account_is_primary.sql

-- 1. Opt-in flag on profiles: a user must opt in before followers can copy them.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS copy_leader_enabled boolean NOT NULL DEFAULT false;

-- 2. Core relationship table.
CREATE TABLE IF NOT EXISTS copy_relationships (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leader_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  follower_account_id uuid     NOT NULL REFERENCES accounts(id)   ON DELETE CASCADE,
  -- allocation_pct: what fraction of the leader's lot-size to mirror (1-100).
  allocation_pct   numeric(5,2) NOT NULL CHECK (allocation_pct > 0 AND allocation_pct <= 100),
  started_at       timestamptz NOT NULL DEFAULT now(),
  -- each follower can only follow a given leader once
  UNIQUE (follower_id, leader_id)
);

CREATE INDEX IF NOT EXISTS copy_rel_leader_idx   ON copy_relationships(leader_id);
CREATE INDEX IF NOT EXISTS copy_rel_follower_idx ON copy_relationships(follower_id);

-- 3. RLS — match the pattern used by the rest of the schema.
ALTER TABLE copy_relationships ENABLE ROW LEVEL SECURITY;

-- Followers can see/manage their own relationships.
CREATE POLICY "follower_owns_row"
  ON copy_relationships
  FOR ALL
  USING  (follower_id = auth.uid())
  WITH CHECK (follower_id = auth.uid());

-- Leaders can see who is following them (read-only).
CREATE POLICY "leader_sees_followers"
  ON copy_relationships
  FOR SELECT
  USING (leader_id = auth.uid());
