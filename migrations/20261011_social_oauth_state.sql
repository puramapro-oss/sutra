-- Apply before the social OAuth routes. Missing storage must fail closed.
-- No provider token or raw OAuth state is stored in this table.
BEGIN;
CREATE TABLE IF NOT EXISTS sutra.social_oauth_states (
  state_hash text PRIMARY KEY CHECK (state_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  browser_hash text NOT NULL CHECK (browser_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '15 minutes')
);
CREATE INDEX IF NOT EXISTS social_oauth_states_expiry_idx ON sutra.social_oauth_states (expires_at);
ALTER TABLE sutra.social_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sutra.social_oauth_states FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON sutra.social_oauth_states TO service_role;
COMMENT ON TABLE sutra.social_oauth_states IS
  'One-use OAuth browser binding; remove expired rows during scheduled maintenance.';
COMMIT;
