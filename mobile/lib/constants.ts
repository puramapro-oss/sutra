export const APP_NAME = "SUTRA";
export const APP_SLUG = "sutra";
export const DOMAIN = "purama.dev";
export const SITE_URL = "https://sutra.purama.dev";
export const SUPER_ADMIN_EMAIL = "matiss.frasne@gmail.com";
export const WALLET_MIN_WITHDRAWAL = 5;
export const ASSO_PERCENTAGE = 10;

export const COMPANY_INFO = {
  name: "SASU PURAMA",
  address: "8 Rue de la Chapelle, 25560 Frasne",
  siret: "",
  tva: "TVA non applicable, art. 293B du CGI",
  email: "matiss.frasne@gmail.com",
  phone: "",
};

export type Plan = "free" | "starter" | "creator" | "empire" | "enterprise" | "admin";

export const PLAN_LIMITS: Record<Plan, {
  videos: number;
  quality: string;
  voices: number;
  autopilot: boolean;
  rate: number;
  templates: boolean;
  networks: number;
  studio: boolean;
}> = {
  free: { videos: 3, quality: "720p", voices: 2, autopilot: false, rate: 5, templates: false, networks: 0, studio: false },
  starter: { videos: 30, quality: "1080p", voices: 6, autopilot: false, rate: 30, templates: true, networks: 3, studio: false },
  creator: { videos: 100, quality: "1080p", voices: 6, autopilot: true, rate: 60, templates: true, networks: 7, studio: true },
  empire: { videos: 999, quality: "4k", voices: 6, autopilot: true, rate: 120, templates: true, networks: 14, studio: true },
  enterprise: { videos: 9999, quality: "4k", voices: 6, autopilot: true, rate: 300, templates: true, networks: 14, studio: true },
  admin: { videos: 999999, quality: "4k", voices: 6, autopilot: true, rate: 999, templates: true, networks: 14, studio: true },
};

export const PRICING = {
  starter: { monthly: 9, yearly: 86 },
  creator: { monthly: 29, yearly: 278 },
  empire: { monthly: 99, yearly: 950 },
} as const;

export const NICHES = [
  "bien-etre", "tech", "finance", "motivation", "lifestyle",
  "education", "divertissement", "cuisine", "sport", "voyage",
  "science", "business",
] as const;

export const VOICES = [
  { id: "thomas", name: "Thomas", gender: "male" },
  { id: "marie", name: "Marie", gender: "female" },
  { id: "narrateur", name: "Narrateur", gender: "male" },
  { id: "emma", name: "Emma", gender: "female" },
  { id: "lucas", name: "Lucas", gender: "male" },
  { id: "lea", name: "Léa", gender: "female" },
] as const;

export const REFERRAL_TIERS = [
  { name: "Bronze", min: 5, color: "#CD7F32" },
  { name: "Argent", min: 10, color: "#C0C0C0" },
  { name: "Or", min: 25, color: "#FFD700" },
  { name: "Platine", min: 50, color: "#E5E4E2" },
  { name: "Diamant", min: 75, color: "#B9F2FF" },
  { name: "Légende", min: 100, color: "#8B5CF6" },
] as const;

export const ECOSYSTEM_APPS = [
  { name: "MIDAS", slug: "midas", color: "#F59E0B", desc: "Trading IA" },
  { name: "KAÏA", slug: "kaia", color: "#06B6D4", desc: "Méditation guidée" },
  { name: "AETHER", slug: "aether", color: "#E879F9", desc: "Création artistique" },
  { name: "PRANA", slug: "prana", color: "#F472B6", desc: "Coaching sportif" },
  { name: "KASH", slug: "kash", color: "#F59E0B", desc: "Épargne intelligente" },
  { name: "Lingora", slug: "lingora", color: "#3B82F6", desc: "Langues IA" },
  { name: "AKASHA", slug: "akasha", color: "#00d4ff", desc: "Multi-expert IA" },
  { name: "VIDA", slug: "vida", color: "#10B981", desc: "Santé & bien-être" },
  { name: "EXODUS", slug: "exodus", color: "#22C55E", desc: "Développement personnel" },
  { name: "Origin", slug: "origin", color: "#D946EF", desc: "Généalogie IA" },
  { name: "LUMIOS", slug: "lumios", color: "#14B8A6", desc: "Consulting IA" },
] as const;

export const THEME = {
  primary: "#8B5CF6",
  secondary: "#06B6D4",
  background: "#0A0A0F",
  surface: "rgba(255, 255, 255, 0.05)",
  border: "rgba(255, 255, 255, 0.06)",
  text: "#FFFFFF",
  textSecondary: "rgba(255, 255, 255, 0.6)",
  textTertiary: "rgba(255, 255, 255, 0.4)",
  success: "#10B981",
  error: "#EF4444",
  warning: "#F59E0B",
  glass: {
    bg: "rgba(255, 255, 255, 0.05)",
    border: "rgba(255, 255, 255, 0.06)",
  },
} as const;
