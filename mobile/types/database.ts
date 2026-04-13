export type Plan = "free" | "starter" | "creator" | "empire" | "enterprise" | "admin";
export type Role = "user" | "admin" | "super_admin" | "influencer";
export type VideoStatus = "draft" | "generating" | "ready" | "published" | "failed";
export type VideoQuality = "720p" | "1080p" | "4k";
export type VideoFormat = "16:9" | "9:16" | "1:1";
export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "trialing" | "incomplete";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar: string | null;
  role: Role;
  plan: Plan;
  credits: number;
  daily_questions: number;
  referral_code: string;
  wallet_balance: number;
  tier: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  xp: number;
  level: number;
  streak: number;
  theme: string;
  notifications_enabled: boolean;
  metadata: Record<string, unknown> | null;
  tutorial_completed: boolean;
  purama_points: number;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  script: string | null;
  niche: string;
  voice: string;
  status: VideoStatus;
  quality: VideoQuality;
  format: VideoFormat;
  video_url: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  engine: string;
  style: string | null;
  music_url: string | null;
  subtitles_url: string | null;
  views: number;
  likes: number;
  shares: number;
  published_platforms: string[];
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  last_message: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface Achievement {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
  points_reward: number;
  condition_type: string;
  condition_value: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  achievement?: Achievement;
}

export interface LotteryDraw {
  id: string;
  app_slug: string;
  draw_date: string;
  pool_amount: number;
  status: "upcoming" | "live" | "completed";
  winners?: LotteryWinner[];
}

export interface LotteryTicket {
  id: string;
  user_id: string;
  source: string;
  draw_id: string;
  created_at: string;
}

export interface LotteryWinner {
  id: string;
  draw_id: string;
  user_id: string;
  rank: number;
  amount_won: number;
}

export interface DailyGift {
  id: string;
  user_id: string;
  app_slug: string;
  gift_type: string;
  gift_value: string;
  streak_count: number;
  opened_at: string;
}

export interface PointTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  source_app: string;
  mission_id: string | null;
  created_at: string;
}

export interface ShopItem {
  id: string;
  category: string;
  name: string;
  description: string;
  cost_points: number;
  type: "reduction" | "subscription" | "ticket" | "feature" | "cash";
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface ContestEntry {
  id: string;
  user_id: string;
  contest_type: string;
  score: number;
  rank: number | null;
  period: string;
  created_at: string;
}

export interface LoveWallPost {
  id: string;
  user_id: string;
  app_slug: string;
  content: string;
  type: "victory" | "encouragement" | "milestone" | "gratitude";
  reactions_count: number;
  pinned: boolean;
  created_at: string;
  profile?: { full_name: string; avatar: string | null };
}

export interface BuddyMatch {
  id: string;
  user_a: string;
  user_b: string;
  matched_at: string;
  streak_days: number;
  status: "active" | "paused";
}
