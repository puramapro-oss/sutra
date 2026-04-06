-- ============================================================
-- SUTRA — Social Autopilot Schema
-- Run: docker exec -i supabase-db psql -U supabase_admin -d postgres < social-autopilot.sql
-- ============================================================

-- --------------------------------------------------------
-- 1. social_accounts — Connected social media accounts per user
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN (
    'tiktok','youtube','instagram','facebook','x','linkedin',
    'pinterest','reddit','threads','snapchat','tumblr','mastodon','bluesky','vimeo'
  )),
  external_id text,
  username text,
  display_name text,
  avatar_url text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  status text DEFAULT 'connected' CHECK (status IN ('connected','expired','revoked','error')),
  metadata jsonb DEFAULT '{}',
  connected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, platform)
);

COMMENT ON TABLE social_accounts IS 'OAuth-connected social media accounts via Zernio';

-- --------------------------------------------------------
-- 2. social_posts — Publication history
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid,
  platform text NOT NULL,
  account_id uuid REFERENCES social_accounts(id) ON DELETE SET NULL,
  zernio_post_id text,
  external_post_id text,
  post_url text,
  caption text,
  hashtags text[],
  status text DEFAULT 'pending' CHECK (status IN ('pending','publishing','published','failed','scheduled','deleted')),
  scheduled_for timestamptz,
  published_at timestamptz,
  error_message text,
  views int DEFAULT 0,
  likes int DEFAULT 0,
  shares int DEFAULT 0,
  comments int DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE social_posts IS 'Social media publications with analytics';

-- --------------------------------------------------------
-- 3. social_autopilot_config — Per-user autopilot settings
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_autopilot_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false,
  default_platforms text[] DEFAULT ARRAY[]::text[],
  auto_caption boolean DEFAULT true,
  auto_hashtags boolean DEFAULT true,
  auto_publish_delay_minutes int DEFAULT 0,
  posting_schedule jsonb DEFAULT '{}',
  caption_style text DEFAULT 'engaging' CHECK (caption_style IN ('engaging','professional','casual','educational','humorous')),
  max_hashtags int DEFAULT 10,
  include_cta boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE social_autopilot_config IS 'User preferences for autopilot social publishing';

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_status ON social_accounts(status);

CREATE INDEX IF NOT EXISTS idx_social_posts_user_id ON social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_video_id ON social_posts(video_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_published_at ON social_posts(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_autopilot_config_user_id ON social_autopilot_config(user_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_social_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_social_accounts_updated_at ON social_accounts;
CREATE TRIGGER trigger_social_accounts_updated_at
  BEFORE UPDATE ON social_accounts
  FOR EACH ROW EXECUTE FUNCTION update_social_updated_at();

DROP TRIGGER IF EXISTS trigger_social_posts_updated_at ON social_posts;
CREATE TRIGGER trigger_social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW EXECUTE FUNCTION update_social_updated_at();

DROP TRIGGER IF EXISTS trigger_social_autopilot_config_updated_at ON social_autopilot_config;
CREATE TRIGGER trigger_social_autopilot_config_updated_at
  BEFORE UPDATE ON social_autopilot_config
  FOR EACH ROW EXECUTE FUNCTION update_social_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- social_accounts
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_accounts_select_own" ON social_accounts;
CREATE POLICY "social_accounts_select_own" ON social_accounts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "social_accounts_insert_own" ON social_accounts;
CREATE POLICY "social_accounts_insert_own" ON social_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "social_accounts_update_own" ON social_accounts;
CREATE POLICY "social_accounts_update_own" ON social_accounts
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "social_accounts_delete_own" ON social_accounts;
CREATE POLICY "social_accounts_delete_own" ON social_accounts
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "social_accounts_admin_all" ON social_accounts;
CREATE POLICY "social_accounts_admin_all" ON social_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sutra.profiles
      WHERE sutra.profiles.id = auth.uid()
        AND sutra.profiles.is_admin = true
        AND sutra.profiles.email = 'matiss.frasne@gmail.com'
    )
  );

-- social_posts
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_posts_select_own" ON social_posts;
CREATE POLICY "social_posts_select_own" ON social_posts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "social_posts_insert_own" ON social_posts;
CREATE POLICY "social_posts_insert_own" ON social_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "social_posts_update_own" ON social_posts;
CREATE POLICY "social_posts_update_own" ON social_posts
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "social_posts_delete_own" ON social_posts;
CREATE POLICY "social_posts_delete_own" ON social_posts
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "social_posts_admin_all" ON social_posts;
CREATE POLICY "social_posts_admin_all" ON social_posts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sutra.profiles
      WHERE sutra.profiles.id = auth.uid()
        AND sutra.profiles.is_admin = true
        AND sutra.profiles.email = 'matiss.frasne@gmail.com'
    )
  );

-- social_autopilot_config
ALTER TABLE social_autopilot_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_autopilot_config_select_own" ON social_autopilot_config;
CREATE POLICY "social_autopilot_config_select_own" ON social_autopilot_config
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "social_autopilot_config_insert_own" ON social_autopilot_config;
CREATE POLICY "social_autopilot_config_insert_own" ON social_autopilot_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "social_autopilot_config_update_own" ON social_autopilot_config;
CREATE POLICY "social_autopilot_config_update_own" ON social_autopilot_config
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "social_autopilot_config_admin_all" ON social_autopilot_config;
CREATE POLICY "social_autopilot_config_admin_all" ON social_autopilot_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sutra.profiles
      WHERE sutra.profiles.id = auth.uid()
        AND sutra.profiles.is_admin = true
        AND sutra.profiles.email = 'matiss.frasne@gmail.com'
    )
  );
