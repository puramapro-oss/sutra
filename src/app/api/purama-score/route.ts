import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { computePuramaScore } from '@/lib/purama-score'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const breakdown = await computePuramaScore(user.id)
  return NextResponse.json(breakdown)
}
