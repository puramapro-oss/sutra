import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { normalizeSubWallets } from '@/lib/smart-split'

const CreateSchema = z.object({
  title: z.string().min(3).max(80),
  target_amount: z.number().positive().max(1000000),
})

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient()
  const { data: goals } = await service
    .from('dream_goals')
    .select('*')
    .eq('user_id', user.id)
    .is('achieved_at', null)
    .order('created_at', { ascending: false })

  // current_amount = sub_wallet.dream live
  const { data: wallet } = await service
    .from('wallets')
    .select('sub_wallets')
    .eq('user_id', user.id)
    .maybeSingle()
  const sw = normalizeSubWallets(wallet?.sub_wallets)

  return NextResponse.json({ goals: goals ?? [], current_dream_balance: sw.dream })
}

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('dream_goals')
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      target_amount: parsed.data.target_amount,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
