-- SUTRA only. Apply with the migration owner (BYPASSRLS); never with a browser role.
-- Does not change public.social_accounts or any storage bucket shared with another app.
BEGIN;

-- Billing updates subscription_status; they must not silently undo an administrative ban.
ALTER TABLE sutra.profiles ADD COLUMN IF NOT EXISTS access_revoked_at timestamptz;
UPDATE sutra.profiles SET access_revoked_at = now()
  WHERE subscription_status = 'banned' AND access_revoked_at IS NULL;

-- Owner RLS alone does not protect privileged columns on the owner's own profile.
REVOKE ALL ON TABLE sutra.profiles FROM PUBLIC, anon, authenticated;
DO $$
DECLARE col record;
BEGIN
  FOR col IN SELECT attname FROM pg_attribute
    WHERE attrelid = 'sutra.profiles'::regclass AND attnum > 0 AND NOT attisdropped
  LOOP
    EXECUTE format('REVOKE ALL (%I) ON sutra.profiles FROM PUBLIC, anon, authenticated', col.attname);
    IF col.attname = ANY (ARRAY['name', 'avatar_url', 'preferred_niche', 'preferred_voice_style',
        'preferred_quality', 'brand_kit', 'theme_mode', 'email_preferences',
        'onboarding_completed', 'tutorial_completed']) THEN
      EXECUTE format('GRANT UPDATE (%I) ON sutra.profiles TO authenticated', col.attname);
    END IF;
  END LOOP;
END $$;
GRANT SELECT ON sutra.profiles TO authenticated;
GRANT ALL ON sutra.profiles TO service_role;
ALTER TABLE sutra.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS t02_profile_owner ON sutra.profiles;
CREATE POLICY t02_profile_owner ON sutra.profiles AS RESTRICTIVE
  FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS t02_profile_read ON sutra.profiles;
CREATE POLICY t02_profile_read ON sutra.profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS t02_profile_preferences ON sutra.profiles;
CREATE POLICY t02_profile_preferences ON sutra.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Tokens and connected-account authority belong to the server, even for the owner.
DO $$
DECLARE col record;
BEGIN
  IF to_regclass('sutra.social_accounts') IS NOT NULL THEN
    REVOKE ALL ON sutra.social_accounts FROM PUBLIC, anon, authenticated;
    FOR col IN SELECT attname FROM pg_attribute
      WHERE attrelid = 'sutra.social_accounts'::regclass AND attnum > 0 AND NOT attisdropped
    LOOP
      EXECUTE format('REVOKE ALL (%I) ON sutra.social_accounts FROM PUBLIC, anon, authenticated', col.attname);
      IF col.attname = ANY (ARRAY['id', 'user_id', 'platform', 'account_id', 'account_name',
          'external_id', 'username', 'display_name', 'avatar_url', 'is_active', 'status',
          'created_at', 'updated_at', 'connected_at']) THEN
        EXECUTE format('GRANT SELECT (%I) ON sutra.social_accounts TO authenticated', col.attname);
      END IF;
    END LOOP;
    GRANT ALL ON sutra.social_accounts TO service_role;
    ALTER TABLE sutra.social_accounts ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS t02_social_owner ON sutra.social_accounts;
    CREATE POLICY t02_social_owner ON sutra.social_accounts AS RESTRICTIVE FOR ALL TO authenticated
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    DROP POLICY IF EXISTS t02_social_read ON sutra.social_accounts;
    CREATE POLICY t02_social_read ON sutra.social_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- The V7 award helper bypasses RLS and accepts a free beneficiary and amount.
-- Default PUBLIC EXECUTE must not turn it into a browser-accessible credit endpoint.
DO $$
BEGIN
  IF to_regprocedure('sutra.karma_award_seeds(uuid,integer,text,uuid,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION sutra.karma_award_seeds(uuid,integer,text,uuid,text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION sutra.karma_award_seeds(uuid,integer,text,uuid,text) TO service_role;
    ALTER FUNCTION sutra.karma_award_seeds(uuid,integer,text,uuid,text) SET search_path = '';
  END IF;
END $$;

-- Recheck application revocation in the database too: an existing JWT is insufficient.
-- SECURITY DEFINER prevents recursion when evaluating the profiles policy itself.
CREATE OR REPLACE FUNCTION sutra.account_is_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (
  SELECT 1 FROM sutra.profiles WHERE id = auth.uid()
    AND access_revoked_at IS NULL AND subscription_status IS DISTINCT FROM 'banned'
) $$;
REVOKE ALL ON FUNCTION sutra.account_is_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sutra.account_is_active() TO authenticated, service_role;

DO $$
DECLARE tbl record;
BEGIN
  -- Restrictive policies intersect existing ownership/publication rules, never widen them.
  -- Future RLS tables must receive the same policy in their own migrations.
  FOR tbl IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'sutra' AND c.relkind IN ('r', 'p') AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS t02_active_account ON sutra.%I', tbl.relname);
    EXECUTE format('CREATE POLICY t02_active_account ON sutra.%I AS RESTRICTIVE FOR ALL TO authenticated USING (sutra.account_is_active()) WITH CHECK (sutra.account_is_active())', tbl.relname);
  END LOOP;
END $$;
COMMIT;
