-- V6 Sections 11, 15, 17, 19 — Subscribe + Prime L221-28 + Phase 1
-- Target: schéma `sutra` (chaque app a son schéma dédié).

SET search_path TO sutra, public;

-- Cleanup d'une exécution précédente qui avait créé ces tables dans `public`
DROP TABLE IF EXISTS public.prime_payouts CASCADE;
DROP TABLE IF EXISTS public.retractions CASCADE;
DROP TABLE IF EXISTS public.card_waitlist CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;

-- ============================================================
-- 1. sutra.profiles.subscription_started_at (V6 section 10)
-- ============================================================
ALTER TABLE sutra.profiles
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ NULL;

-- Backfill: plus ancien paiement succeeded, sinon created_at.
UPDATE sutra.profiles p
SET subscription_started_at = COALESCE(
  (SELECT MIN(pay.created_at) FROM sutra.payments pay
   WHERE pay.user_id = p.id AND pay.status = 'succeeded'),
  p.created_at
)
WHERE p.subscription_started_at IS NULL
  AND p.subscription_status = 'active';

CREATE INDEX IF NOT EXISTS idx_profiles_sub_started_at
  ON sutra.profiles(subscription_started_at)
  WHERE subscription_started_at IS NOT NULL;

-- ============================================================
-- 2. sutra.subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS sutra.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL DEFAULT 'sutra',
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  plan TEXT NOT NULL DEFAULT 'starter',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON sutra.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON sutra.subscriptions(status);

ALTER TABLE sutra.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subs_own_read" ON sutra.subscriptions;
CREATE POLICY "subs_own_read" ON sutra.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Backfill depuis profiles
INSERT INTO sutra.subscriptions (user_id, app_id, stripe_subscription_id, stripe_customer_id, status, plan, started_at)
SELECT id, 'sutra', stripe_subscription_id, stripe_customer_id,
       COALESCE(subscription_status, 'active'),
       COALESCE(plan, 'starter'),
       COALESCE(subscription_started_at, created_at)
FROM sutra.profiles
WHERE stripe_subscription_id IS NOT NULL
ON CONFLICT (stripe_subscription_id) DO NOTHING;

-- ============================================================
-- 3. sutra.retractions
-- ============================================================
CREATE TABLE IF NOT EXISTS sutra.retractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL DEFAULT 'sutra',
  subscription_id UUID REFERENCES sutra.subscriptions(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount_refunded_cents INT NOT NULL DEFAULT 0,
  prime_deducted_cents INT NOT NULL DEFAULT 0,
  stripe_charge_id TEXT,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_retractions_user ON sutra.retractions(user_id);
ALTER TABLE sutra.retractions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "retractions_own_read" ON sutra.retractions;
CREATE POLICY "retractions_own_read" ON sutra.retractions
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 4. sutra.card_waitlist
-- ============================================================
CREATE TABLE IF NOT EXISTS sutra.card_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL DEFAULT 'sutra',
  notified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, app_id)
);

ALTER TABLE sutra.card_waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "waitlist_own_all" ON sutra.card_waitlist;
CREATE POLICY "waitlist_own_all" ON sutra.card_waitlist
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. sutra.prime_payouts (V6 section 10 — 3 paliers)
-- ============================================================
CREATE TABLE IF NOT EXISTS sutra.prime_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL DEFAULT 'sutra',
  subscription_id UUID REFERENCES sutra.subscriptions(id) ON DELETE SET NULL,
  tranche INT NOT NULL CHECK (tranche IN (1, 2, 3)),
  amount_cents INT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  credited_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, app_id, tranche)
);

CREATE INDEX IF NOT EXISTS idx_prime_payouts_user ON sutra.prime_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_prime_payouts_scheduled
  ON sutra.prime_payouts(scheduled_at) WHERE status = 'scheduled';

ALTER TABLE sutra.prime_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prime_own_read" ON sutra.prime_payouts;
CREATE POLICY "prime_own_read" ON sutra.prime_payouts
  FOR SELECT USING (auth.uid() = user_id);
