import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { CURRENT_LEGAL_VERSIONS } from '@/lib/legal/versions'

const bodySchema = z.object({
  docType: z.enum(['mentions', 'cgu', 'cgv', 'confidentialite']),
})

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const { error } = await supabase.from('legal_acceptances').upsert(
    {
      user_id: user.id,
      doc_type: parsed.data.docType,
      version: CURRENT_LEGAL_VERSIONS[parsed.data.docType],
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      user_agent: req.headers.get('user-agent'),
    },
    { onConflict: 'user_id,doc_type' }
  )

  if (error) {
    return NextResponse.json({ error: 'Enregistrement impossible.', debug: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
