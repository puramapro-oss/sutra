-- SUTRA only: v3_spiritual defines public-read RLS but omitted the SQL privilege.
-- Keep active-account RLS and all write/anonymous permissions unchanged.
BEGIN;
DO $$
BEGIN
  IF to_regclass('sutra.affirmations') IS NULL OR NOT EXISTS (
    SELECT FROM pg_class WHERE oid = 'sutra.affirmations'::regclass AND relrowsecurity
  ) OR NOT EXISTS (
    SELECT FROM pg_policies WHERE schemaname = 'sutra' AND tablename = 'affirmations'
      AND policyname = 'affirmations_select_all' AND cmd = 'SELECT' AND qual = 'true'
  ) OR NOT EXISTS (
    SELECT FROM pg_policies WHERE schemaname = 'sutra' AND tablename = 'affirmations'
      AND policyname = 't02_active_account' AND permissive = 'RESTRICTIVE'
      AND qual = 'sutra.account_is_active()'
  ) THEN
    RAISE EXCEPTION 'SUTRA_AFFIRMATIONS_SCHEMA_REVIEW_REQUIRED';
  END IF;
END $$;
GRANT SELECT ON sutra.affirmations TO authenticated;
DO $$
BEGIN
  IF NOT has_table_privilege('authenticated', 'sutra.affirmations', 'SELECT') THEN
    RAISE EXCEPTION 'SUTRA_AFFIRMATIONS_GRANT_NOT_APPLIED';
  END IF;
END $$;
COMMIT;
