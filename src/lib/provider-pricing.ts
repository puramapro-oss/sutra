// -----------------------------------------------------------------------------
// Matrice prix + capabilités des moteurs de rendu vidéo (mode hybride v11).
//
// HONNÊTETÉ AVANT TOUT :
//   - Les dimensions « natives » sont les VRAIES dimensions produites par le
//     moteur (ex. WAN « 4k » = 1280×720 natif → jamais étiqueté 4K natif).
//   - Chaque tarif porte sa source + sa date de vérification (researchedAt).
//   - WAN est facturé par RunPod en TEMPS GPU worker, pas en seconde vidéo :
//     le taux vidéo est une sous-estimation documentée (voir ltx-utils).
//   - Les moteurs NON configurés (pas de clé) sont listés pour la comparaison
//     UI uniquement — `configured: false` → jamais routables.
//
// Sélection : `cheapestCapableEngines` filtre les moteurs réellement capables
// du niveau demandé (natif), puis trie par coût. Le moins cher capable gagne.
// -----------------------------------------------------------------------------

import { isEnvSet } from './env'
import { getResolution } from '@/lib/ltx-utils'
import { getWanDimensions } from '@/lib/wan'
import type { MediaFormat } from '@/lib/pexels'
import type { VideoQuality } from '@/lib/ltx-utils'

export type DelayClass = 'fast' | 'medium' | 'slow'

export interface Dimensions {
  width: number
  height: number
}

export interface EnginePricing {
  id: string
  label: string
  /** true = clé API configurée dans .env.local → routable. */
  configured: boolean
  /** Tarifs USD par seconde de vidéo LIVRÉE. */
  ratesUsdPerSecond: Record<VideoQuality, number>
  delayClass: DelayClass
  /** VRAIES dimensions natives produites pour format×qualité demandés. */
  nativeDims: (format: MediaFormat, quality: VideoQuality) => Dimensions
  /** Durée facturable (LTX ne vend que des durées admises — arrondi par excès). */
  billedSeconds: (quality: VideoQuality, requestedSeconds: number) => number
  sourceUrl: string
  researchedAt: string
  notes: string
}

function parseDims(res: string): Dimensions {
  const [w, h] = res.split('x').map(Number)
  return { width: w, height: h }
}

/** Dimensions cibles du LIVRABLE (base de la vérité résolution). */
export function targetDims(format: MediaFormat, quality: VideoQuality): Dimensions {
  return parseDims(getResolution(format, quality))
}

const RESEARCHED_AT = '2026-09-20'

/** Moteurs ROUTABLES (clés configurées). Tarifs = docs officielles. */
export const ROUTABLE_ENGINES: EnginePricing[] = [
  {
    id: 'ltx-2-3-fast',
    label: 'LTX 2.3 Fast',
    get configured() { return isEnvSet('LTX_API_KEY') },
    ratesUsdPerSecond: { '720p': 0.03, '1080p': 0.06, '4k': 0.24 },
    delayClass: 'fast',
    nativeDims: (format, quality) => {
      // LTX ne supporte que 16:9 / 9:16 natifs ; le 1:1 est recadré au montage.
      const f: MediaFormat = format === '9:16' ? '9:16' : '16:9'
      return parseDims(getResolution(f, quality))
    },
    billedSeconds: (quality, s) => {
      const allowed = quality === '720p' || quality === '1080p' ? [6, 8, 10, 12, 14, 16, 18, 20] : [6, 8, 10]
      return allowed.find((d) => d >= Math.max(1, s)) ?? allowed[allowed.length - 1]
    },
    sourceUrl: 'https://docs.ltx.io/pricing + src/lib/ltx-utils.ts RATES_PER_SECOND',
    researchedAt: '2026-10-12',
    notes: 'Pas de 1:1 natif (recadrage montage). 4K natif réel (grille officielle).',
  },
  {
    id: 'ltx-2-3-pro',
    label: 'LTX 2.3 Pro',
    get configured() { return isEnvSet('LTX_API_KEY') },
    ratesUsdPerSecond: { '720p': 0.04, '1080p': 0.08, '4k': 0.32 },
    delayClass: 'medium',
    nativeDims: (format, quality) => {
      const f: MediaFormat = format === '9:16' ? '9:16' : '16:9'
      return parseDims(getResolution(f, quality))
    },
    billedSeconds: (quality, s) => {
      const allowed = [6, 8, 10]
      return allowed.find((d) => d >= Math.max(1, s)) ?? allowed[allowed.length - 1]
    },
    sourceUrl: 'https://docs.ltx.io/pricing + src/lib/ltx-utils.ts RATES_PER_SECOND',
    researchedAt: '2026-10-12',
    notes: 'Durées admises 6/8/10 s toutes qualités. 4K natif réel.',
  },
  {
    id: 'wan-2.2',
    label: 'WAN 2.2 (RunPod)',
    get configured() { return isEnvSet('RUNPOD_API_KEY') && isEnvSet('RUNPOD_ENDPOINT_ID') },
    ratesUsdPerSecond: { '720p': 0.015, '1080p': 0.0225, '4k': 0.03 },
    delayClass: 'slow',
    nativeDims: (format, quality) => getWanDimensions(quality, format),
    billedSeconds: (_q, s) => Math.max(1, Math.ceil(s)),
    sourceUrl: 'https://docs.runpod.io/serverless/pricing + src/lib/wan.ts DIMS',
    researchedAt: RESEARCHED_AT,
    notes: 'Natif max 1280×720 (« 4k » WAN) — JAMAIS natif 720p+/1080p/4K : toujours transform upscale. RunPod facture le temps GPU (sous-estimation vidéo assumée).',
  },
]

/**
 * Moteurs NON configurés — POUR COMPARAISON UI UNIQUEMENT (configured: false,
 * jamais routables tant que la clé n'existe pas). Prix marché relevés 2026-09.
 */
export interface MarketEngineInfo {
  id: string
  label: string
  usdPerSecondMin: number
  usdPerSecondMax: number
  sourceUrl: string
  researchedAt: string
}

export const MARKET_CONTEXT: MarketEngineInfo[] = [
  { id: 'veo-3.1-lite', label: 'Veo 3.1 Lite', usdPerSecondMin: 0.03, usdPerSecondMax: 0.05, sourceUrl: 'https://costgoat.com (Veo pricing, sept. 2026)', researchedAt: RESEARCHED_AT },
  { id: 'wan-2.5-fal', label: 'Wan 2.5 (fal.ai)', usdPerSecondMin: 0.05, usdPerSecondMax: 0.05, sourceUrl: 'https://fal.ai (pricing vidéo, sept. 2026)', researchedAt: RESEARCHED_AT },
  { id: 'gen-4-turbo', label: 'Runway Gen-4 Turbo', usdPerSecondMin: 0.05, usdPerSecondMax: 0.05, sourceUrl: 'https://docs.dev.runwayml.com (API pricing)', researchedAt: RESEARCHED_AT },
  { id: 'hailuo-02', label: 'MiniMax Hailuo 02', usdPerSecondMin: 0.05, usdPerSecondMax: 0.08, sourceUrl: 'https://platform.minimax.io + tryinfer.com (sept. 2026)', researchedAt: RESEARCHED_AT },
  { id: 'kling-2.5', label: 'Kling 2.5', usdPerSecondMin: 0.042, usdPerSecondMax: 0.14, sourceUrl: 'https://kling.ai (API pricing) + costgoat.com', researchedAt: RESEARCHED_AT },
  { id: 'seedance-2', label: 'Seedance 2 (1080p)', usdPerSecondMin: 0.34, usdPerSecondMax: 0.68, sourceUrl: 'fal.ai / replicate (sept. 2026)', researchedAt: RESEARCHED_AT },
]

// ---------------------------------------------------------------------------
// Conversion — POINT UNIQUE (toutes les sommes EUR de l'app dérivent d'ici).
// ---------------------------------------------------------------------------

/** Taux indicatif documenté — ne jamais multiplier ailleurs par un autre taux. */
export const EUR_PER_USD = 0.92
export const EUR_PER_USD_SOURCE = 'taux indicatif USD→EUR arrondi, relevé 2026-09-20 (à rafraîchir à chaque révision tarifaire)'

export function usdToEur(usd: number): number {
  return Number((usd * EUR_PER_USD).toFixed(2))
}

// ---------------------------------------------------------------------------
// Sélection du moteur le MOINS CHER réellement CAPABLE.
// ---------------------------------------------------------------------------

export interface EngineCandidate {
  engine: EnginePricing
  costUsd: number
  native: Dimensions
  /** true si le moteur atteint NATIVEMENT la cible, false = upscale assumé. */
  nativelyCapable: boolean
  billedSeconds: number
}

/**
 * Moteurs routables capables du niveau demandé, triés par coût croissant.
 * `allowUpscale` (ex. plan gratuit) admet les moteurs sous-dimensionnés avec
 * transform 'upscale' explicite — sinon ils sont exclus (qualité native
// exigée).
 */
export function cheapestCapableEngines(params: {
  format: MediaFormat
  quality: VideoQuality
  durationSeconds: number
  allowUpscale?: boolean
}): EngineCandidate[] {
  if (!Number.isFinite(params.durationSeconds) || params.durationSeconds <= 0) return []
  const target = targetDims(params.format, params.quality)
  const candidates: EngineCandidate[] = []
  for (const engine of ROUTABLE_ENGINES) {
    if (!engine.configured) continue
    const native = engine.nativeDims(params.format, params.quality)
    const nativelyCapable = native.width >= target.width && native.height >= target.height
    if (!nativelyCapable && !params.allowUpscale) continue
    const billed = engine.billedSeconds(params.quality, params.durationSeconds)
    if (!Number.isFinite(billed) || billed < params.durationSeconds) continue
    candidates.push({
      engine,
      costUsd: Number((engine.ratesUsdPerSecond[params.quality] * billed).toFixed(4)),
      native,
      nativelyCapable,
      billedSeconds: billed,
    })
  }
  return candidates.sort((a, b) => a.costUsd - b.costUsd || Number(b.nativelyCapable) - Number(a.nativelyCapable))
}
