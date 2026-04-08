import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

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
      .select('balance, pending_balance')
      .eq('user_id', user.id)
      .maybeSingle()

    const balance = Number(wallet?.balance ?? 0)
    if (!wallet || balance < amount) {
      return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 })
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

    await service.from('wallet_transactions').insert({
      user_id: user.id,
      type: 'debit',
      amount,
      source: 'withdrawal',
      description: `Retrait ${amount.toFixed(2)} EUR (${method})`,
    })

    await service
      .from('wallets')
      .update({
        balance: balance - amount,
        pending_balance: Number(wallet.pending_balance ?? 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    return NextResponse.json({ success: true, amount })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
