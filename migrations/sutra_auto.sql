-- ============================================================
-- SUTRA — Mode autonome (4 tables)
-- ============================================================
SET search_path TO sutra, public;

-- ------------------------------------------------------------
-- 1. CONFIG
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sutra.sutra_auto_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT false,

  schedules JSONB NOT NULL DEFAULT '[]'::jsonb,

  default_style TEXT DEFAULT 'cinematic',
  default_duration INTEGER DEFAULT 15,
  default_aspect_ratio TEXT DEFAULT '9:16',
  default_music_genre TEXT DEFAULT 'ambient',
  default_voice_enabled BOOLEAN DEFAULT false,
  default_voice_id TEXT,
  default_language TEXT DEFAULT 'fr',

  publish_platforms TEXT[] DEFAULT ARRAY['youtube','instagram','tiktok'],
  auto_publish BOOLEAN DEFAULT true,
  require_approval_before_publish BOOLEAN DEFAULT false,

  zernio_api_key TEXT,
  zernio_connected_platforms JSONB DEFAULT '[]'::jsonb,

  watermark_url TEXT,
  intro_clip_url TEXT,
  outro_clip_url TEXT,
  brand_colors JSONB,
  brand_font TEXT,

  preferred_model TEXT DEFAULT 'ltx-2-3-fast',
  quality_level TEXT DEFAULT 'high',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_config_user ON sutra.sutra_auto_config(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_config_active ON sutra.sutra_auto_config(is_active) WHERE is_active = true;

-- ------------------------------------------------------------
-- 2. THEMES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sutra.sutra_auto_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_id TEXT,

  theme TEXT NOT NULL,
  description TEXT,
  example_prompts TEXT[] DEFAULT ARRAY[]::TEXT[],

  must_include TEXT[] DEFAULT ARRAY[]::TEXT[],
  never_include TEXT[] DEFAULT ARRAY[]::TEXT[],
  target_audience TEXT,
  tone TEXT,

  weight INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ,
  times_used INTEGER DEFAULT 0,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_themes_user ON sutra.sutra_auto_themes(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_themes_active ON sutra.sutra_auto_themes(user_id, is_active);

-- ------------------------------------------------------------
-- 3. MEMORY
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sutra.sutra_auto_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  memory_type TEXT NOT NULL CHECK (memory_type IN ('preference','performance','feedback','trend','learning')),
  content TEXT NOT NULL,
  importance FLOAT DEFAULT 0.5,

  related_video_id UUID,
  related_theme TEXT,
  related_platform TEXT,

  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_memory_user ON sutra.sutra_auto_memory(user_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_auto_memory_expires ON sutra.sutra_auto_memory(expires_at) WHERE expires_at IS NOT NULL;

-- ------------------------------------------------------------
-- 4. VIDEOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sutra.sutra_auto_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_id TEXT,
  theme_id UUID REFERENCES sutra.sutra_auto_themes(id) ON DELETE SET NULL,

  status TEXT DEFAULT 'planning' CHECK (status IN (
    'planning','generating_script','generating_video','generating_audio',
    'compositing','ready','pending_approval','publishing','published','failed'
  )),

  title TEXT,
  description TEXT,
  hashtags TEXT[] DEFAULT ARRAY[]::TEXT[],
  script TEXT,
  prompt_used TEXT,
  music_prompt TEXT,

  video_raw_url TEXT,
  audio_music_url TEXT,
  audio_voice_url TEXT,
  video_final_url TEXT,
  thumbnail_url TEXT,

  published_at TIMESTAMPTZ,
  published_platforms JSONB DEFAULT '[]'::jsonb,
  zernio_job_id TEXT,

  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2),

  ai_reasoning TEXT,
  ai_confidence FLOAT,
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  user_feedback TEXT,

  scheduled_for TIMESTAMPTZ,
  generation_started_at TIMESTAMPTZ,
  generation_completed_at TIMESTAMPTZ,
  generation_duration_seconds INTEGER,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_videos_user_status ON sutra.sutra_auto_videos(user_id, status);
CREATE INDEX IF NOT EXISTS idx_auto_videos_scheduled ON sutra.sutra_auto_videos(scheduled_for) WHERE status IN ('planning','ready');
CREATE INDEX IF NOT EXISTS idx_auto_videos_published ON sutra.sutra_auto_videos(user_id, published_at DESC) WHERE published_at IS NOT NULL;

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sutra.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_config_touch ON sutra.sutra_auto_config;
CREATE TRIGGER trg_auto_config_touch BEFORE UPDATE ON sutra.sutra_auto_config
  FOR EACH ROW EXECUTE FUNCTION sutra.touch_updated_at();

DROP TRIGGER IF EXISTS trg_auto_videos_touch ON sutra.sutra_auto_videos;
CREATE TRIGGER trg_auto_videos_touch BEFORE UPDATE ON sutra.sutra_auto_videos
  FOR EACH ROW EXECUTE FUNCTION sutra.touch_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE sutra.sutra_auto_config  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.sutra_auto_themes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.sutra_auto_memory  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.sutra_auto_videos  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auto_config_owner" ON sutra.sutra_auto_config;
CREATE POLICY "auto_config_owner" ON sutra.sutra_auto_config
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "auto_themes_owner" ON sutra.sutra_auto_themes;
CREATE POLICY "auto_themes_owner" ON sutra.sutra_auto_themes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "auto_memory_owner" ON sutra.sutra_auto_memory;
CREATE POLICY "auto_memory_owner" ON sutra.sutra_auto_memory
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "auto_videos_owner" ON sutra.sutra_auto_videos;
CREATE POLICY "auto_videos_owner" ON sutra.sutra_auto_videos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Service role bypass (full access for cron jobs)
DROP POLICY IF EXISTS "auto_config_service" ON sutra.sutra_auto_config;
CREATE POLICY "auto_config_service" ON sutra.sutra_auto_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auto_themes_service" ON sutra.sutra_auto_themes;
CREATE POLICY "auto_themes_service" ON sutra.sutra_auto_themes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auto_memory_service" ON sutra.sutra_auto_memory;
CREATE POLICY "auto_memory_service" ON sutra.sutra_auto_memory
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auto_videos_service" ON sutra.sutra_auto_videos;
CREATE POLICY "auto_videos_service" ON sutra.sutra_auto_videos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Grants for PostgREST API exposure
GRANT USAGE ON SCHEMA sutra TO anon, authenticated, service_role;
GRANT ALL ON sutra.sutra_auto_config  TO authenticated, service_role;
GRANT ALL ON sutra.sutra_auto_themes  TO authenticated, service_role;
GRANT ALL ON sutra.sutra_auto_memory  TO authenticated, service_role;
GRANT ALL ON sutra.sutra_auto_videos  TO authenticated, service_role;
