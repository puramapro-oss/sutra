import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/utils'
import { allProviderConfigStatus, isEnvSet, optionalEnv, requireEnv, type ProviderId } from '@/lib/env'
import { getBreakerStatus } from '@/lib/utils/api'

export const dynamic = 'force-dynamic'

/**
 * Diagnostic de configuration + connectivité — RÉSERVÉ SUPER-ADMIN.
 *
 * Garanties :
 *   - AUCUNE valeur de secret n'est lue dans la réponse (présence uniquement).
 *   - AUCUN appel génératif ou payant : seuls les endpoints GRATUITS de
 *     connectivité sont sondés (quotas gratuits / pings). Les fournisseurs
 *     sans endpoint gratuit sont vérifiés en configuration seule.
 */

async function requireAdmin(): Promise<Response | null> {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }
  if (!isSuperAdmin(user.email)) {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
  }
  return null
}

interface ProbeResult {
  provider: ProviderId
  status: 'ok' | 'error' | 'skipped'
  httpStatus?: number
  latencyMs?: number
  reason?: string
}

const PROBE_TIMEOUT_MS = 5_000

async function probe(
  provider: ProviderId,
  run: () => Promise<Response>
): Promise<ProbeResult> {
  const start = Date.now()
  try {
    const res = await run()
    return {
      provider,
      status: res.ok ? 'ok' : 'error',
      httpStatus: res.status,
      latencyMs: Date.now() - start,
    }
  } catch (err) {
    return {
      provider,
      status: 'error',
      reason: err instanceof Error ? err.name === 'TimeoutError' ? 'timeout' : err.message.slice(0, 120) : 'erreur reseau',
      latencyMs: Date.now() - start,
    }
  }
}

// Chaque sonde = endpoint GRATUIT du fournisseur (ping, recherche quota
// gratuit, lecture de compte). Jamais de génération, jamais de coût.
async function runProbes(): Promise<ProbeResult[]> {
  const jobs: Array<Promise<ProbeResult>> = []

  // Supabase — racine REST (gratuit)
  if (isEnvSet('NEXT_PUBLIC_SUPABASE_URL')) {
    const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
    const key = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    jobs.push(probe('supabase', () =>
      fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      })
    ))
  }

  // Stripe — GET /v1/balance (lecture gratuite, aucun mouvement)
  if (isEnvSet('STRIPE_SECRET_KEY')) {
    const key = requireEnv('STRIPE_SECRET_KEY')
    jobs.push(probe('stripe', () =>
      fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      })
    ))
  }

  // Pexels — recherche quota gratuit
  if (isEnvSet('PEXELS_API_KEY')) {
    const key = requireEnv('PEXELS_API_KEY')
    jobs.push(probe('pexels', () =>
      fetch('https://api.pexels.com/v1/videos/search?query=nature&per_page=1', {
        headers: { Authorization: key },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      })
    ))
  }

  // Pixabay — recherche quota gratuit
  if (isEnvSet('PIXABAY_API_KEY')) {
    const key = requireEnv('PIXABAY_API_KEY')
    jobs.push(probe('pixabay', () =>
      fetch(`https://pixabay.com/api/videos/?key=${key}&q=nature&per_page=3&safesearch=true`, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      })
    ))
  }

  // Unsplash — recherche quota gratuit
  if (isEnvSet('UNSPLASH_ACCESS_KEY')) {
    const key = requireEnv('UNSPLASH_ACCESS_KEY')
    jobs.push(probe('unsplash', () =>
      fetch('https://api.unsplash.com/search/photos?query=nature&per_page=1', {
        headers: { Authorization: `Client-ID ${key}` },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      })
    ))
  }

  // Coverr — API publique sans clé
  jobs.push(probe('coverr', () =>
    fetch('https://api.coverr.co/videos?query=nature&page_size=1', {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
  ))

  // Resend — liste des domaines (gratuit)
  if (isEnvSet('RESEND_API_KEY')) {
    const key = requireEnv('RESEND_API_KEY')
    jobs.push(probe('resend', () =>
      fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      })
    ))
  }

  // Upstash — PING (gratuit, 1 commande)
  if (isEnvSet('UPSTASH_REDIS_REST_URL') && isEnvSet('UPSTASH_REDIS_REST_TOKEN')) {
    const url = requireEnv('UPSTASH_REDIS_REST_URL')
    const token = requireEnv('UPSTASH_REDIS_REST_TOKEN')
    jobs.push(probe('upstash', () =>
      fetch(`${url.replace(/\/$/, '')}/ping`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      })
    ))
  }

  return Promise.all(jobs)
}

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const config = allProviderConfigStatus()
  const connectivity = await runProbes()

  const probed = new Set(connectivity.map((c) => c.provider))
  const nonVerifiable = config
    .filter((c) => !probed.has(c.provider) && c.configured)
    .map((c) => ({
      provider: c.provider,
      reason:
        c.probe && c.provider !== 'coverr'
          ? 'endpoint gratuit disponible mais non sondable sans appel authentifie additionnel'
          : 'aucun endpoint gratuit — verification configuration seule (tout appel serait generatif ou payant)',
    }))

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    env: optionalEnv('NODE_ENV', 'development'),
    config, // présence des variables — noms uniquement, jamais de valeurs
    connectivity,
    nonVerifiable,
    circuitBreakers: getBreakerStatus(),
    notes: [
      'Sondes = endpoints gratuits uniquement (aucune generation, aucun cout).',
      'Les fournisseurs generatifs (LTX, RunPod, Shotstack, ElevenLabs, Suno, Anthropic...) ne sont PAS appelles ici.',
    ],
  })
}
