import { NextResponse } from 'next/server'
import { smarana, OpenAIStoryboardError } from '@purama/smarana'
import { createServerClient } from '@/lib/supabase-server'
import { enforceRateLimit } from '@/lib/rate-limit'
import { boundedBytes } from '@/lib/salad/http'
import { SaladError } from '@/lib/salad/contracts'
import { generateStoryboard, storyboardProvider, StoryboardProviderError, storyboardRequest } from '@/lib/storyboard-provider'

export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })

    const provider = storyboardProvider(process.env.SUTRA_STORYBOARD_PROVIDER)
    if (provider === 'openai') {
      if (req.headers.get('sec-fetch-site') === 'cross-site') {
        return NextResponse.json({ error: 'Origine de la requête non autorisée.' }, { status: 403 })
      }
      if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        return NextResponse.json({ error: 'Un brief JSON est requis.' }, { status: 415 })
      }
    }

    let body: unknown
    try {
      const bytes = await boundedBytes(new Response(req.body, { headers: req.headers }), 32_768,
        AbortSignal.any([req.signal, AbortSignal.timeout(10_000)]))
      body = JSON.parse(bytes.toString('utf8'))
    } catch (cause) {
      const large = cause instanceof SaladError && cause.code === 'SALAD_BODY_LIMIT'
      return NextResponse.json({ error: large ? 'Le brief est trop volumineux.' : 'Brief JSON invalide.' }, { status: large ? 413 : 400 })
    }
    const parsed = storyboardRequest.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Vérifie le sujet (3 à 5 000 caractères), le format et la durée.' }, { status: 400 })

    if (provider === 'openai') {
      const limited = enforceRateLimit(`storyboard:${user.id}`, 6, 60_000)
      if (limited) return limited
    }
    const storyboard = await generateStoryboard(parsed.data, user.id, provider, req.signal, smarana.ask)
    return NextResponse.json(storyboard)
  } catch (cause) {
    if (cause instanceof StoryboardProviderError) return NextResponse.json({ error: cause.message }, { status: cause.status })
    if (cause instanceof OpenAIStoryboardError) {
      const responses = {
        CONFIG: [503, 'Le moteur de storyboard est indisponible.'],
        METER: [503, 'Le suivi de consommation du storyboard est indisponible.'],
        LIMIT: [429, 'Le plafond des storyboards OpenAI est atteint.'],
        TIMEOUT: [504, 'La génération du storyboard a été interrompue.'],
        UPSTREAM: [502, 'Le fournisseur du storyboard n’a pas renvoyé de réponse complète.'],
        INVALID: [400, 'La demande de storyboard est invalide.'],
      } as const
      const [status, message] = responses[cause.code]
      return NextResponse.json({ error: message }, { status })
    }
    return NextResponse.json({ error: 'La génération du storyboard a échoué.' }, { status: 500 })
  }
}
