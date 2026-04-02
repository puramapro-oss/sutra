import pg from 'pg'
const { Client } = pg

const client = new Client({
  host: '72.62.191.111',
  port: 5432,
  user: 'postgres',
  password: '2c60bf54d83f0da9398f107fe17ebc0f',
  database: 'postgres',
})

const SQL = `
-- SUTRA Schema
CREATE SCHEMA IF NOT EXISTS sutra;

-- Profiles
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

-- Videos
CREATE TABLE IF NOT EXISTS sutra.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  tags TEXT[],
  video_url TEXT,
  thumbnail_url TEXT,
  voice_url TEXT,
  music_url TEXT,
  script_data JSONB,
  shotstack_json JSONB,
  quality TEXT DEFAULT '1080p',
  format TEXT DEFAULT '16:9',
  duration INTEGER,
  status TEXT DEFAULT 'draft',
  cost_estimate DECIMAL(10,4),
  publish_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Drafts
CREATE TABLE IF NOT EXISTS sutra.drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Video versions
CREATE TABLE IF NOT EXISTS sutra.video_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES sutra.videos(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  shotstack_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User templates
CREATE TABLE IF NOT EXISTS sutra.user_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  format TEXT DEFAULT '16:9',
  template_data JSONB,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cloned voices
CREATE TABLE IF NOT EXISTS sutra.cloned_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  elevenlabs_voice_id TEXT NOT NULL,
  preview_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User notifications
CREATE TABLE IF NOT EXISTS sutra.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Admin notifications
CREATE TABLE IF NOT EXISTS sutra.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Referral commissions
CREATE TABLE IF NOT EXISTS sutra.referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID,
  referred_id UUID,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Withdrawals
CREATE TABLE IF NOT EXISTS sutra.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 50),
  method TEXT NOT NULL,
  details JSONB,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Contest submissions
CREATE TABLE IF NOT EXISTS sutra.contest_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  video_id UUID REFERENCES sutra.videos(id),
  contest_id TEXT NOT NULL,
  ai_score INTEGER,
  community_votes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'submitted',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Autopilot series
CREATE TABLE IF NOT EXISTS sutra.autopilot_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  niche TEXT,
  frequency TEXT DEFAULT 'weekly',
  networks TEXT[],
  approval_mode TEXT DEFAULT 'auto',
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- API logs
CREATE TABLE IF NOT EXISTS sutra.api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  service TEXT NOT NULL,
  endpoint TEXT,
  status TEXT,
  response_time_ms INTEGER,
  estimated_cost DECIMAL(10,4),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Activity logs
CREATE TABLE IF NOT EXISTS sutra.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  type TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Error logs
CREATE TABLE IF NOT EXISTS sutra.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  section TEXT,
  severity TEXT,
  message TEXT NOT NULL,
  stack TEXT,
  metadata JSONB,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- App config
CREATE TABLE IF NOT EXISTS sutra.app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Testimonials
CREATE TABLE IF NOT EXISTS sutra.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,
  content TEXT NOT NULL,
  avatar_url TEXT,
  rating INTEGER DEFAULT 5,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Changelog
CREATE TABLE IF NOT EXISTS sutra.changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  badge TEXT DEFAULT 'new',
  published_at TIMESTAMPTZ DEFAULT now()
);

-- Scheduled posts
CREATE TABLE IF NOT EXISTS sutra.scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  video_id UUID REFERENCES sutra.videos(id),
  platform TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled',
  platform_post_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payments
CREATE TABLE IF NOT EXISTS sutra.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  stripe_payment_id TEXT,
  stripe_invoice_id TEXT,
  amount DECIMAL(10,2),
  amount_after_discount DECIMAL(10,2),
  discount_applied DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'eur',
  status TEXT DEFAULT 'succeeded',
  plan TEXT,
  billing_period TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Referrals
CREATE TABLE IF NOT EXISTS sutra.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID,
  referred_id UUID UNIQUE,
  referral_code TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Music cache
CREATE TABLE IF NOT EXISTS sutra.music_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  style TEXT NOT NULL,
  duration_range TEXT,
  audio_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
`

const SQL_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON sutra.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON sutra.videos(status);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON sutra.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_referral ON sutra.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe ON sutra.profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON sutra.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_service ON sutra.api_logs(service);
CREATE INDEX IF NOT EXISTS idx_api_logs_created ON sutra.api_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_user ON sutra.activity_logs(user_id);
`

const SQL_RLS = `
ALTER TABLE sutra.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.video_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.user_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.cloned_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.referral_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.contest_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.autopilot_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.referrals ENABLE ROW LEVEL SECURITY;
`

const SQL_POLICIES = `
DO $$ BEGIN CREATE POLICY "own_profiles" ON sutra.profiles FOR ALL USING (auth.uid() = id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_videos" ON sutra.videos FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_drafts" ON sutra.drafts FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_notifs" ON sutra.user_notifications FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_voices" ON sutra.cloned_voices FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_templates" ON sutra.user_templates FOR ALL USING (auth.uid() = user_id OR is_public = true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_withdrawals" ON sutra.withdrawals FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_autopilot" ON sutra.autopilot_series FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_posts" ON sutra.scheduled_posts FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_payments" ON sutra.payments FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_commissions" ON sutra.referral_commissions FOR ALL USING (auth.uid() = referrer_id OR auth.uid() = referred_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_contests" ON sutra.contest_submissions FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_referrals" ON sutra.referrals FOR ALL USING (auth.uid() = referrer_id OR auth.uid() = referred_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`

const SQL_TRIGGERS = `
CREATE OR REPLACE FUNCTION sutra.update_timestamp()
RETURNS TRIGGER AS $t$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$t$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_ts ON sutra.profiles;
CREATE TRIGGER profiles_ts BEFORE UPDATE ON sutra.profiles FOR EACH ROW EXECUTE FUNCTION sutra.update_timestamp();
DROP TRIGGER IF EXISTS videos_ts ON sutra.videos;
CREATE TRIGGER videos_ts BEFORE UPDATE ON sutra.videos FOR EACH ROW EXECUTE FUNCTION sutra.update_timestamp();

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
`

const SQL_SEED = `
INSERT INTO sutra.profiles (id, email, name, plan, is_admin, credits, onboarding_completed)
SELECT id, email, 'Tissma', 'admin', true, 999999, true
FROM auth.users WHERE email = 'matiss.frasne@gmail.com'
ON CONFLICT (email) DO UPDATE SET plan = 'admin', is_admin = true, credits = 999999;
`

async function run() {
  try {
    await client.connect()
    console.log('Connected to PostgreSQL')

    console.log('Creating schema + tables...')
    await client.query(SQL)
    console.log('Tables created')

    console.log('Creating indexes...')
    await client.query(SQL_INDEXES)
    console.log('Indexes created')

    console.log('Enabling RLS...')
    await client.query(SQL_RLS)
    console.log('RLS enabled')

    console.log('Creating policies...')
    await client.query(SQL_POLICIES)
    console.log('Policies created')

    console.log('Creating triggers...')
    await client.query(SQL_TRIGGERS)
    console.log('Triggers created')

    console.log('Seeding super admin...')
    await client.query(SQL_SEED)
    console.log('Super admin seeded')

    // Verify
    const res = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'sutra' ORDER BY table_name`)
    console.log(`\nTables created (${res.rows.length}):`)
    res.rows.forEach(r => console.log(`  - ${r.table_name}`))

    console.log('\nDONE — All tables, indexes, RLS, policies, triggers created successfully!')
  } catch (err) {
    console.error('ERROR:', err.message)
  } finally {
    await client.end()
  }
}

run()
