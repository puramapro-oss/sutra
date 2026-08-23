/**
 * Catalogue des sous-traitants techniques communs à l'écosystème (CLAUDE.md racine §5).
 * Chaque app ne liste, dans sa politique de confidentialité, que les sous-traitants qu'elle
 * utilise RÉELLEMENT (détecté par la présence de l'env var signal) — jamais un sous-traitant
 * non utilisé, même si le reste de l'écosystème s'en sert (principe de minimisation RGPD).
 *
 * Adresses vérifiées en direct (pas de mémoire figée) le 2026-08-23 :
 *  - Vercel Inc. : adresse actuelle via vercel.com/legal/privacy-policy (a déménagé depuis
 *    l'ancienne adresse Walnut, CA — ne jamais réutiliser une adresse non re-vérifiée).
 *  - Hostinger : IP réelle du VPS (72.62.191.111, cf CLAUDE.md §5 POSTGRES_HOST) résolue via
 *    lookup IP → AS47583 Hostinger International Limited, serveur physique à Paris, France.
 */
export interface DataProcessor {
  id: string;
  nom: string;
  role: string;
  paysHebergement: string;
  /** Env var dont la présence signale que l'app utilise réellement ce sous-traitant. Absent = toujours actif. */
  envVarSignal?: string;
}

export const KNOWN_PROCESSORS: DataProcessor[] = [
  {
    id: 'vercel',
    nom: 'Vercel Inc.',
    role: "Hébergement de l'application (frontend + routes API)",
    paysHebergement: 'États-Unis (clauses contractuelles types UE)',
  },
  {
    id: 'hostinger',
    nom: 'Hostinger International Ltd',
    role: 'Hébergement de la base de données et des comptes utilisateurs (Supabase auto-hébergé)',
    paysHebergement: 'Union européenne (serveur physique à Paris, France)',
  },
  {
    id: 'stripe',
    nom: 'Stripe Payments Europe Ltd',
    role: 'Traitement des paiements',
    paysHebergement: 'Union européenne / États-Unis (clauses contractuelles types UE)',
    envVarSignal: 'STRIPE_SECRET_KEY',
  },
  {
    id: 'anthropic',
    nom: 'Anthropic',
    role: "Fournisseur du modèle d'intelligence artificielle conversationnelle",
    paysHebergement: 'États-Unis (clauses contractuelles types UE)',
    envVarSignal: 'ANTHROPIC_API_KEY',
  },
  {
    id: 'openai',
    nom: 'OpenAI',
    role: 'Fonctionnalités IA complémentaires (transcription, génération)',
    paysHebergement: 'États-Unis (clauses contractuelles types UE)',
    envVarSignal: 'OPENAI_API_KEY',
  },
  {
    id: 'resend',
    nom: 'Resend',
    role: 'Envoi des emails transactionnels',
    paysHebergement: 'États-Unis (clauses contractuelles types UE)',
    envVarSignal: 'RESEND_API_KEY',
  },
  {
    id: 'sentry',
    nom: 'Sentry',
    role: 'Suivi des erreurs techniques',
    paysHebergement: 'Union européenne',
    envVarSignal: 'SENTRY_AUTH_TOKEN',
  },
  {
    id: 'posthog',
    nom: 'PostHog',
    role: "Mesure d'audience (déposée uniquement après consentement)",
    paysHebergement: 'Union européenne (instance eu.i.posthog.com)',
    envVarSignal: 'NEXT_PUBLIC_POSTHOG_KEY',
  },
  {
    id: 'betterstack',
    nom: 'BetterStack',
    role: 'Supervision de la disponibilité du service',
    paysHebergement: 'Union européenne',
    envVarSignal: 'BETTERSTACK_API_KEY',
  },
  {
    id: 'google_oauth',
    nom: 'Google Ireland Limited',
    role: 'Connexion via Google (authentification tierce)',
    paysHebergement: 'Union européenne',
    envVarSignal: 'GOOGLE_CLIENT_ID',
  },
];

/** Sous-traitants réellement actifs pour cette app (env var signal présente, ou toujours actif si aucune). */
export function activeProcessors(env: Record<string, string | undefined>): DataProcessor[] {
  return KNOWN_PROCESSORS.filter((p) => !p.envVarSignal || Boolean(env[p.envVarSignal]));
}
