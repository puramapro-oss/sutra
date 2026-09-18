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
// Cost estimation
// ---------------------------------------------------------------------------

export type VideoQuality = '720p' | '1080p' | '4k'

/**
 * Pre-flight estimate in USD. Rates are centralized so the UI and the budget
 * guard use the same calculation. Unknown qualities fall back to 1080p.
 */
export function estimateCost(
  engine: VideoEngine,
  durationSeconds: number,
  quality: VideoQuality = '1080p',
): number {
  const safeDuration = Math.max(0, durationSeconds)
  const ratesPerSecond: Record<VideoEngine, Record<VideoQuality, number>> = {
    'ltx-pro': { '720p': 0.05, '1080p': 0.05, '4k': 0.32 },
    'ltx-fast': { '720p': 0.02, '1080p': 0.02, '4k': 0.24 },
    'wan-classic': { '720p': 0.015, '1080p': 0.0225, '4k': 0.03 },
  }
  const rate = ratesPerSecond[engine][quality] ?? ratesPerSecond[engine]['1080p']
  return Number((rate * safeDuration).toFixed(4))
}
