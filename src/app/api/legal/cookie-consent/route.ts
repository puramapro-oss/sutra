import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'

const bodySchema = z.object({
  mesure: z.boolean(),
  marketing: z.boolean(),
})

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: true, synced: false })

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const { error } = await supabase.from('cookie_consents').upsert(
    {
      user_id: user.id,
      necessaire: true,
      mesure: parsed.data.mesure,
      marketing: parsed.data.marketing,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    return NextResponse.json({ error: 'Enregistrement impossible.', debug: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, synced: true })
}
