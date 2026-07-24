import { NextResponse } from 'next/server'

// Limiteur en mémoire — suffisant pour un déploiement mono-instance (dev/staging actuel).
// Limite : ne partage pas l'état entre plusieurs instances serverless en prod à grande échelle ;
// si SUTRA passe multi-instance, migrer vers Upstash Redis (clé écosystème déjà provisionnée
// au niveau management, mais aucune base Redis dédiée sutra n'existe encore — décision
// d'infra à prendre par Tissma, pas prise unilatéralement ici).
const hits = new Map<string, { count: number; resetAt: number }>()

// Purge paresseuse : une clé jamais revisitée après expiration resterait sinon en mémoire
// pour toute la durée de vie du process (fuite lente sur un déploiement long-running).
let dernierBalayage = Date.now()
function balayerEntreesExpirees(now: number): void {
  if (now - dernierBalayage < 60_000) return
  dernierBalayage = now
  for (const [cle, entree] of hits) {
    if (entree.resetAt <= now) hits.delete(cle)
  }
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSec: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  balayerEntreesExpirees(now)
  const entry = hits.get(key)

  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSec: 0 }
  }

  if (entry.count >= limit) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count += 1
  return { allowed: true, retryAfterSec: 0 }
}

export function rateLimitResponse(retryAfterSec: number) {
  return NextResponse.json(
    { error: 'trop_de_requetes' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
  )
}

// Enveloppe le couple rateLimit+rateLimitResponse utilisé à l'identique dans chaque route :
// renvoie la réponse 429 à retourner telle quelle, ou null si la requête peut continuer.
export function enforceRateLimit(key: string, limit: number, windowMs: number): NextResponse | null {
  const resultat = rateLimit(key, limit, windowMs)
  return resultat.allowed ? null : rateLimitResponse(resultat.retryAfterSec)
}
