-- V7 KARMA LIGHT adapté créatif SUTRA
-- Scope activé: NAMA-Muse, Roue Dharma, Défi Collectif, Tournoi Karma, Jeu Créatif, La Vague, Quête Rare, Lightning Deals
-- Scope exclu: TERRA NOVA, NAMA-VIDA santé, KYC Onfido, Ordonnance Verte, Jackpot Terre, Bloom, Mission Solidaire, Miroir, Shadow Work

SET search_path TO sutra, public;

-- ═══════════════════════════════════════════════════════════════
-- 1. KARMA_SEEDS — balance graines par user (1 seed = 0,01€ valeur pédagogique, non convertible cash)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sutra.karma_seeds (
  user_id UUID PRIMARY KEY REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  lifetime_spent INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_spent >= 0),
  level_sanskrit TEXT NOT NULL DEFAULT 'Novice' CHECK (level_sanskrit IN ('Novice','Sadhaka','Yogin','Siddha','Mahatma')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_karma_seeds_level ON sutra.karma_seeds(level_sanskrit);

ALTER TABLE sutra.karma_seeds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "karma_seeds_own_read" ON sutra.karma_seeds;
CREATE POLICY "karma_seeds_own_read" ON sutra.karma_seeds
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt()->>'role' = 'service_role');
DROP POLICY IF EXISTS "karma_seeds_service_write" ON sutra.karma_seeds;
CREATE POLICY "karma_seeds_service_write" ON sutra.karma_seeds
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Trigger: auto-recalcul level_sanskrit selon lifetime_earned
CREATE OR REPLACE FUNCTION sutra.karma_seeds_update_level()
RETURNS TRIGGER AS $$
BEGIN
  NEW.level_sanskrit := CASE
    WHEN NEW.lifetime_earned >= 100001 THEN 'Mahatma'
    WHEN NEW.lifetime_earned >= 10001 THEN 'Siddha'
    WHEN NEW.lifetime_earned >= 1001 THEN 'Yogin'
    WHEN NEW.lifetime_earned >= 101 THEN 'Sadhaka'
    ELSE 'Novice'
  END;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_karma_seeds_level ON sutra.karma_seeds;
CREATE TRIGGER trg_karma_seeds_level
  BEFORE UPDATE ON sutra.karma_seeds
  FOR EACH ROW EXECUTE FUNCTION sutra.karma_seeds_update_level();

-- ═══════════════════════════════════════════════════════════════
-- 2. KARMA_SEED_TRANSACTIONS — ledger append-only
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sutra.karma_seed_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('earn','spend')),
  source TEXT NOT NULL,
  source_ref UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_karma_tx_user ON sutra.karma_seed_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_karma_tx_source ON sutra.karma_seed_transactions(source, created_at DESC);

ALTER TABLE sutra.karma_seed_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "karma_tx_own_read" ON sutra.karma_seed_transactions;
CREATE POLICY "karma_tx_own_read" ON sutra.karma_seed_transactions
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt()->>'role' = 'service_role');
DROP POLICY IF EXISTS "karma_tx_service_insert" ON sutra.karma_seed_transactions;
CREATE POLICY "karma_tx_service_insert" ON sutra.karma_seed_transactions
  FOR INSERT WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- 3. KARMA_MISSIONS — catalogue 15 missions créatives
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sutra.karma_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('creation','sharing','community','mastery','consistency')),
  pilier TEXT NOT NULL CHECK (pilier IN ('mental','corps','social','impact','vision','consistance','innovation')),
  seeds_reward INTEGER NOT NULL CHECK (seeds_reward > 0),
  verification_type TEXT NOT NULL CHECK (verification_type IN ('auto','manual','peer')),
  max_per_day INTEGER NOT NULL DEFAULT 1 CHECK (max_per_day > 0),
  max_per_week INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_karma_missions_active ON sutra.karma_missions(active, category);

ALTER TABLE sutra.karma_missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "karma_missions_read_all" ON sutra.karma_missions;
CREATE POLICY "karma_missions_read_all" ON sutra.karma_missions FOR SELECT USING (TRUE);

-- Seed 15 missions créatives adaptées SUTRA
INSERT INTO sutra.karma_missions (slug, title, description, category, pilier, seeds_reward, verification_type, max_per_day, max_per_week) VALUES
  ('video-daily', 'Une vidéo par jour', 'Crée au moins une vidéo aujourd''hui avec SUTRA.', 'creation', 'consistance', 30, 'auto', 1, NULL),
  ('video-cinematic', 'Plan cinématique', 'Génère une vidéo avec style cinematic et durée 15s+.', 'creation', 'mental', 50, 'auto', 2, NULL),
  ('idea-spark', 'Étincelle créative', 'Note une idée de vidéo dans Journal avant de dormir.', 'creation', 'vision', 15, 'manual', 1, NULL),
  ('share-triple', 'Triple diffusion', 'Partage une vidéo sur 3 plateformes différentes.', 'sharing', 'impact', 50, 'auto', 1, 5),
  ('share-story', 'Story virale', 'Crée une story shareable et partage-la.', 'sharing', 'social', 40, 'auto', 1, 7),
  ('feedback-give', 'Regard honnête', 'Laisse un retour constructif sur une vidéo de la communauté.', 'community', 'social', 20, 'peer', 3, NULL),
  ('collab-invite', 'Collaboration', 'Invite un·e créateur·rice à collaborer sur un projet.', 'community', 'social', 100, 'manual', 1, 2),
  ('referral-first', 'Premier filleul', 'Ton premier filleul s''inscrit via ton lien.', 'community', 'impact', 200, 'auto', 1, NULL),
  ('mastery-templates', 'Explorateur de templates', 'Utilise 3 templates différents.', 'mastery', 'innovation', 60, 'auto', 1, 3),
  ('mastery-voice', 'Voix personnalisée', 'Clone ta voix avec ElevenLabs et crée une vidéo voix-off.', 'mastery', 'innovation', 150, 'auto', 1, NULL),
  ('mastery-autopilot', 'Mode Autopilote', 'Configure un planning d''automatisation dans /auto.', 'mastery', 'vision', 120, 'manual', 1, NULL),
  ('consistency-week', 'Semaine parfaite', 'Crée une vidéo chaque jour pendant 7 jours.', 'consistency', 'consistance', 300, 'auto', 1, 1),
  ('consistency-streak-21', 'Feu sacré 21', 'Atteins 21 jours consécutifs de création.', 'consistency', 'consistance', 1000, 'auto', 1, NULL),
  ('community-wall', 'Mot d''amour', 'Poste un message sur le mur de la communauté.', 'community', 'corps', 25, 'auto', 1, 5),
  ('mastery-breathe', 'Respiration avant création', 'Fais une session 4-7-8 avant de créer.', 'mastery', 'mental', 15, 'auto', 1, NULL)
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 4. KARMA_MISSION_COMPLETIONS — tracking complétions
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sutra.karma_mission_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES sutra.karma_missions(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completion_date DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'Europe/Paris')::DATE,
  proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending','approved','rejected')),
  seeds_awarded INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_mission_comp_user_date ON sutra.karma_mission_completions(user_id, completion_date DESC);
CREATE INDEX IF NOT EXISTS idx_mission_comp_mission ON sutra.karma_mission_completions(mission_id);

ALTER TABLE sutra.karma_mission_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mission_comp_own_read" ON sutra.karma_mission_completions;
CREATE POLICY "mission_comp_own_read" ON sutra.karma_mission_completions
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt()->>'role' = 'service_role');
DROP POLICY IF EXISTS "mission_comp_service_write" ON sutra.karma_mission_completions;
CREATE POLICY "mission_comp_service_write" ON sutra.karma_mission_completions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- 5. KARMA_DHARMA_SPINS — Roue du Dharma (1 spin/jour)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sutra.karma_dharma_spins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  spin_date DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'Europe/Paris')::DATE,
  segment_index INTEGER NOT NULL CHECK (segment_index BETWEEN 0 AND 11),
  seeds_won INTEGER NOT NULL DEFAULT 0 CHECK (seeds_won >= 0),
  badge_won TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, spin_date)
);
CREATE INDEX IF NOT EXISTS idx_dharma_user ON sutra.karma_dharma_spins(user_id, spin_date DESC);

ALTER TABLE sutra.karma_dharma_spins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dharma_own_read" ON sutra.karma_dharma_spins;
CREATE POLICY "dharma_own_read" ON sutra.karma_dharma_spins
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt()->>'role' = 'service_role');
DROP POLICY IF EXISTS "dharma_service_write" ON sutra.karma_dharma_spins;
CREATE POLICY "dharma_service_write" ON sutra.karma_dharma_spins
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- 6. KARMA_DEFI_WEEKS — Défi Collectif (thème hebdo)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sutra.karma_defi_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL UNIQUE,
  week_end DATE NOT NULL,
  theme TEXT NOT NULL,
  description TEXT NOT NULL,
  pool_seeds INTEGER NOT NULL DEFAULT 5000,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','judging','closed')),
  winners_count INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_defi_status ON sutra.karma_defi_weeks(status, week_start DESC);

ALTER TABLE sutra.karma_defi_weeks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "defi_read_all" ON sutra.karma_defi_weeks;
CREATE POLICY "defi_read_all" ON sutra.karma_defi_weeks FOR SELECT USING (TRUE);

-- Seed défi courant
INSERT INTO sutra.karma_defi_weeks (week_start, week_end, theme, description, pool_seeds)
VALUES (
  date_trunc('week', NOW() AT TIME ZONE 'Europe/Paris')::DATE,
  (date_trunc('week', NOW() AT TIME ZONE 'Europe/Paris') + INTERVAL '6 days')::DATE,
  'Lumière intérieure',
  'Crée une vidéo qui capture un instant de lumière intérieure. Ambiance, pas narration. Moins de 30s.',
  5000
)
ON CONFLICT (week_start) DO NOTHING;

CREATE TABLE IF NOT EXISTS sutra.karma_defi_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  defi_week_id UUID NOT NULL REFERENCES sutra.karma_defi_weeks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  votes_count INTEGER NOT NULL DEFAULT 0,
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  seeds_awarded INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(defi_week_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_defi_sub_week ON sutra.karma_defi_submissions(defi_week_id, votes_count DESC);

ALTER TABLE sutra.karma_defi_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "defi_sub_read_all" ON sutra.karma_defi_submissions;
CREATE POLICY "defi_sub_read_all" ON sutra.karma_defi_submissions FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "defi_sub_own_insert" ON sutra.karma_defi_submissions;
CREATE POLICY "defi_sub_own_insert" ON sutra.karma_defi_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.jwt()->>'role' = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- 7. KARMA_TOURNOI_SCORES — Tournoi Karma mensuel (7 piliers)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sutra.karma_tournoi_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  score_mental INTEGER NOT NULL DEFAULT 0,
  score_corps INTEGER NOT NULL DEFAULT 0,
  score_social INTEGER NOT NULL DEFAULT 0,
  score_impact INTEGER NOT NULL DEFAULT 0,
  score_vision INTEGER NOT NULL DEFAULT 0,
  score_consistance INTEGER NOT NULL DEFAULT 0,
  score_innovation INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER GENERATED ALWAYS AS (
    score_mental + score_corps + score_social + score_impact + score_vision + score_consistance + score_innovation
  ) STORED,
  rank INTEGER,
  seeds_awarded INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, period_month)
);
CREATE INDEX IF NOT EXISTS idx_tournoi_period_score ON sutra.karma_tournoi_scores(period_month, total_score DESC);

ALTER TABLE sutra.karma_tournoi_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tournoi_read_all" ON sutra.karma_tournoi_scores;
CREATE POLICY "tournoi_read_all" ON sutra.karma_tournoi_scores FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "tournoi_service_write" ON sutra.karma_tournoi_scores;
CREATE POLICY "tournoi_service_write" ON sutra.karma_tournoi_scores
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- 8. KARMA_CREATIF — Jeu Créatif (vote communautaire)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sutra.karma_creatif_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  votes_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','winner')),
  opens_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closes_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  seeds_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_creatif_status ON sutra.karma_creatif_submissions(status, closes_at DESC);
CREATE INDEX IF NOT EXISTS idx_creatif_votes ON sutra.karma_creatif_submissions(votes_count DESC);

ALTER TABLE sutra.karma_creatif_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "creatif_read_all" ON sutra.karma_creatif_submissions;
CREATE POLICY "creatif_read_all" ON sutra.karma_creatif_submissions FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "creatif_own_insert" ON sutra.karma_creatif_submissions;
CREATE POLICY "creatif_own_insert" ON sutra.karma_creatif_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.jwt()->>'role' = 'service_role');

CREATE TABLE IF NOT EXISTS sutra.karma_creatif_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES sutra.karma_creatif_submissions(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(submission_id, voter_id)
);
CREATE INDEX IF NOT EXISTS idx_creatif_votes_sub ON sutra.karma_creatif_votes(submission_id);

ALTER TABLE sutra.karma_creatif_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "creatif_votes_read_all" ON sutra.karma_creatif_votes;
CREATE POLICY "creatif_votes_read_all" ON sutra.karma_creatif_votes FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "creatif_votes_own_insert" ON sutra.karma_creatif_votes;
CREATE POLICY "creatif_votes_own_insert" ON sutra.karma_creatif_votes
  FOR INSERT WITH CHECK (auth.uid() = voter_id OR auth.jwt()->>'role' = 'service_role');

-- Trigger: maintient votes_count à jour
CREATE OR REPLACE FUNCTION sutra.karma_creatif_update_votes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE sutra.karma_creatif_submissions SET votes_count = votes_count + 1 WHERE id = NEW.submission_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE sutra.karma_creatif_submissions SET votes_count = GREATEST(votes_count - 1, 0) WHERE id = OLD.submission_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_creatif_votes_count ON sutra.karma_creatif_votes;
CREATE TRIGGER trg_creatif_votes_count
  AFTER INSERT OR DELETE ON sutra.karma_creatif_votes
  FOR EACH ROW EXECUTE FUNCTION sutra.karma_creatif_update_votes();

-- ═══════════════════════════════════════════════════════════════
-- 9. KARMA_VAGUES — La Vague (cascade virale)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sutra.karma_vagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  parent_wave_id UUID REFERENCES sutra.karma_vagues(id) ON DELETE SET NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 10),
  title TEXT NOT NULL,
  challenge TEXT NOT NULL,
  video_url TEXT,
  seeds_awarded INTEGER NOT NULL DEFAULT 0,
  children_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','completed')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vagues_parent ON sutra.karma_vagues(parent_wave_id);
CREATE INDEX IF NOT EXISTS idx_vagues_initiator ON sutra.karma_vagues(initiator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vagues_active ON sutra.karma_vagues(status, expires_at);

ALTER TABLE sutra.karma_vagues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vagues_read_all" ON sutra.karma_vagues;
CREATE POLICY "vagues_read_all" ON sutra.karma_vagues FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "vagues_own_insert" ON sutra.karma_vagues;
CREATE POLICY "vagues_own_insert" ON sutra.karma_vagues
  FOR INSERT WITH CHECK (auth.uid() = initiator_id OR auth.jwt()->>'role' = 'service_role');

-- Trigger: incrémente children_count du parent
CREATE OR REPLACE FUNCTION sutra.karma_vagues_update_children()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_wave_id IS NOT NULL THEN
    UPDATE sutra.karma_vagues SET children_count = children_count + 1 WHERE id = NEW.parent_wave_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vagues_children ON sutra.karma_vagues;
CREATE TRIGGER trg_vagues_children
  AFTER INSERT ON sutra.karma_vagues
  FOR EACH ROW EXECUTE FUNCTION sutra.karma_vagues_update_children();

-- ═══════════════════════════════════════════════════════════════
-- 10. KARMA_QUETE_STREAKS — Quête Rare (21 vidéos consécutives)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sutra.karma_quete_streaks (
  user_id UUID PRIMARY KEY REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  best_streak INTEGER NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
  last_video_date DATE,
  completed_at TIMESTAMPTZ,
  completions_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sutra.karma_quete_streaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quete_own_read" ON sutra.karma_quete_streaks;
CREATE POLICY "quete_own_read" ON sutra.karma_quete_streaks
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt()->>'role' = 'service_role');
DROP POLICY IF EXISTS "quete_service_write" ON sutra.karma_quete_streaks;
CREATE POLICY "quete_service_write" ON sutra.karma_quete_streaks
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- 11. KARMA_LIGHTNING_DEALS — Lightning Deals (flash 10 min)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sutra.karma_lightning_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  action_label TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('create_video','share','like','comment','invite')),
  seeds_reward INTEGER NOT NULL CHECK (seeds_reward > 0),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  max_claimers INTEGER NOT NULL DEFAULT 100,
  claimers_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lightning_active ON sutra.karma_lightning_deals(status, ends_at);

ALTER TABLE sutra.karma_lightning_deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lightning_read_all" ON sutra.karma_lightning_deals;
CREATE POLICY "lightning_read_all" ON sutra.karma_lightning_deals FOR SELECT USING (TRUE);

CREATE TABLE IF NOT EXISTS sutra.karma_lightning_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES sutra.karma_lightning_deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seeds_awarded INTEGER NOT NULL DEFAULT 0,
  UNIQUE(deal_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_lightning_claims_user ON sutra.karma_lightning_claims(user_id, claimed_at DESC);

ALTER TABLE sutra.karma_lightning_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lightning_claims_own_read" ON sutra.karma_lightning_claims;
CREATE POLICY "lightning_claims_own_read" ON sutra.karma_lightning_claims
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt()->>'role' = 'service_role');
DROP POLICY IF EXISTS "lightning_claims_service_write" ON sutra.karma_lightning_claims;
CREATE POLICY "lightning_claims_service_write" ON sutra.karma_lightning_claims
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- 12. Fonction helper: accorder seeds à un user (ledger + balance + level auto)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION sutra.karma_award_seeds(
  p_user_id UUID,
  p_amount INTEGER,
  p_source TEXT,
  p_source_ref UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  INSERT INTO sutra.karma_seeds (user_id, balance, lifetime_earned)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = sutra.karma_seeds.balance + p_amount,
      lifetime_earned = sutra.karma_seeds.lifetime_earned + p_amount;

  INSERT INTO sutra.karma_seed_transactions (user_id, amount, direction, source, source_ref, reason)
  VALUES (p_user_id, p_amount, 'earn', p_source, p_source_ref, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- FIN migration v7_karma_light.sql
-- 11 tables, RLS partout, 15 missions seedées, 1 défi courant seedé.
-- ═══════════════════════════════════════════════════════════════
