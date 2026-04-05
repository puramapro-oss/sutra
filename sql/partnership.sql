-- ============================================================
-- SUTRA — Partnership Module Schema
-- Run via: psql -h $POSTGRES_HOST -p 5432 -U postgres -d postgres -f partnership.sql
-- ============================================================

-- --------------------------------------------------------
-- 1. partners
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('influencer','website','media','physical')),
  partner_code text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','banned')),
  tier text DEFAULT 'bronze',
  total_referrals int DEFAULT 0,
  total_revenue numeric(10,2) DEFAULT 0,
  total_commissions numeric(10,2) DEFAULT 0,
  balance numeric(10,2) DEFAULT 0,
  bio text,
  website text,
  social_links jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE partners IS 'Partner profiles for the SUTRA partnership program (influencer, website, media, physical)';

-- --------------------------------------------------------
-- 2. partner_scans
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  scanned_at timestamptz DEFAULT now(),
  device text,
  os text,
  ip_address inet,
  country text,
  city text,
  source text DEFAULT 'qr'
);

COMMENT ON TABLE partner_scans IS 'QR/NFC scan tracking for partner links';

-- --------------------------------------------------------
-- 3. partner_referrals
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending','active','converted','churned')),
  referred_at timestamptz DEFAULT now(),
  converted_at timestamptz,
  plan text
);

COMMENT ON TABLE partner_referrals IS 'Users referred by partners with conversion tracking';

-- --------------------------------------------------------
-- 4. partner_commissions
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  referral_id uuid REFERENCES partner_referrals(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('first_payment','recurring','milestone','bonus_physical')),
  amount numeric(10,2) NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','rejected')),
  stripe_payment_id text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE partner_commissions IS 'Commission records from referral conversions and milestones';

-- --------------------------------------------------------
-- 5. partner_milestones
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  milestone_type text NOT NULL,
  milestone_value int NOT NULL,
  reward_amount numeric(10,2),
  reached_at timestamptz DEFAULT now()
);

COMMENT ON TABLE partner_milestones IS 'Milestone achievements (referral count thresholds, tier upgrades)';

-- --------------------------------------------------------
-- 6. partner_payouts
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  iban text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  requested_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

COMMENT ON TABLE partner_payouts IS 'Payout requests from partners to their IBAN';

-- --------------------------------------------------------
-- 7. partner_coach_messages
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE partner_coach_messages IS 'AI coach conversation history for partners';

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_partners_user_id ON partners(user_id);
CREATE INDEX IF NOT EXISTS idx_partners_partner_code ON partners(partner_code);
CREATE INDEX IF NOT EXISTS idx_partners_slug ON partners(slug);
CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);

CREATE INDEX IF NOT EXISTS idx_partner_scans_partner_id ON partner_scans(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_scans_scanned_at ON partner_scans(scanned_at);

CREATE INDEX IF NOT EXISTS idx_partner_referrals_partner_id ON partner_referrals(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_referred_user_id ON partner_referrals(referred_user_id);

CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner_id ON partner_commissions(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_referral_id ON partner_commissions(referral_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status);

CREATE INDEX IF NOT EXISTS idx_partner_milestones_partner_id ON partner_milestones(partner_id);

CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner_id ON partner_payouts(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_status ON partner_payouts(status);

CREATE INDEX IF NOT EXISTS idx_partner_coach_messages_partner_id ON partner_coach_messages(partner_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_partners_updated_at ON partners;
CREATE TRIGGER trigger_partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW
  EXECUTE FUNCTION update_partners_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- partners
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partners_select_own" ON partners
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "partners_insert_own" ON partners
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "partners_update_own" ON partners
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "partners_admin_all" ON partners
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- partner_scans
ALTER TABLE partner_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_scans_select_own" ON partner_scans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM partners
      WHERE partners.id = partner_scans.partner_id
        AND partners.user_id = auth.uid()
    )
  );

CREATE POLICY "partner_scans_insert_any" ON partner_scans
  FOR INSERT WITH CHECK (true);

CREATE POLICY "partner_scans_admin_all" ON partner_scans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- partner_referrals
ALTER TABLE partner_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_referrals_select_own" ON partner_referrals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM partners
      WHERE partners.id = partner_referrals.partner_id
        AND partners.user_id = auth.uid()
    )
  );

CREATE POLICY "partner_referrals_admin_all" ON partner_referrals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- partner_commissions
ALTER TABLE partner_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_commissions_select_own" ON partner_commissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM partners
      WHERE partners.id = partner_commissions.partner_id
        AND partners.user_id = auth.uid()
    )
  );

CREATE POLICY "partner_commissions_admin_all" ON partner_commissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- partner_milestones
ALTER TABLE partner_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_milestones_select_own" ON partner_milestones
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM partners
      WHERE partners.id = partner_milestones.partner_id
        AND partners.user_id = auth.uid()
    )
  );

CREATE POLICY "partner_milestones_admin_all" ON partner_milestones
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- partner_payouts
ALTER TABLE partner_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_payouts_select_own" ON partner_payouts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM partners
      WHERE partners.id = partner_payouts.partner_id
        AND partners.user_id = auth.uid()
    )
  );

CREATE POLICY "partner_payouts_insert_own" ON partner_payouts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM partners
      WHERE partners.id = partner_payouts.partner_id
        AND partners.user_id = auth.uid()
    )
  );

CREATE POLICY "partner_payouts_admin_all" ON partner_payouts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- partner_coach_messages
ALTER TABLE partner_coach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_coach_messages_select_own" ON partner_coach_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM partners
      WHERE partners.id = partner_coach_messages.partner_id
        AND partners.user_id = auth.uid()
    )
  );

CREATE POLICY "partner_coach_messages_insert_own" ON partner_coach_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM partners
      WHERE partners.id = partner_coach_messages.partner_id
        AND partners.user_id = auth.uid()
    )
  );

CREATE POLICY "partner_coach_messages_admin_all" ON partner_coach_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );
