import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createServiceClient()

    // Check if profiles table exists
    const { error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)

    if (checkError && checkError.code === '42P01') {
      return NextResponse.json({
        status: 'needs_setup',
        message: 'Tables need to be created. Run the SQL below in Supabase SQL Editor.',
        sql_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}`,
        sql: getCreateTableSQL(),
      })
    }

    // Verify key tables
    const tables = ['profiles', 'videos', 'user_notifications', 'api_logs']
    const results: Record<string, string> = {}

    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1)
      results[table] = error ? `error: ${error.code}` : 'ok'
    }

    // Check super admin
    const { data: admin } = await supabase
      .from('profiles')
      .select('id, email, plan, is_admin')
      .eq('email', 'matiss.frasne@gmail.com')
      .single()

    return NextResponse.json({
      status: 'ok',
      tables: results,
      super_admin: admin ? 'exists' : 'not_found',
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Setup failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}

function getCreateTableSQL(): string {
  return `
-- SUTRA Schema
CREATE SCHEMA IF NOT EXISTS sutra;

CREATE TABLE IF NOT EXISTS sutra.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free',
  is_admin BOOLEAN DEFAULT false,
  credits INTEGER DEFAULT 0,
  referral_code TEXT UNIQUE,
  referred_by UUID,
  wallet_balance DECIMAL(10,2) DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT,
  preferred_niche TEXT,
  preferred_voice_style TEXT,
  preferred_quality TEXT DEFAULT '1080p',
  brand_kit JSONB,
  theme_mode TEXT DEFAULT 'dark',
  email_preferences JSONB DEFAULT '{"welcome":true,"digest":true,"inactivity":true,"tips":true,"contest":true,"referral":true}',
  onboarding_completed BOOLEAN DEFAULT false,
  monthly_video_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  title TEXT, description TEXT, tags TEXT[],
  video_url TEXT, thumbnail_url TEXT, voice_url TEXT, music_url TEXT,
  script_data JSONB, shotstack_json JSONB,
  quality TEXT DEFAULT '1080p', format TEXT DEFAULT '16:9',
  duration INTEGER, status TEXT DEFAULT 'draft',
  cost_estimate DECIMAL(10,4), publish_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, data JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(), created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.video_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES sutra.videos(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL, shotstack_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.user_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT, format TEXT DEFAULT '16:9',
  template_data JSONB, is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.cloned_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL, elevenlabs_voice_id TEXT NOT NULL, preview_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL,
  read BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL,
  data JSONB, read BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID, referred_id UUID,
  amount DECIMAL(10,2) NOT NULL, status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL, method TEXT NOT NULL,
  details JSONB, status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.contest_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  video_id UUID, contest_id TEXT NOT NULL,
  ai_score INTEGER, community_votes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'submitted', created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.autopilot_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL, niche TEXT,
  frequency TEXT DEFAULT 'weekly', networks TEXT[],
  approval_mode TEXT DEFAULT 'auto',
  is_active BOOLEAN DEFAULT true, last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ, config JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, service TEXT NOT NULL, endpoint TEXT,
  status TEXT, response_time_ms INTEGER,
  estimated_cost DECIMAL(10,4), error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, type TEXT NOT NULL, description TEXT,
  metadata JSONB, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, section TEXT, severity TEXT,
  message TEXT NOT NULL, stack TEXT, metadata JSONB,
  resolved BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.app_config (
  key TEXT PRIMARY KEY, value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, role TEXT, content TEXT NOT NULL,
  avatar_url TEXT, rating INTEGER DEFAULT 5,
  is_visible BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, description TEXT NOT NULL,
  badge TEXT DEFAULT 'new', published_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  video_id UUID, platform TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ, status TEXT DEFAULT 'scheduled',
  platform_post_id TEXT, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, stripe_payment_id TEXT, stripe_invoice_id TEXT,
  amount DECIMAL(10,2), amount_after_discount DECIMAL(10,2),
  discount_applied DECIMAL(10,2) DEFAULT 0, currency TEXT DEFAULT 'eur',
  status TEXT DEFAULT 'succeeded', plan TEXT, billing_period TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID, referred_id UUID UNIQUE, referral_code TEXT,
  status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.music_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  style TEXT NOT NULL, duration_range TEXT, audio_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_videos_user ON sutra.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON sutra.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe ON sutra.profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_notif_user ON sutra.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_svc ON sutra.api_logs(service);

-- RLS
ALTER TABLE sutra.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.cloned_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.user_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.autopilot_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.payments ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  CREATE POLICY "own_profiles" ON sutra.profiles FOR ALL USING (auth.uid() = id);
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "own_videos" ON sutra.videos FOR ALL USING (auth.uid() = user_id);
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "own_drafts" ON sutra.drafts FOR ALL USING (auth.uid() = user_id);
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "own_notifs" ON sutra.user_notifications FOR ALL USING (auth.uid() = user_id);
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "own_voices" ON sutra.cloned_voices FOR ALL USING (auth.uid() = user_id);
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "own_templates" ON sutra.user_templates FOR ALL USING (auth.uid() = user_id OR is_public = true);
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "own_withdrawals" ON sutra.withdrawals FOR ALL USING (auth.uid() = user_id);
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "own_autopilot" ON sutra.autopilot_series FOR ALL USING (auth.uid() = user_id);
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "own_posts" ON sutra.scheduled_posts FOR ALL USING (auth.uid() = user_id);
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "own_payments" ON sutra.payments FOR ALL USING (auth.uid() = user_id);
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Triggers
CREATE OR REPLACE FUNCTION sutra.update_timestamp()
RETURNS TRIGGER AS $t$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$t$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_ts ON sutra.profiles;
CREATE TRIGGER profiles_ts BEFORE UPDATE ON sutra.profiles FOR EACH ROW EXECUTE FUNCTION sutra.update_timestamp();
DROP TRIGGER IF EXISTS videos_ts ON sutra.videos;
CREATE TRIGGER videos_ts BEFORE UPDATE ON sutra.videos FOR EACH ROW EXECUTE FUNCTION sutra.update_timestamp();

-- Auto-create profile on auth signup
CREATE OR REPLACE FUNCTION sutra.handle_new_user()
RETURNS TRIGGER AS $t$
BEGIN
  INSERT INTO sutra.profiles (id, email, name, referral_code)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'SUTRA-' || upper(substr(md5(random()::text), 1, 6)))
  ON CONFLICT (email) DO NOTHING;
  RETURN NEW;
END;
$t$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_sutra ON auth.users;
CREATE TRIGGER on_auth_user_created_sutra AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sutra.handle_new_user();

-- Seed super admin
INSERT INTO sutra.profiles (id, email, name, plan, is_admin, credits, onboarding_completed)
SELECT id, email, 'Tissma', 'admin', true, 999999, true
FROM auth.users WHERE email = 'matiss.frasne@gmail.com'
ON CONFLICT (email) DO UPDATE SET plan = 'admin', is_admin = true, credits = 999999;
`
}
