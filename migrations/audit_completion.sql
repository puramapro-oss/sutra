-- ============================================================
-- SUTRA — Audit completion migration
-- Adds partner_*, influencer_*, social_*, referral_codes tables
-- to the sutra schema so existing API code stops returning 500.
-- ============================================================

-- 1. Partners
CREATE TABLE IF NOT EXISTS sutra.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'website' CHECK (channel IN ('influencer','website','media','physical')),
  partner_code text UNIQUE NOT NULL,
  code text GENERATED ALWAYS AS (partner_code) STORED,
  slug text UNIQUE NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('pending','active','suspended','banned')),
  tier text DEFAULT 'bronze',
  total_referrals int DEFAULT 0,
  total_revenue numeric(10,2) DEFAULT 0,
  total_commissions numeric(10,2) DEFAULT 0,
  balance numeric(10,2) DEFAULT 0,
  current_balance numeric(10,2) GENERATED ALWAYS AS (balance) STORED,
  bio text,
  website text,
  social_links jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partners_user ON sutra.partners(user_id);
CREATE INDEX IF NOT EXISTS idx_partners_code ON sutra.partners(partner_code);

-- 2. Partner referrals
CREATE TABLE IF NOT EXISTS sutra.partner_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES sutra.partners(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_email text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','active','converted','churned')),
  plan text,
  first_payment_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_partner ON sutra.partner_referrals(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_user ON sutra.partner_referrals(referred_user_id);

-- 3. Partner commissions
CREATE TABLE IF NOT EXISTS sutra.partner_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES sutra.partners(id) ON DELETE CASCADE,
  referral_id uuid REFERENCES sutra.partner_referrals(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'first_payment' CHECK (type IN ('first_payment','recurring','milestone','bonus_physical')),
  amount numeric(10,2) NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','rejected')),
  stripe_payment_id text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON sutra.partner_commissions(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON sutra.partner_commissions(status);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_created ON sutra.partner_commissions(created_at);

-- 4. Partner payouts
CREATE TABLE IF NOT EXISTS sutra.partner_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES sutra.partners(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  method text DEFAULT 'bank',
  details jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed')),
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner ON sutra.partner_payouts(partner_id);

-- 5. Partner scans
CREATE TABLE IF NOT EXISTS sutra.partner_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES sutra.partners(id) ON DELETE CASCADE,
  scanned_at timestamptz DEFAULT now(),
  device text,
  os text,
  ip_address inet,
  country text,
  city text,
  source text DEFAULT 'qr'
);
CREATE INDEX IF NOT EXISTS idx_partner_scans_partner ON sutra.partner_scans(partner_id);

-- 6. Partner coach messages
CREATE TABLE IF NOT EXISTS sutra.partner_coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES sutra.partners(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_coach_msgs_partner ON sutra.partner_coach_messages(partner_id);

-- 7. Influencer profiles (legacy /go/[slug])
CREATE TABLE IF NOT EXISTS sutra.influencer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  display_name text,
  bio text,
  avatar_url text,
  total_clicks int DEFAULT 0,
  total_conversions int DEFAULT 0,
  total_earnings numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_influencer_slug ON sutra.influencer_profiles(slug);

-- 8. Influencer clicks
CREATE TABLE IF NOT EXISTS sutra.influencer_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid REFERENCES sutra.influencer_profiles(id) ON DELETE CASCADE,
  slug text,
  ip_address inet,
  user_agent text,
  referer text,
  country text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_influencer_clicks_inf ON sutra.influencer_clicks(influencer_id);

-- 9. Referral codes (used by /go/[slug])
CREATE TABLE IF NOT EXISTS sutra.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  uses int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON sutra.referral_codes(code);

-- 10. Social accounts (social autopilot)
CREATE TABLE IF NOT EXISTS sutra.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  account_id text NOT NULL,
  account_name text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, platform, account_id)
);
CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON sutra.social_accounts(user_id);

-- 11. Social posts
CREATE TABLE IF NOT EXISTS sutra.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid REFERENCES sutra.videos(id) ON DELETE SET NULL,
  platform text NOT NULL,
  account_id text,
  caption text,
  hashtags text[],
  status text DEFAULT 'pending' CHECK (status IN ('pending','queued','published','failed')),
  scheduled_at timestamptz,
  published_at timestamptz,
  post_id text,
  post_url text,
  error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_social_posts_user ON sutra.social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON sutra.social_posts(status);

-- 12. Social autopilot config
CREATE TABLE IF NOT EXISTS sutra.social_autopilot_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false,
  platforms text[] DEFAULT ARRAY[]::text[],
  posting_schedule jsonb DEFAULT '{}'::jsonb,
  caption_template text,
  hashtags text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE sutra.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.partner_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.partner_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.partner_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.partner_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.partner_coach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.influencer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.influencer_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.social_autopilot_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "own_partner" ON sutra.partners FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_partner_refs" ON sutra.partner_referrals FOR SELECT USING (partner_id IN (SELECT id FROM sutra.partners WHERE user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_partner_commissions" ON sutra.partner_commissions FOR SELECT USING (partner_id IN (SELECT id FROM sutra.partners WHERE user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_partner_payouts" ON sutra.partner_payouts FOR ALL USING (partner_id IN (SELECT id FROM sutra.partners WHERE user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_partner_scans" ON sutra.partner_scans FOR SELECT USING (partner_id IN (SELECT id FROM sutra.partners WHERE user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_partner_coach" ON sutra.partner_coach_messages FOR ALL USING (partner_id IN (SELECT id FROM sutra.partners WHERE user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_influencer" ON sutra.influencer_profiles FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_referral_codes" ON sutra.referral_codes FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_referral_codes" ON sutra.referral_codes FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_social_accounts" ON sutra.social_accounts FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_social_posts" ON sutra.social_posts FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_social_autopilot_config" ON sutra.social_autopilot_config FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Auto-create partner profile for super admin
-- ============================================================
INSERT INTO sutra.partners (user_id, channel, partner_code, slug, status, tier)
SELECT u.id, 'website',
  'SUTRA-' || upper(substr(md5(u.id::text), 1, 6)),
  'tissma-' || upper(substr(md5(u.id::text), 1, 4)),
  'active', 'bronze'
FROM auth.users u
WHERE u.email = 'matiss.frasne@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
