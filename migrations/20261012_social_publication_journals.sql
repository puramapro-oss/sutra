-- T06: service-owned evidence, independent of mutable/deleted production/history rows.
-- Apply only through the reviewed deployment migration process. No remote execution here.
BEGIN;
CREATE TABLE IF NOT EXISTS sutra.social_publication_journals (
  production_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('video','auto')),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  operations jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(operations) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, production_id)
);
ALTER TABLE sutra.social_publication_journals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sutra.social_publication_journals FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON sutra.social_publication_journals TO service_role;
COMMENT ON TABLE sutra.social_publication_journals IS
  'SUTRA durable publication evidence. Never delete to retry a production; server role only.';
COMMIT;
