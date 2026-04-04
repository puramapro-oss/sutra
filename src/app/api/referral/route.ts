import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

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

    const { count: filleulsCount } = await serviceClient
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', user.id)

    const { data: commissions } = await serviceClient
      .from('referral_commissions')
      .select('id, type, amount, status, created_at')
      .eq('beneficiary_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    const totalEarned = (commissions ?? [])
      .filter((c) => c.status === 'paid')
      .reduce((sum, c) => sum + c.amount, 0)

    const pendingAmount = (commissions ?? [])
      .filter((c) => c.status === 'pending')
      .reduce((sum, c) => sum + c.amount, 0)

    return NextResponse.json({
      referral_code: profile?.referral_code ?? null,
      filleuls_count: filleulsCount ?? 0,
      total_earned: totalEarned,
      pending_amount: pendingAmount,
      wallet_balance: profile?.wallet_balance ?? 0,
      commissions: commissions ?? [],
      share_url: profile?.referral_code
        ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://sutra.purama.dev'}/signup?ref=${profile.referral_code}`
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

    // Check if already referred
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

    // Find the referrer by their referral_code in profiles
    const { data: referrerProfile } = await serviceClient
      .from('profiles')
      .select('id, referral_code')
      .eq('referral_code', code.toUpperCase())
      .single()

    if (!referrerProfile) {
      return NextResponse.json({ error: 'Code de parrainage invalide' }, { status: 404 })
    }

    if (referrerProfile.id === user.id) {
      return NextResponse.json({ error: 'Tu ne peux pas utiliser ton propre code' }, { status: 400 })
    }

    // Create referral record
    const { error: insertError } = await serviceClient
      .from('referrals')
      .insert({
        referrer_id: referrerProfile.id,
        referred_id: user.id,
        referral_code: code.toUpperCase(),
        status: 'pending',
      })

    if (insertError) {
      return NextResponse.json({ error: 'Erreur application code parrainage' }, { status: 500 })
    }

    // Update referred_by on profile
    await serviceClient
      .from('profiles')
      .update({ referred_by: referrerProfile.id })
      .eq('id', user.id)

    // Add +1 contest entry for both parrain and filleul
    const { data: openContests } = await serviceClient
      .from('contests')
      .select('id')
      .eq('status', 'open')

    if (openContests) {
      const entries = openContests.flatMap((c) => [
        { user_id: referrerProfile.id, contest_id: c.id, source: 'referral_parrain' },
        { user_id: user.id, contest_id: c.id, source: 'referral_filleul' },
      ])
      if (entries.length > 0) {
        await serviceClient.from('contest_entries').insert(entries)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur application parrainage', details: message }, { status: 500 })
  }
}
