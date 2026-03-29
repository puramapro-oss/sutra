import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { askClaude } from '@/lib/claude'
import { logApiCall } from '@/lib/logger'

const chatbotSchema = z.object({
  message: z.string().min(1, 'Message requis').max(2000),
})

const SUPPORT_SYSTEM_PROMPT = `Tu es l'assistant IA de support de SUTRA, la plateforme de generation video IA par Purama.

REGLES :
- Reponds toujours en francais, avec un ton amical et professionnel
- Tutoie l'utilisateur
- Sois concis mais complet
- Si tu ne connais pas la reponse, suggere de contacter le support humain

TU CONNAIS :
- SUTRA permet de generer des videos completes (script, voix, visuels, musique, montage) a partir d'un simple sujet
- Plans : Free (2 videos/mois), Starter (10 videos, 9 EUR/mois), Createur (50 videos, voix clonees, 29 EUR/mois), Empire (illimite, 4K, 99 EUR/mois)
- Fonctionnalites : generation IA, clonage de voix, musique IA, Sutra Studio (editeur), Autopilot (series automatiques), publication multi-plateforme
- Parrainage : -50% pour le filleul, 50% du premier paiement + 10% recurrent pour le parrain
- Support technique : problemes de generation, qualite video, voix, publication
- Facturation : gestion via le portail Stripe dans les parametres`

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = chatbotSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const start = Date.now()
    const response = await askClaude(parsed.data.message, SUPPORT_SYSTEM_PROMPT)
    await logApiCall(user.id, 'claude', 'chatbot', 'success', Date.now() - start)

    return NextResponse.json({ response })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur chatbot', details: message }, { status: 500 })
  }
}
