import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { enforceRateLimit } from '@/lib/rate-limit'

const GRACE_PERIOD_DAYS = 30

const requestSchema = z.object({
  reason: z.string().max(500).optional(),
  confirm: z.literal('DELETE_MY_ACCOUNT'),
})

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const limite = enforceRateLimit(`account-delete:${user.id}`, 5, 60_000)
  if (limite) return limite

  const json = await req.json().catch(() => null)
  const parsed = requestSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirmation invalide. Tape 'DELETE_MY_ACCOUNT' pour confirmer." }, { status: 400 })
  }

  const scheduledFor = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 3600 * 1000)

  const { error } = await supabase.from('account_deletion_requests').upsert(
    {
      user_id: user.id,
      scheduled_for: scheduledFor.toISOString(),
      reason: parsed.data.reason ?? null,
      status: 'scheduled',
      cancelled_at: null,
      completed_at: null,
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    return NextResponse.json({ error: 'Demande impossible.', debug: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, scheduled_for: scheduledFor.toISOString(), grace_period_days: GRACE_PERIOD_DAYS })
}

export async function DELETE() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const limite = enforceRateLimit(`account-delete-cancel:${user.id}`, 5, 60_000)
  if (limite) return limite

  const { error } = await supabase
    .from('account_deletion_requests')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('status', 'scheduled')

  if (error) {
    return NextResponse.json({ error: 'Annulation impossible.', debug: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
