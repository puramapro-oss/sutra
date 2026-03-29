import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { cloneVoice } from '@/lib/elevenlabs'
import { logApiCall, logActivity } from '@/lib/logger'
import { PLAN_LIMITS } from '@/lib/constants'
import type { Plan } from '@/types'

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const serviceClient = createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
    }

    const plan = profile.plan as Plan
    const limits = PLAN_LIMITS[plan]

    if (limits.voices <= 0) {
      return NextResponse.json(
        { error: 'Le clonage de voix est disponible a partir du plan Createur.' },
        { status: 403 }
      )
    }

    const { count: existingCount } = await serviceClient
      .from('cloned_voices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((existingCount ?? 0) >= limits.voices) {
      return NextResponse.json(
        { error: `Limite de ${limits.voices} voix clonees atteinte pour votre plan.` },
        { status: 403 }
      )
    }

    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null
    const name = formData.get('name') as string | null

    if (!audioFile) {
      return NextResponse.json({ error: 'Fichier audio requis' }, { status: 400 })
    }

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: 'Nom de la voix requis (min 2 caracteres)' }, { status: 400 })
    }

    const maxSize = 10 * 1024 * 1024
    if (audioFile.size > maxSize) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 10 MB)' }, { status: 400 })
    }

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())

    const start = Date.now()
    const voiceId = await cloneVoice({
      name: name.trim(),
      audioFile: audioBuffer,
      description: `Voix clonee par ${user.email} sur SUTRA`,
    })
    await logApiCall(user.id, 'elevenlabs', 'cloneVoice', 'success', Date.now() - start)

    const { data: clonedVoice } = await serviceClient
      .from('cloned_voices')
      .insert({
        user_id: user.id,
        name: name.trim(),
        elevenlabs_voice_id: voiceId,
      })
      .select('id, name, elevenlabs_voice_id, created_at')
      .single()

    await logActivity(user.id, 'voice_cloned', `Voix "${name.trim()}" clonee`)

    return NextResponse.json({
      voice_id: clonedVoice?.elevenlabs_voice_id ?? voiceId,
      name: name.trim(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur clonage voix', details: message }, { status: 500 })
  }
}
