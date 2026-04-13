-- ============================================
-- SUTRA V3 — Spiritual layer tables + seed
-- ============================================

-- Affirmations
CREATE TABLE IF NOT EXISTS sutra.affirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('love', 'power', 'abundance', 'health', 'wisdom', 'gratitude')),
  text_fr TEXT NOT NULL,
  text_en TEXT NOT NULL,
  frequency_weight INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Awakening events (XP tracking)
CREATE TABLE IF NOT EXISTS sutra.awakening_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  xp_gained INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Gratitude entries
CREATE TABLE IF NOT EXISTS sutra.gratitude_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tagged_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Intentions
CREATE TABLE IF NOT EXISTS sutra.intentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Breath sessions
CREATE TABLE IF NOT EXISTS sutra.breath_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  duration_seconds INTEGER NOT NULL,
  technique TEXT DEFAULT '4-7-8',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE sutra.affirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.awakening_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.gratitude_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.intentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.breath_sessions ENABLE ROW LEVEL SECURITY;

-- Affirmations: public read
CREATE POLICY "affirmations_select_all" ON sutra.affirmations FOR SELECT USING (true);

-- User-scoped policies
CREATE POLICY "awakening_select_own" ON sutra.awakening_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "awakening_insert_own" ON sutra.awakening_events FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gratitude_select_own" ON sutra.gratitude_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gratitude_insert_own" ON sutra.gratitude_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "intentions_select_own" ON sutra.intentions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "intentions_insert_own" ON sutra.intentions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "intentions_update_own" ON sutra.intentions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "breath_select_own" ON sutra.breath_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "breath_insert_own" ON sutra.breath_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_awakening_user ON sutra.awakening_events(user_id);
CREATE INDEX IF NOT EXISTS idx_gratitude_user ON sutra.gratitude_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_intentions_user ON sutra.intentions(user_id);
CREATE INDEX IF NOT EXISTS idx_breath_user ON sutra.breath_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_affirmations_cat ON sutra.affirmations(category);

-- ============================================
-- SEED AFFIRMATIONS (5 per category = 30)
-- ============================================
INSERT INTO sutra.affirmations (category, text_fr, text_en) VALUES
-- LOVE
('love', 'Je suis digne d''amour et de bonheur', 'I am worthy of love and happiness'),
('love', 'L''amour coule a travers chacune de mes creations', 'Love flows through every creation of mine'),
('love', 'Je m''aime tel que je suis, createur unique', 'I love myself as I am, a unique creator'),
('love', 'Chaque video que je cree porte une part de mon coeur', 'Every video I create carries a piece of my heart'),
('love', 'Je partage mon amour a travers mon art visuel', 'I share my love through my visual art'),
-- POWER
('power', 'J''ai le pouvoir de creer des histoires qui inspirent', 'I have the power to create stories that inspire'),
('power', 'Ma creativite est une force illimitee', 'My creativity is an unlimited force'),
('power', 'Chaque jour, mon talent de createur grandit', 'Every day, my talent as a creator grows'),
('power', 'Je transforme mes idees en oeuvres visuelles puissantes', 'I transform my ideas into powerful visual works'),
('power', 'Rien ne peut arreter la force de ma vision creative', 'Nothing can stop the force of my creative vision'),
-- ABUNDANCE
('abundance', 'L''abondance coule naturellement vers mes creations', 'Abundance flows naturally toward my creations'),
('abundance', 'Mes videos attirent les opportunites', 'My videos attract opportunities'),
('abundance', 'Je merite la prosperite que ma creativite genere', 'I deserve the prosperity my creativity generates'),
('abundance', 'Chaque creation est une graine de succes', 'Every creation is a seed of success'),
('abundance', 'L''univers conspire a amplifier mon message', 'The universe conspires to amplify my message'),
-- HEALTH
('health', 'Mon esprit creatif se nourrit de mon equilibre interieur', 'My creative mind is nourished by my inner balance'),
('health', 'Je prends soin de moi pour mieux creer', 'I take care of myself to create better'),
('health', 'Mon energie creative est renouvelee chaque jour', 'My creative energy is renewed every day'),
('health', 'Je respire profondement et je laisse l''inspiration venir', 'I breathe deeply and let inspiration come'),
('health', 'Mon corps et mon esprit sont alignes dans la creation', 'My body and mind are aligned in creation'),
-- WISDOM
('wisdom', 'Chaque experience enrichit ma vision artistique', 'Every experience enriches my artistic vision'),
('wisdom', 'Je suis patient — les meilleures creations prennent du temps', 'I am patient — the best creations take time'),
('wisdom', 'Ma sagesse creative grandit avec chaque projet', 'My creative wisdom grows with every project'),
('wisdom', 'Je fais confiance au processus de creation', 'I trust the creative process'),
('wisdom', 'L''echec n''existe pas, seul l''apprentissage compte', 'Failure does not exist, only learning matters'),
-- GRATITUDE
('gratitude', 'Je suis reconnaissant pour le don de la creation visuelle', 'I am grateful for the gift of visual creation'),
('gratitude', 'Merci pour chaque vue, chaque like, chaque partage', 'Thank you for every view, every like, every share'),
('gratitude', 'Je celebre chaque petite victoire creative', 'I celebrate every small creative victory'),
('gratitude', 'Gratitude pour cet outil qui donne vie a mes idees', 'Gratitude for this tool that brings my ideas to life'),
('gratitude', 'Chaque jour est une nouvelle chance de creer quelque chose de beau', 'Every day is a new chance to create something beautiful');
