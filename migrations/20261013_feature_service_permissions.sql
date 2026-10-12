-- Legacy v3 tables used by authenticated server routes also lack owner defaults.
-- Explicit SUTRA allowlist; optional feature tables may be absent on minimal installs.
-- Never grant clients money/reward writes or change a business rule or RLS policy.
BEGIN;
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
