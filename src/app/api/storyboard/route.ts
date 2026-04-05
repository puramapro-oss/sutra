import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { askClaude } from '@/lib/claude'

export const maxDuration = 120

interface StoryboardScene {
  visual_prompt: string
  description: string
  duration_seconds: number
  transition: 'fade' | 'cut' | 'slide' | 'zoom'
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const { idea, format, durationTarget } = body as {
      idea?: string
      format?: string
      durationTarget?: 'short' | 'medium' | 'long'
    }

    if (!idea || typeof idea !== 'string' || idea.trim().length < 3) {
      return NextResponse.json({ error: 'Idee requise (min 3 caracteres)' }, { status: 400 })
    }

    if (!format || !['16:9', '9:16', '1:1'].includes(format)) {
      return NextResponse.json({ error: 'Format invalide' }, { status: 400 })
    }

    if (!durationTarget || !['short', 'medium', 'long'].includes(durationTarget)) {
      return NextResponse.json({ error: 'Duree cible invalide' }, { status: 400 })
    }

    const sceneRanges: Record<string, string> = {
      short: '4 a 6',
      medium: '8 a 10',
      long: '10 a 14',
    }

    const durationLabels: Record<string, string> = {
      short: '30 secondes',
      medium: '2 minutes',
      long: '5 minutes ou plus',
    }

    const sceneRange = sceneRanges[durationTarget]
    const durationLabel = durationLabels[durationTarget]

    const system = `Tu es un realisateur professionnel de cinema et de contenu video. Tu crees des storyboards visuels detailles et cinematiques.

REGLES :
1. Genere exactement ${sceneRange} scenes pour cette idee de video
2. La duree totale visee est ${durationLabel}
3. Chaque scene a une description visuelle detaillee EN ANGLAIS (visual_prompt) pour la generation d'image IA
4. Chaque scene a une description EN FRANCAIS de ce qui se passe (description)
5. Les transitions varient entre fade, cut, slide et zoom selon le rythme
6. Le format video est ${format}
7. Les visual_prompts doivent etre cinematiques, detailles (lumiere, cadrage, couleurs, ambiance)

Reponds UNIQUEMENT en JSON strict, aucun texte autour :
{"scenes": [{"visual_prompt": "...", "description": "...", "duration_seconds": 5, "transition": "fade"}]}`

    const response = await askClaude(
      `Cree un storyboard detaille pour cette idee de video : "${idea.trim()}"`,
      system
    )

    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned) as { scenes: StoryboardScene[] }

    if (!parsed.scenes || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      return NextResponse.json({ error: 'Generation echouee, reessayez' }, { status: 500 })
    }

    const scenes = parsed.scenes.map((s) => ({
      visual_prompt: s.visual_prompt ?? '',
      description: s.description ?? '',
      duration_seconds: typeof s.duration_seconds === 'number' ? s.duration_seconds : 5,
      transition: ['fade', 'cut', 'slide', 'zoom'].includes(s.transition) ? s.transition : 'cut',
    }))

    return NextResponse.json({ scenes })
  } catch (error) {
    console.error('[storyboard]', error)
    return NextResponse.json(
      { error: 'Erreur lors de la generation du storyboard' },
      { status: 500 }
    )
  }
}
