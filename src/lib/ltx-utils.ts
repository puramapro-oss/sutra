import type { Plan } from '@/types'
import { isSuperAdmin } from '@/lib/utils'
import type { VideoEngine, LtxModel } from './ltx-types'

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

const RESOLUTION_MAP: Record<string, Record<string, string>> = {
  '16:9': { '720p': '1280x720', '1080p': '1920x1080', '4k': '3840x2160' },
  '9:16': { '720p': '720x1280', '1080p': '1080x1920', '4k': '2160x3840' },
  '1:1':  { '720p': '720x720',  '1080p': '1080x1080', '4k': '2160x2160' },
}

export function getResolution(format: string, quality: string): string {
  return RESOLUTION_MAP[format]?.[quality] ?? RESOLUTION_MAP['16:9']['1080p']
}

/**
 * LTX 2.3 ne supporte QUE 16:9 et 9:16 (docs.ltx.io/models/ltx-2-3) — jamais
 * de carré natif. Le format 1:1 est généré dans la base la plus proche puis
 * recadré au montage (Shotstack `output.size` carré).
 */
export function ltxCompatibleFormat(format: string): '16:9' | '9:16' {
  return format === '9:16' ? '9:16' : '16:9'
}

/**
 * Durées admises par LTX 2.3 (docs.ltx.io/models/ltx-2-3) :
 *   - fast 720p/1080p @24-25fps : 6, 8, 10, 12, 14, 16, 18, 20 s
 *   - fast 1440p/4K et pro (toutes résolutions) : 6, 8, 10 s
 * Toute durée demandée est ramenée (par excès puis par défaut) à une valeur
 * admise — sinon le fournisseur rejette la requête et le repli WAN dégrade
 * la qualité achetée.
 */
const LTX_DURATIONS_EXTENDED = [6, 8, 10, 12, 14, 16, 18, 20]
const LTX_DURATIONS_SHORT = [6, 8, 10]

export function snapLtxDuration(model: LtxModel, quality: string, requestedSeconds: number): number {
  const allowed =
    model === 'ltx-2-3-fast' && (quality === '720p' || quality === '1080p')
      ? LTX_DURATIONS_EXTENDED
      : LTX_DURATIONS_SHORT
  const safe = Math.max(1, requestedSeconds)
  // Valeur admise immédiatement supérieure, sinon la plus grande disponible.
  return allowed.find((d) => d >= safe) ?? allowed[allowed.length - 1]
}

// ---------------------------------------------------------------------------
// Model routing by plan + role
// ---------------------------------------------------------------------------

export function selectEngine(
  plan: Plan,
  userEmail?: string | null
): { engine: VideoEngine; model: LtxModel | 'wan-2.2' } {
  // V7.1 — Plan-based routing explicite :
  //   super_admin + enterprise + admin → ltx-2-3-pro (qualité max)
  //   starter + creator + empire       → ltx-2-3-fast
  //   free                             → WAN 2.2 direct (pas de LTX payant)
  if (userEmail && isSuperAdmin(userEmail)) {
    return { engine: 'ltx-pro', model: 'ltx-2-3-pro' }
  }
  if (plan === 'enterprise' || plan === 'admin') {
    return { engine: 'ltx-pro', model: 'ltx-2-3-pro' }
  }
  if (plan === 'starter' || plan === 'creator' || plan === 'empire') {
    return { engine: 'ltx-fast', model: 'ltx-2-3-fast' }
  }
  // Plan 'free' (défaut) → WAN 2.2 direct (pas de fallback LTX).
  return { engine: 'wan-classic', model: 'wan-2.2' }
}

export function getMaxQuality(plan: Plan): string {
  const map: Record<Plan, string> = {
    free: '720p', starter: '720p', creator: '1080p',
    empire: '4k', enterprise: '4k', admin: '4k',
  }
  return map[plan] ?? '720p'
}

const QUALITY_RANK: Record<string, number> = { '720p': 0, '1080p': 1, '4k': 2 }

/**
 * Plafond de qualité PAR PLAN — getMaxQuality est un plafond, pas un défaut :
 * un plan starter qui demande 4k est ramené à 720p AVANT tout appel payant
 * (audit #16 : la limite doit être appliquée, pas seulement suggérée).
 */
export function clampQualityToPlan(requested: string, plan: Plan, userEmail?: string | null): string {
  if (userEmail && isSuperAdmin(userEmail)) return requested
  const max = getMaxQuality(plan)
  return (QUALITY_RANK[requested] ?? 1) > (QUALITY_RANK[max] ?? 1) ? max : requested
}

// ---------------------------------------------------------------------------
// Circuit breaker — track LTX health
// ---------------------------------------------------------------------------

let ltxFailures = 0
let ltxLastFailure = 0
const LTX_BREAKER_THRESHOLD = 3
const LTX_BREAKER_COOLDOWN = 60_000 // 1 min

export function isLtxHealthy(): boolean {
  if (ltxFailures < LTX_BREAKER_THRESHOLD) return true
  if (Date.now() - ltxLastFailure > LTX_BREAKER_COOLDOWN) {
    ltxFailures = 0 // Reset after cooldown
    return true
  }
  return false
}

export function recordLtxFailure(): void {
  ltxFailures++
  ltxLastFailure = Date.now()
}

export function recordLtxSuccess(): void {
  ltxFailures = 0
}

export function getLtxHealth(): { healthy: boolean; failures: number; lastFailure: number } {
  return { healthy: isLtxHealthy(), failures: ltxFailures, lastFailure: ltxLastFailure }
}

// ---------------------------------------------------------------------------
// Cost estimation — grille officielle LTX 2.3 (docs.ltx.io/pricing, USD/s)
// ---------------------------------------------------------------------------

export type VideoQuality = '720p' | '1080p' | '4k'

const RATES_PER_SECOND: Record<VideoEngine, Record<VideoQuality, number>> = {
  'ltx-pro': { '720p': 0.04, '1080p': 0.08, '4k': 0.32 },
  'ltx-fast': { '720p': 0.03, '1080p': 0.06, '4k': 0.24 },
  // WAN : estimation basse en « seconde de vidéo » ; RunPod facture en fait le
  // TEMPS WORKER GPU (démarrage + calcul + attente avant arrêt), une unité non
  // interchangeable — voir https://docs.runpod.io/serverless/pricing.
  // Ce taux sous-estime donc le coût réel WAN ; à rapprocher de la facture.
  'wan-classic': { '720p': 0.015, '1080p': 0.0225, '4k': 0.03 },
}

/**
 * Pre-flight estimate in USD. Rates centralized so the UI and the budget
 * guard use the same calculation. Unknown qualities fall back to 1080p.
 */
export function estimateCost(
  engine: VideoEngine,
  durationSeconds: number,
  quality: VideoQuality = '1080p',
): number {
  const safeDuration = Math.max(0, durationSeconds)
  const rate = RATES_PER_SECOND[engine][quality] ?? RATES_PER_SECOND[engine]['1080p']
  return Number((rate * safeDuration).toFixed(4))
}
