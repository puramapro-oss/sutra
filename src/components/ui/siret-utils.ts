export type SiretInfo = {
  siret: string
  siren: string
  denomination: string
  sigle: string | null
  adresse: {
    numero: string | null
    voie: string | null
    complement: string | null
    code_postal: string | null
    commune: string | null
    pays: string
  }
  activite_principale: {
    code: string | null
    libelle: string | null
  }
  date_creation: string | null
  etat_administratif: 'A' | 'F' | null
  tranche_effectif: string | null
  est_siege: boolean
}

export type VerifyState =
  | { kind: 'idle' }
  | { kind: 'incomplete'; length: number }
  | { kind: 'checking'; siret: string }
  | { kind: 'valid'; info: SiretInfo; fromCache: boolean }
  | {
      kind: 'error'
      code:
        | 'format_invalid'
        | 'not_found'
        | 'rate_limited'
        | 'server_error'
        | 'missing_api_key'
      message: string
    }

export const DEBOUNCE_MS = 450

export function normalizeSiret(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 14)
}

export function formatSiretDisplay(digits: string): string {
  // Format: 3 3 3 5 digits (FR convention).
  const s = digits.replace(/\s/g, '')
  return [s.slice(0, 3), s.slice(3, 6), s.slice(6, 9), s.slice(9, 14)]
    .filter(Boolean)
    .join(' ')
}

export function formatAddress(addr: SiretInfo['adresse']): string {
  const parts = [
    [addr.numero, addr.voie].filter(Boolean).join(' '),
    addr.complement,
    [addr.code_postal, addr.commune].filter(Boolean).join(' '),
    addr.pays,
  ].filter((p): p is string => Boolean(p && p.length > 0))
  return parts.join(' · ')
}
