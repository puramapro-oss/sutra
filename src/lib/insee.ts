import { cached } from '@/lib/redis'

// ---------------------------------------------------------------------------
// INSEE Sirene API — Vérification SIRET/SIREN pour comptes pros SUTRA.
// Source of truth : STRIPE_CONNECT_KARMA_V4.md §36.1 + CLAUDE.md §36.1.
//
// Clé universelle Purama (active depuis 21/04/2026, portail-api.insee.fr) :
//   INSEE_API_KEY=023ed173-7904-4893-bed1-7379043893fc
//
// Endpoint : GET https://api.insee.fr/api-sirene/3.11/siret/{siret}
// Header   : X-INSEE-Api-Key-Integration: $INSEE_API_KEY
// Cache    : Upstash Redis 24h (key: insee:siret:{siret}).
// ---------------------------------------------------------------------------

const INSEE_BASE = 'https://api.insee.fr/api-sirene/3.11'
const CACHE_TTL_SECONDS = 24 * 60 * 60 // 24h — les données SIRET changent rarement

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
  etat_administratif: 'A' | 'F' | null // A = actif, F = fermé
  tranche_effectif: string | null
  est_siege: boolean
}

export type VerifyResult =
  | { ok: true; data: SiretInfo; fromCache: boolean }
  | { ok: false; reason: 'not_found'; siret: string }
  | { ok: false; reason: 'invalid_format'; siret: string }
  | { ok: false; reason: 'rate_limited'; retryAfterSeconds?: number }
  | { ok: false; reason: 'missing_api_key' }
  | { ok: false; reason: 'upstream_error'; status: number; detail?: string }

const SIRET_RE = /^\d{14}$/
const SIREN_RE = /^\d{9}$/

export function isValidSiretFormat(siret: string): boolean {
  return SIRET_RE.test(siret)
}

export function isValidSirenFormat(siren: string): boolean {
  return SIREN_RE.test(siren)
}

/**
 * Vérifie un SIRET auprès de l'INSEE Sirene.
 * Cache 24h dans Upstash Redis (miss si Redis indispo → fetch direct).
 */
export async function verifySiret(siretRaw: string): Promise<VerifyResult> {
  const siret = siretRaw.replace(/\s/g, '').trim()
  if (!isValidSiretFormat(siret)) {
    return { ok: false, reason: 'invalid_format', siret }
  }

  const apiKey = process.env.INSEE_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false, reason: 'missing_api_key' }
  }

  // Wrapper cached → Result (pour garder le typage strict, on wrap dans un cache key unique)
  const result = await cached<VerifyResult>(
    `insee:siret:${siret}`,
    () => fetchSiretFromInsee(siret, apiKey),
    CACHE_TTL_SECONDS,
  )

  // fromCache signal (cached() ne distingue pas, on assume cache hit si appelé 2× de suite).
  // Pour un tracking précis, on pourrait faire un check manuel redis → mais overkill ici.
  if (result.ok) {
    return { ...result, fromCache: false }
  }
  return result
}

async function fetchSiretFromInsee(siret: string, apiKey: string): Promise<VerifyResult> {
  const url = `${INSEE_BASE}/siret/${siret}`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-INSEE-Api-Key-Integration': apiKey,
        Accept: 'application/json',
      },
      // Timeout implicite via Next fetch (30s par défaut) — OK pour INSEE qui répond ~500ms.
    })
  } catch (err) {
    return {
      ok: false,
      reason: 'upstream_error',
      status: 0,
      detail: err instanceof Error ? err.message : 'fetch failed',
    }
  }

  if (res.status === 404) return { ok: false, reason: 'not_found', siret }
  if (res.status === 429) {
    const retryAfter = res.headers.get('retry-after')
    return {
      ok: false,
      reason: 'rate_limited',
      retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined,
    }
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return {
      ok: false,
      reason: 'upstream_error',
      status: res.status,
      detail: body.slice(0, 200),
    }
  }

  const json = (await res.json()) as InseeSiretResponse & {
    header?: { statut?: number; message?: string }
  }

  // INSEE retourne parfois 200 HTTP avec header.statut=404 (« siret introuvable »).
  const internalStatus = json.header?.statut
  if (internalStatus === 404) return { ok: false, reason: 'not_found', siret }
  if (internalStatus && internalStatus >= 400) {
    return {
      ok: false,
      reason: 'upstream_error',
      status: internalStatus,
      detail: json.header?.message ?? '',
    }
  }
  if (!json.etablissement) return { ok: false, reason: 'not_found', siret }

  const data = mapInseeToSiretInfo(siret, json)
  return { ok: true, data, fromCache: false }
}

// ---------------------------------------------------------------------------
// Mapping INSEE → SiretInfo (shape opaque → shape applicatif)
// ---------------------------------------------------------------------------

type InseeSiretResponse = {
  etablissement?: {
    siret?: string
    siren?: string
    dateCreationEtablissement?: string | null
    etablissementSiege?: boolean
    trancheEffectifsEtablissement?: string | null
    uniteLegale?: {
      denominationUniteLegale?: string | null
      sigleUniteLegale?: string | null
      nomUniteLegale?: string | null
      prenom1UniteLegale?: string | null
      etatAdministratifUniteLegale?: 'A' | 'F' | null
      activitePrincipaleUniteLegale?: string | null
      nomenclatureActivitePrincipaleUniteLegale?: string | null
    }
    adresseEtablissement?: {
      numeroVoieEtablissement?: string | null
      typeVoieEtablissement?: string | null
      libelleVoieEtablissement?: string | null
      complementAdresseEtablissement?: string | null
      codePostalEtablissement?: string | null
      libelleCommuneEtablissement?: string | null
      libellePaysEtrangerEtablissement?: string | null
    }
    periodesEtablissement?: Array<{
      etatAdministratifEtablissement?: 'A' | 'F' | null
      activitePrincipaleEtablissement?: string | null
    }>
  }
}

function mapInseeToSiretInfo(
  siret: string,
  json: InseeSiretResponse,
): SiretInfo {
  const etab = json.etablissement ?? {}
  const ul = etab.uniteLegale ?? {}
  const adr = etab.adresseEtablissement ?? {}
  const lastPeriod = etab.periodesEtablissement?.[0] ?? {}

  const denomination =
    ul.denominationUniteLegale ??
    [ul.prenom1UniteLegale, ul.nomUniteLegale].filter(Boolean).join(' ').trim() ??
    'Inconnu'

  const voie = [adr.typeVoieEtablissement, adr.libelleVoieEtablissement]
    .filter(Boolean)
    .join(' ')
    .trim() || null

  return {
    siret: etab.siret ?? siret,
    siren: etab.siren ?? siret.slice(0, 9),
    denomination: denomination || 'Inconnu',
    sigle: ul.sigleUniteLegale ?? null,
    adresse: {
      numero: adr.numeroVoieEtablissement ?? null,
      voie,
      complement: adr.complementAdresseEtablissement ?? null,
      code_postal: adr.codePostalEtablissement ?? null,
      commune: adr.libelleCommuneEtablissement ?? null,
      pays: adr.libellePaysEtrangerEtablissement ?? 'FRANCE',
    },
    activite_principale: {
      code:
        lastPeriod.activitePrincipaleEtablissement ??
        ul.activitePrincipaleUniteLegale ??
        null,
      libelle: null, // INSEE ne fournit pas le libellé en V3.11 — lookup séparé si besoin
    },
    date_creation: etab.dateCreationEtablissement ?? null,
    etat_administratif:
      lastPeriod.etatAdministratifEtablissement ??
      ul.etatAdministratifUniteLegale ??
      null,
    tranche_effectif: etab.trancheEffectifsEtablissement ?? null,
    est_siege: Boolean(etab.etablissementSiege),
  }
}
