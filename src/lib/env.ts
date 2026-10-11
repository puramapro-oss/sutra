// -----------------------------------------------------------------------------
// Validation centralisée des variables d'environnement.
//
// Règles :
//   - JAMAIS de valeur de secret lue, logguée ou retournée par ces fonctions
//     (seule la PRÉSENCE non-vide est vérifiée).
//   - Erreurs explicites en français, code `SUTRA_ENV_MISSING` testable.
//   - Les clés serveur sont lues À L'APPEL (jamais au top-level du module)
//     pour éviter les crashes à l'import/build et les messages absents.
// -----------------------------------------------------------------------------

/** Code d'erreur stable pour les tests contractuels et le diagnostic. */
export const ENV_MISSING_CODE = 'SUTRA_ENV_MISSING'

export class MissingEnvError extends Error {
  readonly code = ENV_MISSING_CODE
  readonly varName: string
  constructor(varName: string, context?: string) {
    super(
      `Configuration manquante : la variable ${varName} est requise${context ? ` (${context})` : ''}. ` +
        `Définis-la dans .env.local puis redémarre le serveur. ` +
        `Voir .env.example pour la liste commentée.`
    )
    this.name = 'MissingEnvError'
    this.varName = varName
  }
}

/** Présence non-vide (sans jamais exposer la valeur). */
export function isEnvSet(name: string): boolean {
  const value = process.env[name]
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Lit une variable serveur OBLIGATOIRE à l'appel.
 * @throws MissingEnvError — message explicite, jamais la valeur.
 */
export function requireEnv(name: string, context?: string): string {
  const value = process.env[name]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MissingEnvError(name, context)
  }
  return value
}

/** Variable facultative avec valeur par défaut. */
export function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name]
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

// -----------------------------------------------------------------------------
// Inventaire des intégrations — utilisé par /api/admin/health (diagnostic
// config seule, sans secret) et par les tests contractuels.
// `probe` : le fournisseur expose un endpoint GRATUIT de connectivité.
// -----------------------------------------------------------------------------

export type ProviderId =
  | 'supabase'
  | 'stripe'
  | 'anthropic'
  | 'ltx'
  | 'runpod'
  | 'shotstack'
  | 'elevenlabs'
  | 'suno'
  | 'riffusion'
  | 'replicate'
  | 'pexels'
  | 'pixabay'
  | 'unsplash'
  | 'coverr'
  | 'resend'
  | 'upstash'
  | 'posthog'
  | 'zernio'
  | 'tavily'
  | 'insee'
  | 'local-engine'

export interface ProviderSpec {
  /** Nom lisible (UI diagnostic). */
  label: string
  /** Variables serveur requises pour la fonctionnalité. */
  env: string[]
  /** Catégorie de coût pour le commentaire diagnostic. */
  cost: 'gratuit' | 'par-usage' | 'quota-gratuit'
  /** true = endpoint de santé GRATUIT disponible (connectivité vérifiable). */
  probe: boolean
  /** Rôle dans le pipeline. */
  role: string
}

export const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  supabase: { label: 'Supabase', env: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'], cost: 'gratuit', probe: true, role: 'auth + DB + storage' },
  stripe: { label: 'Stripe', env: ['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'], cost: 'par-usage', probe: true, role: 'abonnements + Connect' },
  anthropic: { label: 'Anthropic', env: ['ANTHROPIC_API_KEY'], cost: 'par-usage', probe: false, role: 'scripts IA' },
  ltx: { label: 'LTX Studio', env: ['LTX_API_KEY'], cost: 'par-usage', probe: false, role: 'vidéo IA primaire (payants)' },
  runpod: { label: 'RunPod/WAN', env: ['RUNPOD_API_KEY', 'RUNPOD_ENDPOINT_ID'], cost: 'par-usage', probe: false, role: 'vidéo IA plan gratuit + fallback' },
  shotstack: { label: 'Shotstack', env: ['SHOTSTACK_API_KEY'], cost: 'par-usage', probe: false, role: 'montage final' },
  elevenlabs: { label: 'ElevenLabs', env: ['ELEVENLABS_API_KEY'], cost: 'par-usage', probe: false, role: 'voix TTS' },
  suno: { label: 'Suno', env: ['SUNO_API_KEY'], cost: 'par-usage', probe: false, role: 'musique primaire' },
  riffusion: { label: 'Riffusion', env: ['RIFFUSION_API_KEY'], cost: 'par-usage', probe: false, role: 'musique secondaire (facultatif)' },
  replicate: { label: 'Replicate/Stable Audio', env: ['REPLICATE_API_TOKEN'], cost: 'par-usage', probe: false, role: 'musique tertiaire (facultatif)' },
  pexels: { label: 'Pexels', env: ['PEXELS_API_KEY'], cost: 'quota-gratuit', probe: true, role: 'banque vidéo/photo' },
  pixabay: { label: 'Pixabay', env: ['PIXABAY_API_KEY'], cost: 'quota-gratuit', probe: true, role: 'banque vidéo (qualité filtrée)' },
  unsplash: { label: 'Unsplash', env: ['UNSPLASH_ACCESS_KEY'], cost: 'quota-gratuit', probe: true, role: 'banque photo' },
  coverr: { label: 'Coverr', env: [], cost: 'gratuit', probe: true, role: 'banque vidéo (sans clé)' },
  resend: { label: 'Resend', env: ['RESEND_API_KEY'], cost: 'quota-gratuit', probe: true, role: 'emails transactionnels' },
  upstash: { label: 'Upstash Redis', env: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'], cost: 'quota-gratuit', probe: true, role: 'cache + rate-limit' },
  posthog: { label: 'PostHog', env: ['NEXT_PUBLIC_POSTHOG_KEY'], cost: 'quota-gratuit', probe: false, role: 'analytics produit' },
  zernio: { label: 'Zernio', env: ['ZERNIO_API_KEY'], cost: 'par-usage', probe: false, role: 'publication sociale' },
  tavily: { label: 'Tavily', env: ['TAVILY_API_KEY'], cost: 'quota-gratuit', probe: false, role: 'recherche web scripts' },
  insee: { label: 'INSEE SIRENE', env: ['INSEE_API_KEY'], cost: 'gratuit', probe: false, role: 'vérification SIRET' },
  'local-engine': { label: 'Moteur local (perso)', env: ['LOCAL_ENGINE_ENABLED', 'LOCAL_VIDEO_API_URL'], cost: 'gratuit', probe: false, role: 'vidéos du propriétaire sur Mac local — clients sur API externes' },
}

/** État de configuration d'un fournisseur — noms de variables uniquement. */
export function providerConfigStatus(id: ProviderId): {
  provider: ProviderId
  label: string
  configured: boolean
  missing: string[]
  cost: ProviderSpec['cost']
  probe: boolean
  role: string
} {
  const spec = PROVIDERS[id]
  const missing = spec.env.filter((name) => !isEnvSet(name))
  return {
    provider: id,
    label: spec.label,
    configured: missing.length === 0,
    missing,
    cost: spec.cost,
    probe: spec.probe,
    role: spec.role,
  }
}

/** Matrice complète pour le diagnostic admin. */
export function allProviderConfigStatus(): ReturnType<typeof providerConfigStatus>[] {
  return (Object.keys(PROVIDERS) as ProviderId[]).map(providerConfigStatus)
}
