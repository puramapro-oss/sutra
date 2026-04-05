import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const payoutSchema = z.object({
  amount: z.number().min(50, 'Montant minimum : 50 EUR').max(100000),
  iban: z.string().min(15, 'IBAN invalide').max(34),
})

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = payoutSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { amount, iban } = parsed.data
    const service = createServiceClient()

    // Verify partner
    const { data: partner } = await service
      .from('partners')
      .select('id, current_balance, created_at')
      .eq('user_id', user.id)
      .single()

    if (!partner) {
      return NextResponse.json({ error: 'Tu n\'es pas partenaire' }, { status: 403 })
    }

    // 14 day delay check: no payout within 14 days of registration
    const registrationDate = new Date(partner.created_at)
    const fourteenDaysAfter = new Date(registrationDate.getTime() + 14 * 24 * 60 * 60 * 1000)

    if (new Date() < fourteenDaysAfter) {
      const remainingDays = Math.ceil(
        (fourteenDaysAfter.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      )
      return NextResponse.json(
        { error: `Retrait disponible dans ${remainingDays} jour${remainingDays > 1 ? 's' : ''}. Delai de 14 jours apres inscription.` },
        { status: 400 }
      )
    }

    // Check balance
    if ((partner.current_balance ?? 0) < amount) {
      return NextResponse.json(
        { error: `Solde insuffisant. Solde actuel : ${partner.current_balance ?? 0} EUR` },
        { status: 400 }
      )
    }

    // Check no pending payout
    const { data: pendingPayout } = await service
      .from('partner_payouts')
      .select('id')
      .eq('partner_id', partner.id)
      .eq('status', 'pending')
      .single()

    if (pendingPayout) {
      return NextResponse.json(
        { error: 'Un retrait est deja en cours de traitement' },
        { status: 400 }
      )
    }

    // Create payout request
    const { data: payout, error: payoutError } = await service
      .from('partner_payouts')
      .insert({
        partner_id: partner.id,
        amount,
        currency: 'eur',
        iban,
        reference: `SUTRA-${Date.now()}`,
        status: 'pending',
        requested_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (payoutError) {
      return NextResponse.json(
        { error: 'Erreur creation retrait', details: payoutError.message },
        { status: 500 }
      )
    }

    // Deduct from partner balance
    const { error: updateError } = await service
      .from('partners')
      .update({ current_balance: (partner.current_balance ?? 0) - amount })
      .eq('id', partner.id)

    if (updateError) {
      // Rollback payout if balance update fails
      await service
        .from('partner_payouts')
        .update({ status: 'failed' })
        .eq('id', payout.id)

      return NextResponse.json(
        { error: 'Erreur mise a jour solde', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        amount,
        status: 'pending',
        created_at: payout.created_at,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur retrait partenaire', details: message }, { status: 500 })
  }
}
