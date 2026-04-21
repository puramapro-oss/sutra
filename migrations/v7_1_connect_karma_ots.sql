-- V7.1 — Stripe Connect Embedded + Karma Split 50/10/10/30 + OpenTimestamps + LTX tiers
-- 5 tables : video_proofs, connect_accounts, karma_pool_transactions, video_generations
--          + extension pool_balances (3 pools existants → 7 pools)
-- Source of truth : STRIPE_CONNECT_KARMA_V4.md V4.1 + CLAUDE.md V7.1 §36
-- Idempotent : safe à re-exécuter.

SET search_path TO sutra, public;

-- ═══════════════════════════════════════════════════════════════
-- 1. pool_balances — EXTENSION (ajoute user_pool, adya, sasu aux 3 pools V3)
-- ═══════════════════════════════════════════════════════════════
-- Pools V3 existants : reward, asso, partner
-- Pools V7.1 ajoutés : user_pool (50% split), adya (10% marketing), sasu (30% marge)
-- Le pool 'asso' V3 est RÉUTILISÉ pour les 10% Asso du split V7.1.

ALTER TABLE sutra.pool_balances
  DROP CONSTRAINT IF EXISTS pool_balances_pool_type_check;

ALTER TABLE sutra.pool_balances
  ADD CONSTRAINT pool_balances_pool_type_check
  CHECK (pool_type IN ('reward', 'asso', 'partner', 'user_pool', 'adya', 'sasu'));

INSERT INTO sutra.pool_balances (pool_type)
VALUES ('user_pool'), ('adya'), ('sasu')
ON CONFLICT (pool_type) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 2. karma_pool_transactions — archive par invoice Stripe (split 50/10/10/30)
-- ═══════════════════════════════════════════════════════════════
-- 1 ligne = 1 invoice.paid Stripe ventilée sur les 4 pools.
-- Complémente sutra.pool_transactions (1 ligne = 1 mouvement pool).

CREATE TABLE IF NOT EXISTS sutra.karma_pool_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_invoice_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE SET NULL,
  amount_ttc_eur DECIMAL(10, 2) NOT NULL CHECK (amount_ttc_eur >= 0),
  amount_ht_eur DECIMAL(10, 2) NOT NULL CHECK (amount_ht_eur >= 0),
  tva_rate DECIMAL(5, 4) NOT NULL DEFAULT 0,
  split_user_pool DECIMAL(10, 2) NOT NULL CHECK (split_user_pool >= 0),
  split_asso DECIMAL(10, 2) NOT NULL CHECK (split_asso >= 0),
  split_adya DECIMAL(10, 2) NOT NULL CHECK (split_adya >= 0),
  split_sasu DECIMAL(10, 2) NOT NULL CHECK (split_sasu >= 0),
  split_user_pool_pct DECIMAL(5, 4) NOT NULL DEFAULT 0.5000,
  split_asso_pct DECIMAL(5, 4) NOT NULL DEFAULT 0.1000,
  split_adya_pct DECIMAL(5, 4) NOT NULL DEFAULT 0.1000,
  split_sasu_pct DECIMAL(5, 4) NOT NULL DEFAULT 0.3000,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_karma_pool_tx_user ON sutra.karma_pool_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_karma_pool_tx_created ON sutra.karma_pool_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_karma_pool_tx_processed ON sutra.karma_pool_transactions(processed_at) WHERE processed_at IS NOT NULL;

ALTER TABLE sutra.karma_pool_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "karma_pool_tx_service_only" ON sutra.karma_pool_transactions;
CREATE POLICY "karma_pool_tx_service_only" ON sutra.karma_pool_transactions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Trigger : auto-vérif que split_* = amount_ht_eur (tolérance 0.01€ arrondi)
CREATE OR REPLACE FUNCTION sutra.check_karma_split_integrity()
RETURNS TRIGGER AS $$
DECLARE
  total DECIMAL(10, 2);
BEGIN
  total := NEW.split_user_pool + NEW.split_asso + NEW.split_adya + NEW.split_sasu;
  IF ABS(total - NEW.amount_ht_eur) > 0.01 THEN
    RAISE EXCEPTION 'Karma split integrity failure : sum(%) != amount_ht_eur(%)', total, NEW.amount_ht_eur;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_karma_split_integrity ON sutra.karma_pool_transactions;
CREATE TRIGGER trg_karma_split_integrity
  BEFORE INSERT OR UPDATE ON sutra.karma_pool_transactions
  FOR EACH ROW EXECUTE FUNCTION sutra.check_karma_split_integrity();

-- ═══════════════════════════════════════════════════════════════
-- 3. connect_accounts — Stripe Connect Express comptes users
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sutra.connect_accounts (
  user_id UUID PRIMARY KEY REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL UNIQUE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  requirements_currently_due TEXT[] NOT NULL DEFAULT '{}',
  requirements_past_due TEXT[] NOT NULL DEFAULT '{}',
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  country TEXT NOT NULL DEFAULT 'FR',
  default_currency TEXT NOT NULL DEFAULT 'eur',
  kyc_verified_at TIMESTAMPTZ,
  last_webhook_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connect_accounts_stripe ON sutra.connect_accounts(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_connect_accounts_payouts_enabled ON sutra.connect_accounts(payouts_enabled) WHERE payouts_enabled = TRUE;

ALTER TABLE sutra.connect_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "connect_accounts_own_read" ON sutra.connect_accounts;
CREATE POLICY "connect_accounts_own_read" ON sutra.connect_accounts
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "connect_accounts_service_write" ON sutra.connect_accounts;
CREATE POLICY "connect_accounts_service_write" ON sutra.connect_accounts
  FOR ALL USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Trigger : updated_at auto
CREATE OR REPLACE FUNCTION sutra.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_connect_accounts_touch ON sutra.connect_accounts;
CREATE TRIGGER trg_connect_accounts_touch
  BEFORE UPDATE ON sutra.connect_accounts
  FOR EACH ROW EXECUTE FUNCTION sutra.touch_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 4. video_proofs — horodatage blockchain OpenTimestamps (Bitcoin)
-- ═══════════════════════════════════════════════════════════════
-- Chaque vidéo générée → SHA256 du MP4 → stamp OTS → .ots stocké Supabase Storage
-- Flow asynchrone : pending (stamp immédiat calendar) → upgraded (CRON horaire Bitcoin)

CREATE TABLE IF NOT EXISTS sutra.video_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES sutra.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  content_sha256 TEXT NOT NULL,
  ots_proof_base64 TEXT NOT NULL,
  ots_upgraded_proof TEXT,
  storage_path TEXT NOT NULL,
  storage_public_url TEXT,
  blockchain TEXT NOT NULL DEFAULT 'bitcoin',
  bitcoin_block_height INTEGER,
  bitcoin_timestamp TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'upgraded', 'verified', 'failed')),
  failure_reason TEXT,
  last_upgrade_attempt_at TIMESTAMPTZ,
  upgrade_attempts INTEGER NOT NULL DEFAULT 0 CHECK (upgrade_attempts >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  upgraded_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  UNIQUE(video_id)
);

CREATE INDEX IF NOT EXISTS idx_video_proofs_user ON sutra.video_proofs(user_id);
CREATE INDEX IF NOT EXISTS idx_video_proofs_status ON sutra.video_proofs(status);
CREATE INDEX IF NOT EXISTS idx_video_proofs_pending ON sutra.video_proofs(created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_video_proofs_sha ON sutra.video_proofs(content_sha256);

ALTER TABLE sutra.video_proofs ENABLE ROW LEVEL SECURITY;

-- Lecture : own + public via /api/verify/[videoId] (service_role bypass côté API)
DROP POLICY IF EXISTS "video_proofs_own_read" ON sutra.video_proofs;
CREATE POLICY "video_proofs_own_read" ON sutra.video_proofs
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "video_proofs_service_write" ON sutra.video_proofs;
CREATE POLICY "video_proofs_service_write" ON sutra.video_proofs
  FOR ALL USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- 5. video_generations — tracking engine usage par génération (LTX pro/fast, WAN, fallback)
-- ═══════════════════════════════════════════════════════════════
-- Sert à : analytics coût par plan, detection dérive free→LTX, debug fallback chain.

CREATE TABLE IF NOT EXISTS sutra.video_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  video_id UUID REFERENCES sutra.videos(id) ON DELETE SET NULL,
  user_plan TEXT NOT NULL,
  engine_requested TEXT NOT NULL
    CHECK (engine_requested IN ('ltx', 'wan', 'pexels', 'shotstack')),
  model_requested TEXT NOT NULL,
  engine_used TEXT NOT NULL
    CHECK (engine_used IN ('ltx', 'wan', 'pexels', 'shotstack')),
  model_used TEXT NOT NULL,
  fallback_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  fallback_reason TEXT,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  cost_eur_estimated DECIMAL(8, 4) CHECK (cost_eur_estimated IS NULL OR cost_eur_estimated >= 0),
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_gen_user ON sutra.video_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_video_gen_created ON sutra.video_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_gen_engine ON sutra.video_generations(engine_used, model_used);
CREATE INDEX IF NOT EXISTS idx_video_gen_fallback ON sutra.video_generations(fallback_triggered)
  WHERE fallback_triggered = TRUE;

ALTER TABLE sutra.video_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "video_gen_own_read" ON sutra.video_generations;
CREATE POLICY "video_gen_own_read" ON sutra.video_generations
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "video_gen_service_write" ON sutra.video_generations;
CREATE POLICY "video_gen_service_write" ON sutra.video_generations
  FOR ALL USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- 6. Grants service_role (sécurité belt-and-suspenders)
-- ═══════════════════════════════════════════════════════════════

GRANT ALL ON sutra.pool_balances TO service_role;
GRANT ALL ON sutra.karma_pool_transactions TO service_role;
GRANT ALL ON sutra.connect_accounts TO service_role;
GRANT ALL ON sutra.video_proofs TO service_role;
GRANT ALL ON sutra.video_generations TO service_role;

GRANT SELECT ON sutra.video_proofs TO authenticated;
GRANT SELECT ON sutra.connect_accounts TO authenticated;
GRANT SELECT ON sutra.video_generations TO authenticated;

-- Fin migration V7.1
