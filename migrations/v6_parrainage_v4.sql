-- V6 Section 10 — Parrainage V4 3 niveaux
-- N1 filleul direct = 50% abo à vie
-- N2 = 15% à vie
-- N3 = 7% à vie
-- Anti-fraude: 30j activité réelle avant commission

SET search_path TO sutra, public;

-- ============================================================
-- 1. referrals.level + active_since (careful backfill)
-- ============================================================
ALTER TABLE sutra.referrals
  ADD COLUMN IF NOT EXISTS level INT NOT NULL DEFAULT 1 CHECK (level IN (1, 2, 3));

ALTER TABLE sutra.referrals
  ADD COLUMN IF NOT EXISTS active_since TIMESTAMPTZ NULL;

-- Backfill: tous les referrals existants = niveau 1 (déjà default), active_since=created_at
UPDATE sutra.referrals
SET active_since = created_at
WHERE active_since IS NULL;

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_level
  ON sutra.referrals(referrer_id, level);

-- ============================================================
-- 2. Ajouter les N2 et N3 pour les filleuls existants (careful backfill)
-- Pour chaque referral (A→B) existant, si A a lui-même un parrain X :
--   créer X→B en level 2. Si X a aussi un parrain Y : créer Y→B en level 3.
-- Idempotent : ON CONFLICT DO NOTHING sur (referrer_id, referred_id).
-- ============================================================

-- Index unique pour éviter les doublons lors du backfill
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_pair_unique
  ON sutra.referrals(referrer_id, referred_id);

-- N2: grand-parent → petit-filleul
INSERT INTO sutra.referrals (referrer_id, referred_id, referral_code, status, level, active_since)
SELECT r2.referrer_id, r1.referred_id,
       COALESCE(r2.referral_code, 'BACKFILL_N2'),
       'active', 2, r1.created_at
FROM sutra.referrals r1
JOIN sutra.referrals r2 ON r2.referred_id = r1.referrer_id AND r2.level = 1
WHERE r1.level = 1
  AND r2.referrer_id != r1.referred_id
ON CONFLICT (referrer_id, referred_id) DO NOTHING;

-- N3: arrière-grand-parent → arrière-petit-filleul
INSERT INTO sutra.referrals (referrer_id, referred_id, referral_code, status, level, active_since)
SELECT r3.referrer_id, r1.referred_id,
       COALESCE(r3.referral_code, 'BACKFILL_N3'),
       'active', 3, r1.created_at
FROM sutra.referrals r1
JOIN sutra.referrals r2 ON r2.referred_id = r1.referrer_id AND r2.level = 1
JOIN sutra.referrals r3 ON r3.referred_id = r2.referrer_id AND r3.level = 1
WHERE r1.level = 1
  AND r3.referrer_id != r1.referred_id
  AND r3.referrer_id != r2.referred_id
ON CONFLICT (referrer_id, referred_id) DO NOTHING;

-- ============================================================
-- 3. referral_commissions.level + type étendu
-- ============================================================
ALTER TABLE sutra.referral_commissions
  ADD COLUMN IF NOT EXISTS level INT NOT NULL DEFAULT 1 CHECK (level IN (1, 2, 3));

CREATE INDEX IF NOT EXISTS idx_commissions_referrer
  ON sutra.referral_commissions(referrer_id, level);
