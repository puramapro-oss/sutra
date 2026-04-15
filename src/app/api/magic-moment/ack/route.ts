import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient()
  await service
    .from('magic_moments')
    .update({ animation_shown: true })
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
