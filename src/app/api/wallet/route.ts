import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createServiceClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'balance') {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance, pending_balance, total_earned')
        .eq('user_id', user.id)
        .single()

      return NextResponse.json({
        balance: wallet?.balance ?? 0,
        pending_balance: wallet?.pending_balance ?? 0,
        total_earned: wallet?.total_earned ?? 0,
      })
    }

    if (action === 'transactions') {
      const { data: transactions } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      return NextResponse.json({ transactions: transactions ?? [] })
    }

    if (action === 'withdraw') {
      const { amount, iban } = body
      if (!amount || amount < 10 || amount > 1000) {
        return NextResponse.json({ error: 'Montant invalide (10-1000 EUR)' }, { status: 400 })
      }
      if (!iban) {
        return NextResponse.json({ error: 'IBAN requis' }, { status: 400 })
      }

      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single()

      if (!wallet || wallet.balance < amount) {
        return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 })
      }

      const { error: withdrawError } = await supabase.from('withdrawals').insert({
        user_id: user.id,
        amount,
        iban_masked: iban.slice(0, 4) + '****' + iban.slice(-4),
        status: 'pending',
      })

      if (withdrawError) {
        return NextResponse.json({ error: 'Erreur lors du retrait' }, { status: 500 })
      }

      await supabase
        .from('wallets')
        .update({
          balance: wallet.balance - amount,
          pending_balance: amount,
        })
        .eq('user_id', user.id)

      return NextResponse.json({ success: true, message: 'Retrait en cours de traitement' })
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
