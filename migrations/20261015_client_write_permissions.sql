-- Client permissions only. No balances, scoring rules or application rows change.
-- Server routes/webhooks remain the sole writers of referral accounting.
BEGIN;
DO $$
DECLARE tbl text; col record;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['referrals','referral_commissions','contest_submissions'] LOOP
    IF to_regclass(format('sutra.%I',tbl)) IS NULL THEN
      RAISE EXCEPTION 'SUTRA_CLIENT_WRITE_SCHEMA_REQUIRED';
    END IF;
    EXECUTE format('REVOKE ALL ON TABLE sutra.%I FROM PUBLIC, anon, authenticated',tbl);
    FOR col IN SELECT attname FROM pg_attribute
      WHERE attrelid=to_regclass(format('sutra.%I',tbl)) AND attnum>0 AND NOT attisdropped
    LOOP
      -- Separately granted column rights survive a table-level REVOKE.
      EXECUTE format('REVOKE ALL (%I) ON sutra.%I FROM PUBLIC, anon, authenticated',col.attname,tbl);
    END LOOP;
    EXECUTE format('GRANT SELECT ON sutra.%I TO authenticated',tbl);
    EXECUTE format('GRANT ALL ON sutra.%I TO service_role',tbl);
    EXECUTE format('ALTER TABLE sutra.%I ENABLE ROW LEVEL SECURITY',tbl);
  END LOOP;

  -- Preserve both existing browser submission forms, including their explicit
  -- status='submitted'. Scores, votes and outcome cannot be supplied by clients.
  FOR col IN SELECT attname FROM pg_attribute
    WHERE attrelid='sutra.contest_submissions'::regclass AND attnum>0 AND NOT attisdropped
      AND attname=ANY(ARRAY['user_id','video_id','contest_id','title','description','content_data','status'])
  LOOP
    EXECUTE format('GRANT INSERT (%I) ON sutra.contest_submissions TO authenticated',col.attname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS t01_contest_submission_input ON sutra.contest_submissions;
CREATE POLICY t01_contest_submission_input ON sutra.contest_submissions
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
    user_id=auth.uid() AND sutra.account_is_active()
    AND status='submitted' AND ai_score IS NULL AND community_votes=0
  );
COMMIT;
