import type { AskOptions, AskResult } from '@purama/smarana'
import { z } from 'zod'
import { storyboardSceneContentSchema } from './cinema-project'
import { MAX_STORYBOARD_IDEA_LENGTH, parseStoryboardJson } from './storyboard'

export const storyboardRequest = z.object({
  idea: z.string().trim().min(3).max(MAX_STORYBOARD_IDEA_LENGTH),
  format: z.enum(['16:9', '9:16', '1:1']),
  durationTarget: z.enum(['short', 'medium', 'long']),
})

type StoryboardRequest = z.infer<typeof storyboardRequest>
type Ask = (options: AskOptions) => Promise<Pick<AskResult, 'text'>>

const targets = {
  short: '4 à 6 plans en 30 secondes',
  medium: '8 à 10 plans en 2 minutes',
  long: '10 à 14 plans en 5 minutes ou plus',
}

const answerSchema = z.object({ scenes: z.array(storyboardSceneContentSchema.refine(scene => scene.duration_seconds >= 1 / 24)).min(1).max(14) })

export class StoryboardProviderError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

export function storyboardProvider(value: string | undefined): 'smarana' | 'openai' {
  if (!value || value === 'smarana') return 'smarana'
  if (value === 'openai') return value
  throw new StoryboardProviderError(503, 'Le moteur de storyboard est indisponible.')
}

export async function generateStoryboard(
  data: StoryboardRequest, userId: string, provider: 'smarana' | 'openai', signal: AbortSignal, ask: Ask,
) {
  const system = `Tu réalises des storyboards de publicité, de démonstration ou de cinéma.
Pour ce projet, vise ${targets[data.durationTarget]} au format ${data.format}.
Pour chaque plan, décris le visuel en anglais (sujet, cadrage et lumière), l’action en français,
sa durée en secondes positives et la transition (fade, cut, slide ou zoom).
Pour une publicité, utilise les caractéristiques fournies et termine par un appel à l’action adapté.
Réponds uniquement par un objet JSON de la forme
{"scenes":[{"visual_prompt":"...","description":"...","duration_seconds":5,"transition":"cut"}]}.`
  const options: AskOptions = { appSlug: 'sutra', userId, tier: 'main', maxTokens: 2048,
    system, message: `Prépare le storyboard de cette idée : ${data.idea}`, signal }
  if (provider === 'openai') {
    options.openAIStoryboard = { signal }
    options.maxTokens = 4096
  }
  const { text } = await ask(options)
  if (typeof text !== 'string' || text.length > 65536) {
    throw new StoryboardProviderError(502, 'Le moteur a renvoyé un storyboard illisible.')
  }
  try {
    return answerSchema.parse(parseStoryboardJson(text))
  } catch {
    throw new StoryboardProviderError(502, 'Le storyboard reçu est incomplet ou invalide.')
  }
}
