import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const service = createServiceClient()

    const [walletRes, txRes, withdrawRes] = await Promise.all([
      service.from('wallets').select('balance, pending_balance, total_earned, currency').eq('user_id', user.id).single(),
      service.from('wallet_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      service.from('withdrawals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    ])

    return NextResponse.json({
      wallet: {
        balance: walletRes.data?.balance ?? 0,
        pending_balance: walletRes.data?.pending_balance ?? 0,
        total_earned: walletRes.data?.total_earned ?? 0,
        currency: walletRes.data?.currency ?? 'EUR',
      },
      transactions: txRes.data ?? [],
      withdrawals: withdrawRes.data ?? [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
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
    const { amount, iban } = body

    if (!amount || typeof amount !== 'number' || amount < 5) {
      return NextResponse.json({ error: 'Montant minimum : 5 EUR' }, { status: 400 })
    }
    if (amount > 1000) {
      return NextResponse.json({ error: 'Montant maximum : 1000 EUR' }, { status: 400 })
    }
    if (!iban || typeof iban !== 'string' || iban.length < 15) {
      return NextResponse.json({ error: 'IBAN invalide' }, { status: 400 })
    }

    const service = createServiceClient()

    const { data: wallet } = await service
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single()

    if (!wallet || wallet.balance < amount) {
      return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 })
    }

    // Create withdrawal request
    await service.from('withdrawals').insert({
      user_id: user.id,
      amount,
      method: 'bank',
      details: { iban: iban.slice(0, 4) + '****' + iban.slice(-4) },
      status: 'pending',
    })

    // Record transaction
    await service.from('wallet_transactions').insert({
      user_id: user.id,
      type: 'debit',
      amount,
      source: 'withdrawal',
      description: `Retrait ${amount} EUR vers ${iban.slice(0, 4)}****`,
    })

    // Update wallet balance
    await service
      .from('wallets')
      .update({
        balance: wallet.balance - amount,
        pending_balance: (wallet.balance ?? 0) > 0 ? amount : 0,
      })
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
