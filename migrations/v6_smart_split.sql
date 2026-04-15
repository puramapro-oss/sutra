-- V6 Section 10 — Smart Split 6 sous-wallets
-- Principal 55% / Boost 15% / Emergency 10% / Dream 10% / Pending 5% / Solidaire 5%
-- Backfill careful : balance existant → Principal (aucune perte).

SET search_path TO sutra, public;

-- ============================================================
-- 1. wallets.sub_wallets JSONB
-- ============================================================
ALTER TABLE sutra.wallets
  ADD COLUMN IF NOT EXISTS sub_wallets JSONB NOT NULL DEFAULT jsonb_build_object(
    'principal',  0,
    'boost',      0,
    'emergency',  0,
    'dream',      0,
    'pending',    0,
    'solidaire',  0
  );

-- Backfill : tout l'existant va en Principal (0 perte). Idempotent.
UPDATE sutra.wallets
SET sub_wallets = jsonb_build_object(
  'principal',  COALESCE(balance, 0),
  'boost',      0,
  'emergency',  0,
  'dream',      0,
  'pending',    0,
  'solidaire',  0
)
WHERE (sub_wallets->>'principal')::numeric = 0
  AND (sub_wallets->>'boost')::numeric = 0
  AND (sub_wallets->>'emergency')::numeric = 0
  AND (sub_wallets->>'dream')::numeric = 0
  AND (sub_wallets->>'pending')::numeric = 0
  AND (sub_wallets->>'solidaire')::numeric = 0
  AND COALESCE(balance, 0) > 0;

-- ============================================================
-- 2. wallet_transactions.sub_wallet_delta JSONB (audit)
-- ============================================================
ALTER TABLE sutra.wallet_transactions
  ADD COLUMN IF NOT EXISTS sub_wallet_delta JSONB NULL;

-- ============================================================
-- 3. boost_tranches (V6 : Boost bloqué 30j + 2%/mois → retour Principal)
-- ============================================================
CREATE TABLE IF NOT EXISTS sutra.boost_tranches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  deposited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unlock_at TIMESTAMPTZ NOT NULL,
  last_interest_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'locked',
  released_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_boost_tranches_user ON sutra.boost_tranches(user_id);
CREATE INDEX IF NOT EXISTS idx_boost_tranches_unlock
  ON sutra.boost_tranches(unlock_at) WHERE status = 'locked';

ALTER TABLE sutra.boost_tranches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "boost_own_read" ON sutra.boost_tranches;
CREATE POLICY "boost_own_read" ON sutra.boost_tranches
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 4. solidaire_transfers (virement mensuel auto Asso PURAMA)
-- ============================================================
CREATE TABLE IF NOT EXISTS sutra.solidaire_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  period TEXT NOT NULL,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, period)
);

CREATE INDEX IF NOT EXISTS idx_solidaire_user ON sutra.solidaire_transfers(user_id);
ALTER TABLE sutra.solidaire_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "solidaire_own_read" ON sutra.solidaire_transfers;
CREATE POLICY "solidaire_own_read" ON sutra.solidaire_transfers
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 5. dream_goals (Dream 10% → objectif visuel)
-- ============================================================
CREATE TABLE IF NOT EXISTS sutra.dream_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_amount DECIMAL(10, 2) NOT NULL,
  current_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  achieved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sutra.dream_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dream_own_all" ON sutra.dream_goals;
CREATE POLICY "dream_own_all" ON sutra.dream_goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
