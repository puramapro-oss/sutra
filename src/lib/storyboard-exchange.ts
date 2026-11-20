import { z } from 'zod'
import { createCinemaProject, storyboardSceneContentSchema } from './cinema-project'
import { MAX_SCENES } from './production-schema'
import { DURATION_OPTIONS, makeId, parseStoryboardJson } from './storyboard'
import type { Scene, VideoFormat } from './storyboard'
import { MAX_STORYBOARD_DRAFT_BYTES, type StoryboardDraftSource } from './storyboard-create-draft'

type BriefDestination = 'chatgpt' | 'motionlab'

const sceneList = z.object({
  scenes: z.array(storyboardSceneContentSchema).min(1).max(MAX_SCENES),
}).strict()

function checkSize(text: string) {
  if (text.length > MAX_STORYBOARD_DRAFT_BYTES || new TextEncoder().encode(text).byteLength > MAX_STORYBOARD_DRAFT_BYTES) {
    throw new Error('Le storyboard dépasse 512 Kio. Raccourcis les descriptions des plans.')
  }
}

export function createStoryboardBrief(destination: BriefDestination, source: StoryboardDraftSource): string {
  const title = source.idea.trim() || 'Vidéo SUTRA'
  if (!source.idea.trim() && !source.scenes.length) throw new Error('Saisis le sujet de ta vidéo ou ajoute un plan.')
  const project = source.scenes.length
    ? createCinemaProject({ title: 'Storyboard', format: source.format, scenes: source.scenes })
    : null
  const duration = project
    ? `${project.timeline.durationSeconds} s au total`
    : DURATION_OPTIONS.find(option => option.id === source.durationTarget)!.desc
  const brief = {
    sujet: title, format: source.format, duree: duration,
    plans: project?.scenes.map(({ visual_prompt, description, duration_seconds, transition }) =>
      ({ visual_prompt, description, duration_seconds, transition })) ?? [],
  }
  const context = JSON.stringify(brief, null, 2)
  const campaign = /\bPURAMA\b/i.test(title) ? [
    'Pour une publicité PURAMA centrée sur une fonction, montre le geste réel puis son résultat. Pour un film d’ensemble, relie les usages par une histoire et termine par une seule invitation. Identifie les projets encore en préparation.',
  ] : []
  const text = destination === 'chatgpt' ? [
    'Prépare un storyboard éditable pour SUTRA à partir du brief ci-dessous. Adapte le récit à son usage (publicité, démonstration ou tutoriel).',
    'Pour une publicité, ouvre sur une accroche, montre le produit en situation et termine par une action concrète. Utilise les seules caractéristiques fournies.',
    'Respecte le format, la durée et les plans fournis. Pour chaque plan, écris le texte en français et la direction visuelle en anglais.',
    'Renvoie uniquement un objet JSON avec le champ scenes. Chaque plan suit cet exemple de structure.',
    '{"scenes":[{"description":"Texte du plan","visual_prompt":"Visual direction","duration_seconds":5,"transition":"cut"}]}',
    `Choisis une transition parmi cut, fade, slide et zoom. Chaque plan dure entre une image et 120 secondes, à 24 images par seconde. Maximum ${MAX_SCENES} plans.`,
    ...campaign,
    context,
  ].join('\n\n') : [
    '/full-visual Prépare la vidéo décrite dans le brief SUTRA ci-dessous.',
    'Utilise le dossier MotionLab installé dans ton espace de travail. Garde les éléments factuels, le texte et l’ordre des plans fournis.',
    'Pour une publicité, propose des variantes d’accroche à partir du même message. Accorde la voix, les sous-titres et les animations. Pour une démonstration, utilise les médias fournis par le créateur.',
    'Indique le coût d’une voix ou d’un service externe avant de l’utiliser. Livre le MP4 local et indique le format et la durée effectivement exportés.',
    ...(source.format === '9:16' ? [] : [`La cible SUTRA est ${source.format}. Si ton modèle MotionLab livre uniquement du 9:16, signale le recadrage à préparer au montage.`]),
    ...campaign,
    context,
  ].join('\n\n')
  checkSize(text)
  return text
}

export function importStoryboardText(raw: string, format: VideoFormat): Scene[] {
  checkSize(raw)
  let data: unknown
  try { data = parseStoryboardJson(raw) }
  catch { throw new Error('Colle la réponse JSON complète contenant la liste scenes.') }
  const parsed = sceneList.safeParse(data)
  if (!parsed.success) {
    throw new Error('Vérifie le texte, la direction visuelle, la durée et la transition de chaque plan dans le JSON.')
  }
  const importId = globalThis.crypto?.randomUUID?.() ?? makeId()
  const scenes = parsed.data.scenes.map((scene, index) => ({ ...scene, id: `${importId}-${index + 1}` }))
  createCinemaProject({ title: 'Storyboard importé', format, scenes })
  return scenes
}
