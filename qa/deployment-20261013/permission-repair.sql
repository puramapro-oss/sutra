BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='90s';
-- 20261013_job_service_permissions.sql
-- Apply after the 20261012 permission migrations, including on existing installs.
-- RLS policies do not grant SQL privileges. Do not rely on the DDL owner's
-- default ACLs: supabase_admin and postgres may have different defaults.

GRANT USAGE ON SCHEMA sutra TO service_role;
GRANT SELECT, INSERT, UPDATE ON sutra.video_jobs, sutra.video_quota_counters
  TO service_role;
-- Deliberately no client grant, DELETE, TRUNCATE or change to RLS/RPC security.
NOTIFY pgrst, 'reload schema';

-- 20261013_feature_service_permissions.sql
-- Legacy v3 tables used by authenticated server routes also lack owner defaults.
-- Explicit SUTRA allowlist; optional feature tables may be absent on minimal installs.
-- Never grant clients money/reward writes or change a business rule or RLS policy.

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'achievements', 'buddies', 'buddy_checkins', 'circle_members',
    'contest_results', 'daily_gifts', 'email_sequences', 'gratitude_entries',
    'lottery_draws', 'lottery_tickets', 'lottery_winners', 'love_circles',
    'love_reactions', 'love_wall_posts', 'point_purchases', 'point_shop_items',
    'point_transactions', 'pool_balances', 'pool_transactions', 'purama_points',
    'share_conversions', 'social_shares', 'user_achievements', 'user_coupons',
    'user_feedback']
  LOOP
    IF to_regclass(format('sutra.%I', tbl)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON sutra.%I TO service_role', tbl);
  END LOOP;
  -- Only the existing reaction toggle needs deletion; durable journals are excluded.
  IF to_regclass('sutra.love_reactions') IS NOT NULL THEN
    GRANT DELETE ON sutra.love_reactions TO service_role;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';

COMMIT;
