import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { normalizeSubWallets } from '@/lib/smart-split'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const service = createServiceClient()

    const [walletRes, txRes, withdrawRes, boostRes] = await Promise.all([
      service.from('wallets').select('balance, pending_balance, total_earned, currency, sub_wallets').eq('user_id', user.id).single(),
      service.from('wallet_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      service.from('withdrawals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      service.from('boost_tranches').select('amount').eq('user_id', user.id).eq('status', 'locked'),
    ])

    const sub_wallets = normalizeSubWallets(walletRes.data?.sub_wallets)
    const boost_locked = (boostRes.data ?? []).reduce((s, t) => s + Number(t.amount ?? 0), 0)

    return NextResponse.json({
      wallet: {
        balance: walletRes.data?.balance ?? 0,
        pending_balance: walletRes.data?.pending_balance ?? 0,
        total_earned: walletRes.data?.total_earned ?? 0,
        currency: walletRes.data?.currency ?? 'EUR',
      },
      sub_wallets,
      boost_locked,
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
      .select('balance, pending_balance, sub_wallets')
      .eq('user_id', user.id)
      .single()

    const sw = normalizeSubWallets(wallet?.sub_wallets)
    if (!wallet || sw.principal < amount) {
      return NextResponse.json({
        error: `Solde Principal insuffisant. Disponible : ${sw.principal.toFixed(2)} €.`,
        principal_available: sw.principal,
      }, { status: 400 })
    }

    // Create withdrawal request
    await service.from('withdrawals').insert({
      user_id: user.id,
      amount,
      method: 'bank',
      details: { iban: iban.slice(0, 4) + '****' + iban.slice(-4) },
      status: 'pending',
    })

    // V6 Smart Split — débit UNIQUEMENT du Principal
    const { debitPrincipal } = await import('@/lib/smart-split')
    const result = await debitPrincipal({
      userId: user.id,
      amount,
      source: 'withdrawal',
      description: `Retrait ${amount} EUR vers ${iban.slice(0, 4)}****`,
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

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
