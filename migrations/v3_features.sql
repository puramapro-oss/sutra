-- ============================================================
-- SUTRA V3 — All missing CLAUDE.md features migration
-- Points, Daily Gift, Boutique, Achievements, Lottery,
-- Community, Viralité, Notifications IA, Emails, Feedback
-- ============================================================

-- =============================================
-- 1. PURAMA POINTS SYSTEM
-- =============================================
CREATE TABLE IF NOT EXISTS sutra.purama_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0,
  lifetime_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purama_points_user ON sutra.purama_points(user_id);
CREATE INDEX IF NOT EXISTS idx_purama_points_balance ON sutra.purama_points(balance DESC);

CREATE TABLE IF NOT EXISTS sutra.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn','spend','convert','bonus','admin')),
  source TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user ON sutra.point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created ON sutra.point_transactions(created_at);

CREATE TABLE IF NOT EXISTS sutra.point_shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('reduction','subscription','ticket','feature','cash')),
  name TEXT NOT NULL,
  description TEXT,
  cost_points INTEGER NOT NULL,
  value JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.point_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES sutra.point_shop_items(id),
  points_spent INTEGER NOT NULL,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_point_purchases_user ON sutra.point_purchases(user_id);

CREATE TABLE IF NOT EXISTS sutra.point_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_reached INTEGER NOT NULL,
  amount_converted DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add purama_points column to profiles
ALTER TABLE sutra.profiles ADD COLUMN IF NOT EXISTS purama_points INTEGER DEFAULT 0;
ALTER TABLE sutra.profiles ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE sutra.profiles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE sutra.profiles ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0;
ALTER TABLE sutra.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- =============================================
-- 2. DAILY GIFT SYSTEM
-- =============================================
CREATE TABLE IF NOT EXISTS sutra.daily_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gift_type TEXT NOT NULL CHECK (gift_type IN ('points_small','points_large','coupon_small','coupon_large','ticket','credits','mega_coupon')),
  gift_value JSONB NOT NULL,
  streak_count INTEGER DEFAULT 1,
  opened_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_daily_gifts_user ON sutra.daily_gifts(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_gifts_opened ON sutra.daily_gifts(opened_at);

-- =============================================
-- 3. ACHIEVEMENTS SYSTEM
-- =============================================
CREATE TABLE IF NOT EXISTS sutra.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  xp_reward INTEGER DEFAULT 0,
  points_reward INTEGER DEFAULT 0,
  category TEXT DEFAULT 'general',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sutra.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES sutra.achievements(id),
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON sutra.user_achievements(user_id);

-- =============================================
-- 4. LOTTERY / TIRAGE SYSTEM
-- =============================================
CREATE TABLE IF NOT EXISTS sutra.lottery_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_date TIMESTAMPTZ NOT NULL,
  pool_amount DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','live','completed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.lottery_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('inscription','parrainage','mission','partage','note','challenge','streak','abo','achat_points')),
  draw_id UUID REFERENCES sutra.lottery_draws(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lottery_tickets_user ON sutra.lottery_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_lottery_tickets_draw ON sutra.lottery_tickets(draw_id);

CREATE TABLE IF NOT EXISTS sutra.lottery_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id UUID NOT NULL REFERENCES sutra.lottery_draws(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  ticket_id UUID REFERENCES sutra.lottery_tickets(id),
  rank INTEGER NOT NULL,
  amount_won DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 5. CONTEST RESULTS & POOLS
-- =============================================
CREATE TABLE IF NOT EXISTS sutra.contest_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('weekly','monthly','special')),
  winners JSONB NOT NULL DEFAULT '[]'::jsonb,
  amounts JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_pool DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.pool_balances (
  pool_type TEXT PRIMARY KEY CHECK (pool_type IN ('reward','asso','partner')),
  balance DECIMAL(10,2) DEFAULT 0,
  total_in DECIMAL(10,2) DEFAULT 0,
  total_out DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.pool_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_type TEXT NOT NULL REFERENCES sutra.pool_balances(pool_type),
  amount DECIMAL(10,2) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  reason TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Initialize pools
INSERT INTO sutra.pool_balances (pool_type) VALUES ('reward'), ('asso'), ('partner')
ON CONFLICT (pool_type) DO NOTHING;

-- =============================================
-- 6. SOCIAL SHARES & VIRALITÉ
-- =============================================
CREATE TABLE IF NOT EXISTS sutra.social_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_code TEXT NOT NULL,
  platform_hint TEXT,
  points_given INTEGER DEFAULT 0,
  shared_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_social_shares_user ON sutra.social_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_social_shares_code ON sutra.social_shares(share_code);

CREATE TABLE IF NOT EXISTS sutra.share_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID REFERENCES sutra.social_shares(id),
  new_user_id UUID REFERENCES auth.users(id),
  bonus_points_given INTEGER DEFAULT 0,
  converted_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenged_contact TEXT NOT NULL,
  challenged_user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  target INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','completed','expired')),
  winner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON sutra.challenges(challenger_id);

CREATE TABLE IF NOT EXISTS sutra.shareable_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_type TEXT NOT NULL,
  image_url TEXT,
  shared_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('birthday','signup_anniversary')),
  event_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_events_user ON sutra.user_events(user_id);

CREATE TABLE IF NOT EXISTS sutra.community_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  current_value INTEGER DEFAULT 0,
  reward_points INTEGER DEFAULT 0,
  achieved BOOLEAN DEFAULT false,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 7. COMMUNAUTÉ D'AMOUR
-- =============================================
CREATE TABLE IF NOT EXISTS sutra.love_circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective TEXT NOT NULL,
  max_members INTEGER DEFAULT 12,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.circle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES sutra.love_circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('member','captain')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  streak_days INTEGER DEFAULT 0,
  UNIQUE (circle_id, user_id)
);

CREATE TABLE IF NOT EXISTS sutra.buddies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ DEFAULT now(),
  streak_days INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','paused','ended'))
);

CREATE TABLE IF NOT EXISTS sutra.buddy_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buddy_pair_id UUID NOT NULL REFERENCES sutra.buddies(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT,
  mood_emoji TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.love_wall_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'victory' CHECK (type IN ('victory','encouragement','milestone','gratitude')),
  reactions_count INTEGER DEFAULT 0,
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_love_wall_created ON sutra.love_wall_posts(created_at DESC);

CREATE TABLE IF NOT EXISTS sutra.love_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES sutra.love_wall_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS sutra.love_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  target_value INTEGER NOT NULL,
  current_value INTEGER DEFAULT 0,
  reward_type TEXT DEFAULT 'points',
  reward_value INTEGER DEFAULT 0,
  ong_donation_amount DECIMAL(10,2) DEFAULT 0,
  deadline TIMESTAMPTZ,
  achieved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.love_mission_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES sutra.love_missions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contribution_value INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.mentorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','paused'))
);

CREATE TABLE IF NOT EXISTS sutra.mentor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorship_id UUID NOT NULL REFERENCES sutra.mentorships(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.gratitude_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tagged_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.love_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  ai_suggested BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  gratitude_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.victory_ceremonies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL,
  highlights_json JSONB DEFAULT '[]'::jsonb,
  participants_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 8. NOTIFICATIONS INTELLIGENTES IA
-- =============================================
CREATE TABLE IF NOT EXISTS sutra.user_notification_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_hour INTEGER DEFAULT 10,
  preferred_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5]::integer[],
  engagement_score INTEGER DEFAULT 50,
  avg_open_rate DECIMAL(5,2) DEFAULT 0,
  last_active TIMESTAMPTZ DEFAULT now(),
  notification_style TEXT DEFAULT 'encouraging' CHECK (notification_style IN ('encouraging','informative','warm'))
);

CREATE TABLE IF NOT EXISTS sutra.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  days_of_week INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,7]::integer[],
  hour_start INTEGER DEFAULT 9,
  hour_end INTEGER DEFAULT 20,
  frequency TEXT DEFAULT 'normal' CHECK (frequency IN ('low','normal','high')),
  paused_until TIMESTAMPTZ,
  UNIQUE (user_id, type)
);

CREATE TABLE IF NOT EXISTS sutra.push_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  opened BOOLEAN DEFAULT false,
  engagement_score_at_send INTEGER
);
CREATE INDEX IF NOT EXISTS idx_push_log_user ON sutra.push_log(user_id);

-- =============================================
-- 9. EMAIL SEQUENCES
-- =============================================
CREATE TABLE IF NOT EXISTS sutra.email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  opened BOOLEAN DEFAULT false,
  clicked BOOLEAN DEFAULT false,
  UNIQUE (user_id, email_type)
);
CREATE INDEX IF NOT EXISTS idx_email_sequences_user ON sutra.email_sequences(user_id);

CREATE TABLE IF NOT EXISTS sutra.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  html_template TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 10. USER FEEDBACK & REVIEWS
-- =============================================
CREATE TABLE IF NOT EXISTS sutra.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  category TEXT,
  points_given INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sutra.review_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  triggered_by TEXT NOT NULL,
  shown_at TIMESTAMPTZ DEFAULT now(),
  response TEXT CHECK (response IN ('accepted','later','never')),
  points_given INTEGER DEFAULT 0
);

-- =============================================
-- 11. USER COUPONS
-- =============================================
CREATE TABLE IF NOT EXISTS sutra.user_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_percent INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('parrainage','daily','email','points','event')),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_coupons_user ON sutra.user_coupons(user_id);

-- =============================================
-- 12. CONTACT MESSAGES
-- =============================================
CREATE TABLE IF NOT EXISTS sutra.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  responded BOOLEAN DEFAULT false
);

-- =============================================
-- RLS FOR ALL NEW TABLES
-- =============================================
ALTER TABLE sutra.purama_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.point_shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.point_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.point_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.daily_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.lottery_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.lottery_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.lottery_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.contest_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.pool_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.pool_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.social_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.share_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.shareable_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.community_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.love_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.buddies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.buddy_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.love_wall_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.love_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.love_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.love_mission_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.mentorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.mentor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.gratitude_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.love_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.victory_ceremonies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.user_notification_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.push_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.review_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.user_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.contact_messages ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================
DO $$ BEGIN CREATE POLICY "own_purama_points" ON sutra.purama_points FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_point_transactions" ON sutra.point_transactions FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "read_shop_items" ON sutra.point_shop_items FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_point_purchases" ON sutra.point_purchases FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_point_milestones" ON sutra.point_milestones FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_daily_gifts" ON sutra.daily_gifts FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "read_achievements" ON sutra.achievements FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_user_achievements" ON sutra.user_achievements FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "read_lottery_draws" ON sutra.lottery_draws FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_lottery_tickets" ON sutra.lottery_tickets FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "read_lottery_winners" ON sutra.lottery_winners FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "read_contest_results" ON sutra.contest_results FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "read_pool_balances" ON sutra.pool_balances FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_social_shares" ON sutra.social_shares FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_challenges" ON sutra.challenges FOR ALL USING (auth.uid() = challenger_id OR auth.uid() = challenged_user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_shareable_cards" ON sutra.shareable_cards FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_user_events" ON sutra.user_events FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "read_community_goals" ON sutra.community_goals FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "read_love_circles" ON sutra.love_circles FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_circle_members" ON sutra.circle_members FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_buddies" ON sutra.buddies FOR ALL USING (auth.uid() = user_a OR auth.uid() = user_b); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_buddy_checkins" ON sutra.buddy_checkins FOR ALL USING (auth.uid() = sender_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "read_love_wall" ON sutra.love_wall_posts FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_love_wall_write" ON sutra.love_wall_posts FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_love_reactions" ON sutra.love_reactions FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "read_love_missions" ON sutra.love_missions FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_love_contributions" ON sutra.love_mission_contributions FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_mentorships" ON sutra.mentorships FOR ALL USING (auth.uid() = mentor_id OR auth.uid() = mentee_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_mentor_messages" ON sutra.mentor_messages FOR ALL USING (auth.uid() = sender_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_gratitude" ON sutra.gratitude_entries FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_love_letters" ON sutra.love_letters FOR ALL USING (auth.uid() = sender_id OR auth.uid() = recipient_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "read_victory_ceremonies" ON sutra.victory_ceremonies FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_notif_profiles" ON sutra.user_notification_profiles FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_notif_prefs" ON sutra.notification_preferences FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_push_log" ON sutra.push_log FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_email_sequences" ON sutra.email_sequences FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "read_email_templates" ON sutra.email_templates FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_feedback" ON sutra.user_feedback FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_review_prompts" ON sutra.review_prompts FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own_coupons" ON sutra.user_coupons FOR ALL USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "insert_contact" ON sutra.contact_messages FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- SEED: 15 ACHIEVEMENTS FOR SUTRA
-- =============================================
INSERT INTO sutra.achievements (key, name, description, icon, xp_reward, points_reward, category, sort_order) VALUES
  ('first_video', 'Première Réalisation', 'Crée ta première vidéo', 'film', 100, 100, 'creation', 1),
  ('ten_videos', 'Réalisateur Prolifique', 'Crée 10 vidéos', 'clapperboard', 500, 300, 'creation', 2),
  ('fifty_videos', 'Studio Indépendant', 'Crée 50 vidéos', 'video', 1000, 500, 'creation', 3),
  ('first_publish', 'Sur les Écrans', 'Publie ta première vidéo', 'share-2', 200, 200, 'publish', 4),
  ('multi_platform', 'Multi-Diffusion', 'Publie sur 3 plateformes', 'globe', 300, 300, 'publish', 5),
  ('first_referral', 'Découvreur de Talents', 'Parraine ton premier créateur', 'users', 200, 200, 'social', 6),
  ('ten_referrals', 'Agent de Talents', 'Parraine 10 créateurs', 'star', 500, 500, 'social', 7),
  ('streak_7', 'Semaine Créative', '7 jours de connexion consécutifs', 'flame', 200, 150, 'engagement', 8),
  ('streak_30', 'Mois de Création', '30 jours de connexion consécutifs', 'zap', 500, 400, 'engagement', 9),
  ('streak_100', 'Légende du Cinéma', '100 jours consécutifs', 'crown', 1000, 500, 'engagement', 10),
  ('first_wallet', 'Premier Cachet', 'Reçois tes premiers gains', 'wallet', 100, 100, 'monetization', 11),
  ('autopilot_master', 'Pilote Automatique', 'Active le mode autonome', 'bot', 300, 200, 'creation', 12),
  ('voice_clone', 'Voix Unique', 'Clone ta première voix', 'mic', 200, 200, 'creation', 13),
  ('community_first', 'Esprit d''Équipe', 'Rejoins un cercle créatif', 'heart', 150, 150, 'social', 14),
  ('feedback_given', 'Critique Constructif', 'Donne ton premier feedback', 'message-circle', 100, 200, 'social', 15)
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- SEED: BOUTIQUE ITEMS
-- =============================================
INSERT INTO sutra.point_shop_items (category, name, description, cost_points, value, sort_order) VALUES
  ('reduction', '-10% sur l''abonnement', 'Réduction de 10% sur ton prochain mois', 1000, '{"discount_percent": 10, "duration_days": 30}'::jsonb, 1),
  ('reduction', '-30% sur l''abonnement', 'Réduction de 30% sur ton prochain mois', 3000, '{"discount_percent": 30, "duration_days": 30}'::jsonb, 2),
  ('reduction', '-50% sur l''abonnement', 'Réduction de 50% sur ton prochain mois', 5000, '{"discount_percent": 50, "duration_days": 30}'::jsonb, 3),
  ('subscription', '1 mois Starter offert', 'Accès Starter pendant 30 jours', 15000, '{"plan": "starter", "duration_days": 30}'::jsonb, 4),
  ('subscription', '1 mois Creator offert', 'Accès Creator pendant 30 jours', 30000, '{"plan": "creator", "duration_days": 30}'::jsonb, 5),
  ('subscription', '1 mois Empire offert', 'Accès Empire pendant 30 jours', 50000, '{"plan": "empire", "duration_days": 30}'::jsonb, 6),
  ('ticket', '1 ticket tirage mensuel', 'Un ticket pour le prochain tirage', 500, '{"tickets": 1}'::jsonb, 7),
  ('feature', '+3 vidéos supplémentaires', '3 crédits vidéo bonus ce mois', 2000, '{"credits": 3}'::jsonb, 8),
  ('cash', 'Convertir 10 000 pts → 1€', 'Convertis tes points en euros wallet', 10000, '{"amount_eur": 1}'::jsonb, 9),
  ('cash', 'Convertir 50 000 pts → 5€', 'Convertis tes points en euros wallet', 50000, '{"amount_eur": 5}'::jsonb, 10)
ON CONFLICT DO NOTHING;

-- =============================================
-- AUTO-CREATE POINTS FOR EXISTING USERS
-- =============================================
INSERT INTO sutra.purama_points (user_id, balance, lifetime_earned)
SELECT id, 0, 0 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- =============================================
-- TRIGGER: Auto-create points entry for new users
-- =============================================
CREATE OR REPLACE FUNCTION sutra.handle_new_user_points()
RETURNS TRIGGER AS $t$
BEGIN
  INSERT INTO sutra.purama_points (user_id, balance, lifetime_earned)
  VALUES (NEW.id, 100, 100)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO sutra.point_transactions (user_id, amount, type, source, description)
  VALUES (NEW.id, 100, 'earn', 'inscription', 'Bonus d''inscription');

  INSERT INTO sutra.user_events (user_id, event_type, event_date)
  VALUES (NEW.id, 'signup_anniversary', CURRENT_DATE);

  RETURN NEW;
END;
$t$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_sutra_points ON auth.users;
CREATE TRIGGER on_auth_user_created_sutra_points AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sutra.handle_new_user_points();
