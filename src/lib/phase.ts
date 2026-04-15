/**
 * V6 Section 19 — Phases de déploiement
 * Lit PURAMA_PHASE et les flags d'activation par partenaire.
 * Phase 1 = wallet Points, carte en teaser.
 * Phase 2 = Treezor actif, IBAN, retrait euros.
 */

export type PuramaPhase = 1 | 2
export type WalletMode = 'points' | 'euros'

function flag(name: string, fallback = false): boolean {
  const v = process.env[name]
  if (v === undefined) return fallback
  return v === 'true' || v === '1'
}

export function getPhase(): PuramaPhase {
  const raw = process.env.PURAMA_PHASE ?? process.env.NEXT_PUBLIC_PURAMA_PHASE ?? '1'
  return raw === '2' ? 2 : 1
}

export function getWalletMode(): WalletMode {
  const raw = process.env.WALLET_MODE ?? process.env.NEXT_PUBLIC_WALLET_MODE ?? 'points'
  return raw === 'euros' ? 'euros' : 'points'
}

export function isCardAvailable(): boolean {
  return flag('CARD_AVAILABLE')
}

export function isIbanAvailable(): boolean {
  return flag('IBAN_AVAILABLE')
}

export function isWithdrawalAvailable(): boolean {
  return flag('WITHDRAWAL_AVAILABLE')
}

export function isPrimeCardActive(): boolean {
  return flag('PRIME_CARD_ACTIVE')
}

export function isTreezorActive(): boolean {
  return flag('TREEZOR_ACTIVE')
}

/**
 * URL de souscription centralisée purama.dev (V6 section 11).
 * Fallback: checkout local si NEXT_PUBLIC_SUBSCRIBE_URL non défini.
 */
export function buildSubscribeUrl(params: {
  appSlug: string
  userId: string
  returnTo?: string
}): string {
  const base = process.env.NEXT_PUBLIC_SUBSCRIBE_URL
  if (!base) return '/pricing'
  const url = new URL(base)
  url.searchParams.set('app', params.appSlug)
  url.searchParams.set('user', params.userId)
  if (params.returnTo) url.searchParams.set('return', params.returnTo)
  return url.toString()
}
