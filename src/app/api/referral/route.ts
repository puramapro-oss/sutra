import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { logActivity } from '@/lib/logger'

const applyReferralSchema = z.object({
  code: z.string().min(3, 'Code requis').max(20),
})

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const serviceClient = createServiceClient()

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('referral_code, wallet_balance')
      .eq('id', user.id)
      .single()

    const { data: referralCodeRow } = await serviceClient
      .from('referral_codes')
      .select('id, code, total_uses, is_active')
      .eq('user_id', user.id)
      .single()

    const { count: filleulsCount } = await serviceClient
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', user.id)
      .eq('status', 'active')

    const { data: commissions } = await serviceClient
      .from('commissions')
      .select('id, type, amount, status, created_at')
      .eq('beneficiary_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    const totalEarned = (commissions ?? [])
      .filter((c) => c.status === 'paid' || c.status === 'approved')
      .reduce((sum, c) => sum + c.amount, 0)

    const pendingAmount = (commissions ?? [])
      .filter((c) => c.status === 'pending')
      .reduce((sum, c) => sum + c.amount, 0)

    return NextResponse.json({
      referral_code: referralCodeRow?.code ?? profile?.referral_code ?? null,
      filleuls_count: filleulsCount ?? 0,
      total_earned: totalEarned,
      pending_amount: pendingAmount,
      wallet_balance: profile?.wallet_balance ?? 0,
      commissions: commissions ?? [],
      share_url: referralCodeRow?.code
        ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://sutra.purama.dev'}/pricing?ref=${referralCodeRow.code}`
        : null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur recuperation parrainage', details: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = applyReferralSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { code } = parsed.data
    const serviceClient = createServiceClient()

    const { data: existingReferral } = await serviceClient
      .from('referrals')
      .select('id')
      .eq('referred_id', user.id)
      .single()

    if (existingReferral) {
      return NextResponse.json(
        { error: 'Tu as deja utilise un code de parrainage' },
        { status: 400 }
      )
    }

    const { data: referralCode } = await serviceClient
      .from('referral_codes')
      .select('id, user_id, code, is_active')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single()

    if (!referralCode) {
      return NextResponse.json({ error: 'Code de parrainage invalide ou inactif' }, { status: 404 })
    }

    if (referralCode.user_id === user.id) {
      return NextResponse.json({ error: 'Tu ne peux pas utiliser ton propre code' }, { status: 400 })
    }

    const { error: insertError } = await serviceClient
      .from('referrals')
      .insert({
        referrer_id: referralCode.user_id,
        referred_id: user.id,
        referral_code_id: referralCode.id,
        status: 'pending',
        first_payment_processed: false,
      })

    if (insertError) {
      return NextResponse.json({ error: 'Erreur application code parrainage' }, { status: 500 })
    }

    await serviceClient
      .from('profiles')
      .update({ referred_by: referralCode.user_id })
      .eq('id', user.id)

    await serviceClient
      .from('referral_codes')
      .update({ total_uses: (referralCode as Record<string, number>).total_uses + 1 })
      .eq('id', referralCode.id)

    await logActivity(user.id, 'referral_applied', `Code parrainage ${code} applique`, {
      referrer_id: referralCode.user_id,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur application parrainage', details: message }, { status: 500 })
  }
}
