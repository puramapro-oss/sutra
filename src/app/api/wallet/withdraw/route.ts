import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { debitPrincipal, normalizeSubWallets } from '@/lib/smart-split'

export const dynamic = 'force-dynamic'

interface BankDetails { iban?: string; bic?: string }
interface PaypalDetails { paypal_email?: string }

function maskIban(iban: string): string {
  if (iban.length < 8) return iban
  return iban.slice(0, 4) + '****' + iban.slice(-4)
}

function maskEmail(email: string): string {
  const [name, domain] = email.split('@')
  if (!name || !domain) return email
  const visible = name.slice(0, 2)
  return `${visible}***@${domain}`
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const amount = Number(body?.amount)
    const method = body?.method === 'paypal' ? 'paypal' : 'bank'
    const details = (body?.details ?? {}) as BankDetails & PaypalDetails

    if (!Number.isFinite(amount) || amount < 5) {
      return NextResponse.json({ error: 'Montant minimum : 5 EUR' }, { status: 400 })
    }
    if (amount > 1000) {
      return NextResponse.json({ error: 'Montant maximum : 1000 EUR' }, { status: 400 })
    }

    if (method === 'bank') {
      if (!details.iban || details.iban.trim().length < 15) {
        return NextResponse.json({ error: 'IBAN invalide' }, { status: 400 })
      }
      if (!details.bic || details.bic.trim().length < 6) {
        return NextResponse.json({ error: 'BIC invalide' }, { status: 400 })
      }
    } else {
      if (!details.paypal_email || !details.paypal_email.includes('@')) {
        return NextResponse.json({ error: 'Email PayPal invalide' }, { status: 400 })
      }
    }

    const service = createServiceClient()

    const { data: wallet } = await service
      .from('wallets')
      .select('balance, pending_balance, sub_wallets')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!wallet) {
      return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 })
    }

    // V6 Section 10 — Retrait UNIQUEMENT depuis le sous-wallet Principal
    const sw = normalizeSubWallets(wallet.sub_wallets)
    if (sw.principal < amount) {
      return NextResponse.json({
        error: `Solde Principal insuffisant. Disponible au retrait : ${sw.principal.toFixed(2)} €. Les sous-wallets Boost/Emergency/Dream/Pending/Solidaire ne sont pas retirables directement.`,
        principal_available: sw.principal,
      }, { status: 400 })
    }

    const safeDetails = method === 'bank'
      ? { iban: maskIban(details.iban!.trim()), bic: details.bic!.trim() }
      : { paypal_email: maskEmail(details.paypal_email!.trim()) }

    const { error: insertErr } = await service.from('withdrawals').insert({
      user_id: user.id,
      amount,
      method,
      details: safeDetails,
      status: 'pending',
    })
    if (insertErr) throw insertErr

    const result = await debitPrincipal({
      userId: user.id,
      amount,
      source: 'withdrawal',
      description: `Retrait ${amount.toFixed(2)} EUR (${method})`,
    })

    if (!result.ok) {
      return NextResponse.json({ error: 'Erreur débit Principal' }, { status: 500 })
    }

    await service
      .from('wallets')
      .update({
        pending_balance: Number(wallet.pending_balance ?? 0) + amount,
      })
      .eq('user_id', user.id)

    // V6 section 10 — Magic Moment au 1er retrait
    const { data: existingMagic } = await service
      .from('magic_moments')
      .select('first_withdrawal_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!existingMagic?.first_withdrawal_at) {
      await service.from('magic_moments').upsert(
        {
          user_id: user.id,
          first_withdrawal_at: new Date().toISOString(),
          first_withdrawal_amount: amount,
          animation_shown: false,
        },
        { onConflict: 'user_id' }
      )

      const { data: profile } = await service
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()

      await service.from('social_feed').insert({
        user_id: user.id,
        event_type: 'first_withdrawal',
        display_name: (profile?.name ?? 'Un membre').split(' ')[0],
      })
    }

    return NextResponse.json({ success: true, amount })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
