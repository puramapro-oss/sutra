import { z } from 'zod'
import type { ScriptData } from '@/types'

// -----------------------------------------------------------------------------
// Schéma + constantes du parcours production — extraits de la route pour
// rester sous la limite de 300 lignes et partager la validation.
// -----------------------------------------------------------------------------

// Validation stricte des entrées — formats limités aux 3 ratios réellement
// supportés par la chaîne, étapes connues uniquement. `requestId` rend la
// requête IDEMPOTENTE : un retry client reprend la MÊME tâche durable
// (résultat checkpointé renvoyé tel quel) au lieu de payer deux fois.
export const productionSchema = z.object({
  step: z.enum(['script', 'video', 'voice', 'music', 'assembly', 'thumbnail', 'all', 'cancel']),
  idea: z.string().min(1, 'idee requise').max(500),
  template: z.string().optional(),
  format: z.enum(['16:9', '9:16', '1:1']).optional(),
  engine: z.enum(['ltx-pro', 'ltx-fast', 'wan-classic']).optional(),
  voice: z.string().max(120).optional(),
  musicStyle: z.string().max(120).optional(),
  tone: z.string().max(120).optional(),
  previousData: z.unknown().optional(),
  requestId: z.string().uuid('requestId doit etre un UUID').optional(),
  /** Annulation : étape ciblée (le client sait laquelle est en vol). */
  targetStep: z.enum(['script', 'video', 'voice', 'music', 'assembly', 'all']).optional(),
})

// Bornes anti-dépense sur les données renvoyées par le client (audit #8) :
// un previousData non borné ne doit jamais déclencher un Promise.all massif.
export const MAX_SCENES = 60
const MAX_NARRATION_CHARS = 60_000

export const TEMPLATE_CONFIGS: Record<string, { durationHint: string; sceneCount: number }> = {
  youtube: { durationHint: '8-12 minutes', sceneCount: 12 },
  tiktok: { durationHint: '30-60 secondes', sceneCount: 4 },
  reel: { durationHint: '15-30 secondes', sceneCount: 3 },
  docu: { durationHint: '10-20 minutes', sceneCount: 15 },
  tuto: { durationHint: '3-8 minutes', sceneCount: 8 },
}

export function sanitizeScriptData(raw: unknown): ScriptData | undefined {
  const s = raw as ScriptData | undefined
  if (!s || !Array.isArray(s.scenes)) return undefined
  return {
    ...s,
    narration: (s.narration ?? '').slice(0, MAX_NARRATION_CHARS),
    scenes: s.scenes.slice(0, MAX_SCENES),
  }
}
