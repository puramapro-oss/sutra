-- Apply after the integrated migrations and 20261012_t02_account_permissions.sql.
-- Permission-only hardening: no balances, tokens, publication payloads or business rules change.
BEGIN;

-- TRUNCATE is not checked by RLS. GRANT ALL in sutra_auto.sql exposed every user's rows.
-- Browser roles need row operations only, never table-level integrity/DDL privileges.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA sutra FROM PUBLIC, anon, authenticated;

-- Rewards and their accounting records are written by authenticated server routes.
-- An owner policy must not allow a browser to mint its own balance or reward receipt.
DO $$
DECLARE tbl text; col record;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['purama_points', 'point_transactions', 'point_purchases',
      'point_milestones', 'daily_gifts', 'user_achievements', 'lottery_tickets']
  LOOP
    IF to_regclass(format('sutra.%I', tbl)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('REVOKE ALL ON TABLE sutra.%I FROM PUBLIC, anon, authenticated', tbl);
    FOR col IN SELECT attname FROM pg_attribute
      WHERE attrelid = to_regclass(format('sutra.%I', tbl)) AND attnum > 0 AND NOT attisdropped
    LOOP
      -- Table REVOKE does not revoke separately granted column privileges.
      EXECUTE format('REVOKE ALL (%I) ON sutra.%I FROM PUBLIC, anon, authenticated', col.attname, tbl);
    END LOOP;
    EXECUTE format('GRANT SELECT ON sutra.%I TO authenticated', tbl);
    EXECUTE format('GRANT ALL ON sutra.%I TO service_role', tbl);
    EXECUTE format('ALTER TABLE sutra.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS t02_reward_owner ON sutra.%I', tbl);
    EXECUTE format('CREATE POLICY t02_reward_owner ON sutra.%I AS RESTRICTIVE FOR ALL TO authenticated USING (user_id = auth.uid() AND sutra.account_is_active()) WITH CHECK (user_id = auth.uid() AND sutra.account_is_active())', tbl);
    EXECUTE format('DROP POLICY IF EXISTS t02_reward_read ON sutra.%I', tbl);
    EXECUTE format('CREATE POLICY t02_reward_read ON sutra.%I FOR SELECT TO authenticated USING (user_id = auth.uid())', tbl);
  END LOOP;
END $$;

-- The OAuth callback and T06 use the SUTRA schema from sql/social-autopilot.sql,
-- installed in public, not the older sutra.social_accounts table. Refuse an unknown
-- public table rather than silently changing another application's schema.
DO $$
DECLARE col record;
BEGIN
  IF to_regclass('public.social_accounts') IS NULL THEN RETURN; END IF;
  IF obj_description('public.social_accounts'::regclass, 'pg_class') IS DISTINCT FROM
      'OAuth-connected social media accounts via Zernio' THEN
    RAISE EXCEPTION 'SUTRA_SOCIAL_SCHEMA_REVIEW_REQUIRED';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.social_accounts'::regclass
      AND attnum > 0 AND NOT attisdropped
      AND attname IN ('user_id','platform','external_id','status','access_token','refresh_token','metadata')) <> 7 THEN
    RAISE EXCEPTION 'SUTRA_SOCIAL_SCHEMA_REVIEW_REQUIRED';
  END IF;
  REVOKE ALL ON public.social_accounts FROM PUBLIC, anon, authenticated;
  FOR col IN SELECT attname FROM pg_attribute
    WHERE attrelid = 'public.social_accounts'::regclass AND attnum > 0 AND NOT attisdropped
  LOOP
    EXECUTE format('REVOKE ALL (%I) ON public.social_accounts FROM PUBLIC, anon, authenticated', col.attname);
    IF col.attname = ANY (ARRAY['id','user_id','platform','external_id','username','display_name',
        'avatar_url','status','connected_at','updated_at','token_expires_at']) THEN
      EXECUTE format('GRANT SELECT (%I) ON public.social_accounts TO authenticated', col.attname);
    END IF;
  END LOOP;
  GRANT ALL ON public.social_accounts TO service_role;
  ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS t02_public_social_owner ON public.social_accounts;
  CREATE POLICY t02_public_social_owner ON public.social_accounts AS RESTRICTIVE FOR ALL TO authenticated
    USING (user_id = auth.uid() AND sutra.account_is_active())
    WITH CHECK (user_id = auth.uid() AND sutra.account_is_active());
  DROP POLICY IF EXISTS t02_public_social_read ON public.social_accounts;
  CREATE POLICY t02_public_social_read ON public.social_accounts FOR SELECT TO authenticated
    USING (user_id = auth.uid());
END $$;
COMMIT;
