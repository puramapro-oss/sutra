import { smarana } from '@purama/smarana'
import { z } from 'zod'
import type { ScriptData } from '@/types'

export type ClaudeTier = 'fast' | 'main' | 'pro'

const MODEL_MAIN = process.env.ANTHROPIC_MODEL_MAIN ?? 'claude-sonnet-4-6'
const MODEL_FAST = process.env.ANTHROPIC_MODEL_FAST ?? 'claude-haiku-4-5-20251001'
const MODEL_PRO = process.env.ANTHROPIC_MODEL_PRO ?? 'claude-opus-4-6'
export { MODEL_MAIN, MODEL_FAST, MODEL_PRO }

const scriptDataSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(20).max(3000),
  tags: z.array(z.string().trim().min(1).max(60)).min(3).max(20),
  narration: z.string().trim().min(20).max(60000),
  scenes: z.array(z.object({
    visual_prompt: z.string().trim().min(20).max(2000),
    duration_seconds: z.number().min(2).max(20),
    use_stock: z.boolean(),
  })).min(1).max(60),
  music_prompt: z.string().trim().min(10).max(1000),
  music_style: z.enum([
    'cinematic', 'lo-fi', 'epic', 'chill',
    'motivational', 'dramatic', 'upbeat', 'ambient',
  ]),
  thumbnail_prompt: z.string().trim().min(20).max(2000),
  // Long-form borné (audit #6) : jusqu'à 20 minutes (1200s) pour les formats
  // documentaire — la borne protège le budget, elle ne disparaît pas.
  estimated_duration: z.number().min(2).max(1200),
})

function parseScriptData(raw: string): ScriptData {
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
  let value: unknown
  try {
    value = JSON.parse(cleaned)
  } catch {
    throw new Error('SUTRA_SCRIPT_INVALID_JSON')
  }
  const parsed = scriptDataSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`SUTRA_SCRIPT_INVALID_SCHEMA: ${parsed.error.issues[0]?.message ?? 'unknown'}`)
  }
  return parsed.data
}

export async function generateScript(
  params: {
    topic: string
    niche: string
    style: string
    format: string
    duration: string
  },
  userId?: string
): Promise<ScriptData> {
  const isLongForm = /min|minute/i.test(params.duration) && parseInt(params.duration, 10) >= 8
  const systemPrompt = `Tu es le createur de contenu video IA le plus talentueux au monde. Tu crees des scripts captivants, optimises pour l'engagement.

${isLongForm ? `FORMAT LONG : structure la video en chapitres logiques (4 a 8 scenes par chapitre), chaque scene reste courte et precisement cadree.` : ''}

REGLES ABSOLUES :
1. Le hook des 3 premieres secondes est clair, credible et immediat.
2. Chaque scene remplit une fonction precise et dure 2 a 10 secondes${isLongForm ? ' (jusqu\'a 20 secondes pour les plans d\'ambiance longs)' : ''}.
3. Le rythme reste soutenu sans surcharger le spectateur.
4. Termine par un CTA adapte au sujet, jamais trompeur.
5. Ecris en francais naturel, conversationnel et factuel.
6. N'invente jamais de fonctionnalite, chiffre, temoignage, marque ou preuve.
7. Adapte le cadrage au format \${params.format}; garde le sujet et les zones de texte dans la zone sure.
8. Decris chaque plan en anglais : sujet, action, decor, cadrage, lumiere, camera et progression temporelle.
9. N'integre aucun texte, logo ou interface genere dans l'image : ils seront ajoutes exactement en postproduction.
10. Utilise use_stock=true seulement lorsqu'un plan generique reel est preferable et recherchable.

FORMAT DE REPONSE (JSON strict, aucun texte autour) :
{
  "title": "Titre accrocheur pour la video",
  "description": "Description SEO de 200 mots avec mots-cles naturels",
  "tags": ["tag1", "tag2", "tag3"],
  "narration": "Le texte complet de la voix-off, ecrit naturellement, avec des pauses marquees par des ...",
  "scenes": [
    {
      "visual_prompt": "Detailed English description for visual generation. Cinematic, 4K quality.",
      "duration_seconds": 5,
      "use_stock": false
    }
  ],
  "music_prompt": "English description of ideal background music",
  "music_style": "cinematic",
  "thumbnail_prompt": "Detailed English description for thumbnail generation",
  "estimated_duration": 75
}

IMPORTANT :
- "visual_prompt" est TOUJOURS en anglais
- "narration" est TOUJOURS en francais
- "use_stock" = true seulement pour les plans generiques
- Vise ${params.duration} (maximum absolu : 1200 secondes)
${isLongForm ? '- Jusqu\'a 60 scenes pour les formats longs, jamais plus\n' : ''}- Format video : ${params.format}
- Niche : ${params.niche}
- Style : ${params.style}`

  const result = await smarana.ask({
    appSlug: 'sutra',
    userId,
    system: systemPrompt,
    message: `Cree une video sur : "${params.topic}"`,
    tier: 'main',
    // Long-form : 60 scènes × prompts détaillés ne tiennent pas en 4k tokens.
    maxTokens: isLongForm ? 16000 : 4000,
  })

  return parseScriptData(result.text)
}

export const SUTRA_SYSTEM_PROMPT = 'Tu es un assistant IA pour SUTRA, une plateforme de generation video IA. Reponds en francais.'

export async function askClaude(
  prompt: string,
  { system = SUTRA_SYSTEM_PROMPT, tier = 'main', maxTokens = 2048, userId }: { system?: string; tier?: ClaudeTier; maxTokens?: number; userId?: string } = {}
): Promise<string> {
  const result = await smarana.ask({
    appSlug: 'sutra',
    userId,
    system,
    message: prompt,
    tier,
    maxTokens,
  })

  return result.text
}

export async function judgeContestEntry(
  title: string,
  description: string,
  videoUrl: string,
  userId?: string
): Promise<{ score: number; feedback: string; scores_detail: Record<string, number> }> {
  const response = await askClaude(
    `Evalue cette soumission de concours video :
Titre: ${title}
Description: ${description}
URL: ${videoUrl}

Note sur 100 selon 5 criteres (20pts chacun) :
1. Creativite et originalite
2. Qualite technique (image, son, montage)
3. Impact emotionnel / engagement
4. Pertinence du sujet
5. Execution globale

Reponds en JSON strict :
{"score": 85, "feedback": "...", "scores_detail": {"creativite": 18, "technique": 17, "impact": 16, "pertinence": 17, "execution": 17}}`,
    { userId }
  )

  return JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim())
}
