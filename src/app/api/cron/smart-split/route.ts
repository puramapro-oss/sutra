import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { transferInternal, normalizeSubWallets } from '@/lib/smart-split'
import { sendNotification } from '@/lib/logger'

// V6 Section 10 — Smart Split CRON quotidien :
// 1. Boost : déblocage tranches >30j → retour Principal + intérêts 2%/mois
// 2. Solidaire : virement mensuel vers Asso PURAMA (1er du mois uniquement)

const SOLIDAIRE_ASSO_USER_ID = process.env.ASSO_PURAMA_USER_ID // wallet dédié asso

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? 'dev'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const now = new Date()
  const results = { boost_unlocked: 0, interest_paid: 0, solidaire_transferred: 0 }

  // --- 1. Boost : déblocage tranches arrivées à terme ---
  const { data: dueTranches } = await service
    .from('boost_tranches')
    .select('id, user_id, amount, deposited_at, last_interest_at')
    .eq('status', 'locked')
    .lte('unlock_at', now.toISOString())

  for (const t of dueTranches ?? []) {
    const ok = await transferInternal({
      userId: t.user_id,
      amount: Number(t.amount),
      from: 'boost',
      to: 'principal',
      description: 'Déblocage Boost 30j — retour Principal',
    })
    if (ok) {
      await service.from('boost_tranches').update({
        status: 'released',
        released_at: now.toISOString(),
      }).eq('id', t.id)
      results.boost_unlocked++
    }
  }

  // --- 2. Boost : intérêts 2%/mois sur tranches toujours lockées ---
  const { data: lockedTranches } = await service
    .from('boost_tranches')
    .select('id, user_id, amount, deposited_at, last_interest_at')
    .eq('status', 'locked')

  for (const t of lockedTranches ?? []) {
    const reference = t.last_interest_at ?? t.deposited_at
    const daysSince = (now.getTime() - new Date(reference).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince < 30) continue

    const interest = Math.round(Number(t.amount) * 0.02 * 100) / 100
    if (interest <= 0) continue

    await transferInternal({
      userId: t.user_id,
      amount: interest,
      from: 'boost',
      to: 'boost',
      description: `Intérêt Boost 2% mensuel : +${interest.toFixed(2)} €`,
    })
    // Hack : transferInternal(from=to) est no-op. On fait un crédit direct simple.
    // Approche simple : ajout direct au sub_wallet boost via service client.
    const { data: wallet } = await service
      .from('wallets')
      .select('sub_wallets, total_earned, balance')
      .eq('user_id', t.user_id)
      .single()
    if (wallet) {
      const sw = normalizeSubWallets(wallet.sub_wallets)
      sw.boost = Math.round((sw.boost + interest) * 100) / 100
      await service.from('wallets').update({
        sub_wallets: sw,
        balance: Math.round((Number(wallet.balance ?? 0) + interest) * 100) / 100,
        total_earned: Math.round((Number(wallet.total_earned ?? 0) + interest) * 100) / 100,
        updated_at: now.toISOString(),
      }).eq('user_id', t.user_id)

      await service.from('wallet_transactions').insert({
        user_id: t.user_id,
        type: 'credit',
        amount: interest,
        source: 'boost_interest',
        description: `Intérêt Boost 2% mensuel`,
        sub_wallet_delta: { boost: interest },
      })
    }

    await service.from('boost_tranches').update({
      last_interest_at: now.toISOString(),
      amount: Number(t.amount) + interest,
    }).eq('id', t.id)

    results.interest_paid++
  }

  // --- 3. Solidaire : virement mensuel (1er du mois uniquement) ---
  if (now.getDate() === 1) {
    const period = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`

    const { data: wallets } = await service
      .from('wallets')
      .select('user_id, sub_wallets, balance')

    for (const w of wallets ?? []) {
      const sw = normalizeSubWallets(w.sub_wallets)
      if (sw.solidaire <= 0) continue

      // Vérifier pas déjà transféré ce mois
      const { data: existing } = await service
        .from('solidaire_transfers')
        .select('id')
        .eq('user_id', w.user_id)
        .eq('period', period)
        .maybeSingle()
      if (existing) continue

      const amount = sw.solidaire
      sw.solidaire = 0

      await service.from('wallets').update({
        sub_wallets: sw,
        balance: Math.max(0, Number(w.balance ?? 0) - amount),
        updated_at: now.toISOString(),
      }).eq('user_id', w.user_id)

      await service.from('solidaire_transfers').insert({
        user_id: w.user_id,
        amount,
        period,
      })

      await service.from('wallet_transactions').insert({
        user_id: w.user_id,
        type: 'debit',
        amount,
        source: 'solidaire_transfer',
        description: `Virement Solidaire ${period} → Asso PURAMA`,
        sub_wallet_delta: { solidaire: -amount },
      })

      await sendNotification(w.user_id, {
        type: 'info',
        title: 'Virement Solidaire effectué',
        message: `${amount.toFixed(2)} € viennent d'être transférés à l'Association PURAMA. Merci pour ton soutien 💜`,
      })

      // Crédit du wallet Asso PURAMA si configuré
      if (SOLIDAIRE_ASSO_USER_ID) {
        const { data: assoWallet } = await service
          .from('wallets')
          .select('balance, total_earned, sub_wallets')
          .eq('user_id', SOLIDAIRE_ASSO_USER_ID)
          .maybeSingle()
        if (assoWallet) {
          const assoSw = normalizeSubWallets(assoWallet.sub_wallets)
          assoSw.principal = Math.round((assoSw.principal + amount) * 100) / 100
          await service.from('wallets').update({
            balance: Math.round((Number(assoWallet.balance ?? 0) + amount) * 100) / 100,
            total_earned: Math.round((Number(assoWallet.total_earned ?? 0) + amount) * 100) / 100,
            sub_wallets: assoSw,
          }).eq('user_id', SOLIDAIRE_ASSO_USER_ID)
        }
      }

      results.solidaire_transferred++
    }
  }

  return NextResponse.json({ status: 'ok', ...results })
}
