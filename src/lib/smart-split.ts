// V6 Section 10 — Smart Split helper
// Point d'entrée UNIQUE pour tout crédit/débit wallet.
// Split automatique : Principal 55% / Boost 15% / Emergency 10% / Dream 10% / Pending 5% / Solidaire 5%
//
// Règles:
// - Tout crédit sur un compte utilisateur passe par creditWallet()
// - Les retraits / dépenses ne sortent QUE du Principal
// - Les crédits "pending" (à vérifier) vont 100% dans Pending au lieu d'être splittés
// - Les crédits "reversal" (sortie d'un sous-wallet vers Principal) ne sont pas re-splittés

import { createServiceClient } from './supabase'

export type SubWallet = 'principal' | 'boost' | 'emergency' | 'dream' | 'pending' | 'solidaire'

export const SPLIT_RATIOS: Record<SubWallet, number> = {
  principal: 0.55,
  boost:     0.15,
  emergency: 0.10,
  dream:     0.10,
  pending:   0.05,
  solidaire: 0.05,
}

export const SUB_WALLET_LABELS: Record<SubWallet, string> = {
  principal: 'Principal',
  boost:     'Boost',
  emergency: 'Emergency',
  dream:     'Dream',
  pending:   'Pending',
  solidaire: 'Solidaire',
}

export type SubWalletBalances = Record<SubWallet, number>

export function emptyBalances(): SubWalletBalances {
  return { principal: 0, boost: 0, emergency: 0, dream: 0, pending: 0, solidaire: 0 }
}

export function computeSplit(amount: number): SubWalletBalances {
  const result = emptyBalances()
  // Pour éviter les pertes de centimes, Principal absorbe l'arrondi.
  let distributed = 0
  for (const key of ['boost', 'emergency', 'dream', 'pending', 'solidaire'] as SubWallet[]) {
    const v = Math.round(amount * SPLIT_RATIOS[key] * 100) / 100
    result[key] = v
    distributed += v
  }
  result.principal = Math.round((amount - distributed) * 100) / 100
  return result
}

function addBalances(a: SubWalletBalances, b: Partial<SubWalletBalances>): SubWalletBalances {
  const out = { ...a }
  for (const k of Object.keys(b) as SubWallet[]) {
    out[k] = Math.round((out[k] + (b[k] ?? 0)) * 100) / 100
  }
  return out
}

/**
 * Crédite le wallet avec split automatique.
 * mode='split'     → répartit selon SPLIT_RATIOS (défaut, pour gains réels)
 * mode='pending'   → 100% dans Pending (vérification en attente)
 * mode='principal' → 100% Principal (ex: reversal d'un autre sub-wallet)
 */
export async function creditWallet(params: {
  userId: string
  amount: number
  source: string
  description: string
  mode?: 'split' | 'pending' | 'principal'
}): Promise<SubWalletBalances> {
  const { userId, amount, source, description, mode = 'split' } = params
  if (amount <= 0) return emptyBalances()

  const service = createServiceClient()

  const { data: wallet } = await service
    .from('wallets')
    .select('balance, total_earned, sub_wallets')
    .eq('user_id', userId)
    .maybeSingle()

  if (!wallet) {
    // Créer le wallet si absent
    const initial = mode === 'split' ? computeSplit(amount) : { ...emptyBalances(), [mode === 'pending' ? 'pending' : 'principal']: amount }
    await service.from('wallets').insert({
      user_id: userId,
      balance: amount,
      total_earned: amount,
      sub_wallets: initial,
    })
    await writeTransaction(userId, amount, source, description, initial, 'credit')
    return initial
  }

  let delta: SubWalletBalances
  if (mode === 'split') delta = computeSplit(amount)
  else if (mode === 'pending') delta = { ...emptyBalances(), pending: amount }
  else delta = { ...emptyBalances(), principal: amount }

  const current = normalizeSubWallets(wallet.sub_wallets)
  const updated = addBalances(current, delta)

  await service
    .from('wallets')
    .update({
      balance: Math.round((Number(wallet.balance ?? 0) + amount) * 100) / 100,
      total_earned: Math.round((Number(wallet.total_earned ?? 0) + amount) * 100) / 100,
      sub_wallets: updated,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  await writeTransaction(userId, amount, source, description, delta, 'credit')

  // Side-effect V6 : chaque crédit au sous-wallet Boost crée une tranche bloquée 30j
  if (mode === 'split' && delta.boost > 0) {
    const unlockAt = new Date()
    unlockAt.setDate(unlockAt.getDate() + 30)
    await service.from('boost_tranches').insert({
      user_id: userId,
      amount: delta.boost,
      unlock_at: unlockAt.toISOString(),
      status: 'locked',
    })
  }

  return updated
}

/**
 * Débite le wallet depuis le sous-wallet Principal uniquement.
 * Les autres sous-wallets sont inaccessibles au retrait direct.
 */
export async function debitPrincipal(params: {
  userId: string
  amount: number
  source: string
  description: string
}): Promise<{ ok: boolean; principal_after: number }> {
  const { userId, amount, source, description } = params
  const service = createServiceClient()

  const { data: wallet } = await service
    .from('wallets')
    .select('balance, pending_balance, sub_wallets')
    .eq('user_id', userId)
    .single()

  if (!wallet) return { ok: false, principal_after: 0 }

  const current = normalizeSubWallets(wallet.sub_wallets)
  if (current.principal < amount) return { ok: false, principal_after: current.principal }

  const updated = addBalances(current, { principal: -amount })

  await service
    .from('wallets')
    .update({
      balance: Math.max(0, Number(wallet.balance ?? 0) - amount),
      sub_wallets: updated,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  await writeTransaction(userId, amount, source, description, { ...emptyBalances(), principal: -amount }, 'debit')

  return { ok: true, principal_after: updated.principal }
}

/**
 * Transfère interne d'un sous-wallet vers un autre (ex: Boost débloqué → Principal).
 */
export async function transferInternal(params: {
  userId: string
  amount: number
  from: SubWallet
  to: SubWallet
  description: string
}): Promise<boolean> {
  const { userId, amount, from, to, description } = params
  if (from === to || amount <= 0) return false
  const service = createServiceClient()

  const { data: wallet } = await service
    .from('wallets')
    .select('sub_wallets')
    .eq('user_id', userId)
    .single()

  if (!wallet) return false
  const current = normalizeSubWallets(wallet.sub_wallets)
  if (current[from] < amount) return false

  const updated = addBalances(current, { [from]: -amount, [to]: amount } as Partial<SubWalletBalances>)

  await service
    .from('wallets')
    .update({ sub_wallets: updated, updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  await writeTransaction(userId, amount, 'internal_transfer', description,
    { ...emptyBalances(), [from]: -amount, [to]: amount } as Partial<SubWalletBalances> as SubWalletBalances,
    'transfer'
  )
  return true
}

async function writeTransaction(
  userId: string,
  amount: number,
  source: string,
  description: string,
  subWalletDelta: Partial<SubWalletBalances>,
  type: 'credit' | 'debit' | 'transfer'
) {
  const service = createServiceClient()
  await service.from('wallet_transactions').insert({
    user_id: userId,
    type,
    amount,
    source,
    description,
    sub_wallet_delta: subWalletDelta,
  })
}

function normalizeSubWallets(raw: unknown): SubWalletBalances {
  if (!raw || typeof raw !== 'object') return emptyBalances()
  const r = raw as Record<string, unknown>
  return {
    principal: Number(r.principal ?? 0),
    boost:     Number(r.boost ?? 0),
    emergency: Number(r.emergency ?? 0),
    dream:     Number(r.dream ?? 0),
    pending:   Number(r.pending ?? 0),
    solidaire: Number(r.solidaire ?? 0),
  }
}

export { normalizeSubWallets }
