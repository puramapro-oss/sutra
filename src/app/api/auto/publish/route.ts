import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { publishAutoVideoRecord } from '@/lib/sutra-auto'

export const maxDuration = 120
const requestSchema = z.object({ video_id: z.string().uuid() })

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    const parsed = requestSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'video_id invalide' }, { status: 400 })
    return NextResponse.json(await publishAutoVideoRecord(user.id, parsed.data.video_id, true))
  } catch (err) {
    return NextResponse.json({ error: 'Publication non confirmee', details: err instanceof Error ? err.message : 'Erreur interne' }, { status: 409 })
  }
}
