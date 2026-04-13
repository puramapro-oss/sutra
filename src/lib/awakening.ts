import { createClient } from "@/lib/supabase";

export interface Affirmation {
  id: string;
  category: string;
  text_fr: string;
  text_en: string;
}

const AWAKENING_LEVELS: { level: number; name: string; minXp: number }[] = [
  { level: 1, name: "Eveille", minXp: 0 },
  { level: 5, name: "Conscient", minXp: 500 },
  { level: 10, name: "Aligne", minXp: 2000 },
  { level: 20, name: "Illumine", minXp: 8000 },
  { level: 50, name: "Transcendant", minXp: 25000 },
  { level: 100, name: "Unifie", minXp: 100000 },
];

const WISDOM_QUOTES = [
  { text: "L'obstacle est le chemin.", author: "Proverbe zen" },
  { text: "Sois le changement que tu veux voir dans le monde.", author: "Gandhi" },
  { text: "Le voyage de mille lieues commence par un pas.", author: "Lao Tseu" },
  { text: "Ce que tu cherches te cherche aussi.", author: "Rumi" },
  { text: "La creativite, c'est l'intelligence qui s'amuse.", author: "Einstein" },
  { text: "Chaque matin, nous naissons de nouveau.", author: "Bouddha" },
  { text: "Fais de ta vie un reve, et d'un reve une realite.", author: "Saint-Exupery" },
  { text: "La seule facon de faire du bon travail est d'aimer ce que l'on fait.", author: "Steve Jobs" },
  { text: "Tu ne trouveras jamais l'arc-en-ciel si tu regardes en bas.", author: "Charlie Chaplin" },
  { text: "Tout ce que tu peux imaginer est reel.", author: "Picasso" },
  { text: "Le present est le seul moment qui existe.", author: "Eckhart Tolle" },
  { text: "Ne juge pas chaque jour par ta recolte, mais par les graines que tu plantes.", author: "Robert Louis Stevenson" },
];

export function getAwakeningLevel(xp: number): { level: number; name: string } {
  let result = AWAKENING_LEVELS[0];
  for (const l of AWAKENING_LEVELS) {
    if (xp >= l.minXp) result = l;
  }
  return { level: result.level, name: result.name };
}

export function getRandomQuote() {
  return WISDOM_QUOTES[Math.floor(Math.random() * WISDOM_QUOTES.length)];
}

export function getSpiritualMessage(context: "loading" | "error" | "empty" | "welcome" | "logout" | "success"): string {
  const messages: Record<string, string[]> = {
    loading: [
      "Ton espace se prepare...",
      "Un instant de presence...",
      "L'inspiration arrive...",
    ],
    error: [
      "Petit detour, on revient plus fort",
      "Chaque obstacle est une lecon",
      "Respire, on s'en occupe",
    ],
    empty: [
      "L'espace de toutes les possibilites",
      "Tout commence par une premiere creation",
      "Le vide est le debut de toute oeuvre",
    ],
    welcome: [
      "Bienvenue chez toi",
      "Ton studio t'attendait",
      "Pret a creer de la magie ?",
    ],
    logout: [
      "A tres vite, belle ame",
      "Tes creations t'attendent",
      "On se retrouve bientot",
    ],
    success: [
      "Tu vois ? Tu es capable de tout.",
      "Magnifique. Continue.",
      "Ta vision prend vie.",
    ],
  };
  const list = messages[context] || messages.loading;
  return list[Math.floor(Math.random() * list.length)];
}

export async function getAffirmation(category?: string): Promise<Affirmation | null> {
  const supabase = createClient();
  let query = supabase.from("affirmations").select("*");
  if (category) {
    query = query.eq("category", category);
  }
  const { data } = await query;
  if (!data || data.length === 0) return null;
  return data[Math.floor(Math.random() * data.length)];
}

export async function trackAwakening(
  userId: string,
  eventType: string,
  xpGained: number
): Promise<void> {
  const supabase = createClient();
  await supabase.from("awakening_events").insert({
    user_id: userId,
    event_type: eventType,
    xp_gained: xpGained,
  });
}
