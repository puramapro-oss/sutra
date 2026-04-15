-- V6 FINAL — Ambassador tiers + Social Feed + Purama Score cache
SET search_path TO sutra, public;

-- ============================================================
-- 1. Ambassador tiers (section 10)
-- ============================================================
CREATE TABLE IF NOT EXISTS sutra.ambassador_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL,
  tier_level INT NOT NULL CHECK (tier_level BETWEEN 1 AND 9),
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prime_paid_cents INT NOT NULL DEFAULT 0,
  UNIQUE(user_id, tier_level)
);

CREATE INDEX IF NOT EXISTS idx_ambassador_user ON sutra.ambassador_tiers(user_id);
ALTER TABLE sutra.ambassador_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ambassador_own_read" ON sutra.ambassador_tiers;
CREATE POLICY "ambassador_own_read" ON sutra.ambassador_tiers
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 2. Social Feed (section 10)
-- ============================================================
CREATE TABLE IF NOT EXISTS sutra.social_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'tier_bronze', 'tier_silver', 'tier_gold', 'tier_platinum',
    'tier_diamond', 'tier_legend', 'tier_titan', 'tier_god', 'tier_eternal',
    'first_withdrawal', 'mode_power', 'mode_titan', 'mode_eternal',
    'score_milestone', 'season_winner', 'streak_milestone'
  )),
  display_name TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_feed_created ON sutra.social_feed(created_at DESC);
ALTER TABLE sutra.social_feed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "social_feed_read_all" ON sutra.social_feed;
CREATE POLICY "social_feed_read_all" ON sutra.social_feed
  FOR SELECT USING (true);

-- ============================================================
-- 3. Purama Score cache (section 10)
-- ============================================================
CREATE TABLE IF NOT EXISTS sutra.purama_scores (
  user_id UUID PRIMARY KEY REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 1000),
  nature_score INT NOT NULL DEFAULT 0,
  streak_score INT NOT NULL DEFAULT 0,
  filleuls_score INT NOT NULL DEFAULT 0,
  marketplace_score INT NOT NULL DEFAULT 0,
  missions_score INT NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sutra.purama_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scores_read_all" ON sutra.purama_scores;
CREATE POLICY "scores_read_all" ON sutra.purama_scores
  FOR SELECT USING (true);

-- ============================================================
-- 4. Magic Moments (premier retrait — section 10)
-- ============================================================
CREATE TABLE IF NOT EXISTS sutra.magic_moments (
  user_id UUID PRIMARY KEY REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  first_withdrawal_at TIMESTAMPTZ,
  first_withdrawal_amount DECIMAL(10, 2),
  animation_shown BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sutra.magic_moments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "magic_own_all" ON sutra.magic_moments;
CREATE POLICY "magic_own_all" ON sutra.magic_moments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
