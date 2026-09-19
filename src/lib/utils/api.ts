// -----------------------------------------------------------------------------
// HTTP utilitaire partagé par tous les providers :
//   - timeout global couvrant l'ensemble des tentatives (signal appelant respecté)
//   - retries bornés + backoff exponentiel avec jitter
//   - circuit breaker par origine (échecs consécutifs → refus immédiat
//     pendant le cooldown, sans spammer un fournisseur à terre)
//   - PAS de rejeu automatique des requêtes non idempotentes (POST…) :
//     une réponse perdue après acceptation ne doit JAMAIS déclencher une
//     seconde génération payante. Un POST n'est rejoué que si l'appelant
//     fournit une `idempotencyKey` durable (header Idempotency-Key).
//   - journalisation sans secret (origine + statut uniquement)
// -----------------------------------------------------------------------------

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ------------------------------ Circuit breaker ------------------------------

interface BreakerState {
  failures: number
  openedAt: number
}

const BREAKER_THRESHOLD = 5
const BREAKER_COOLDOWN_MS = 60_000

const breakers = new Map<string, BreakerState>()

function breakerKey(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

export function isHostHealthy(url: string): boolean {
  const state = breakers.get(breakerKey(url))
  if (!state || state.failures < BREAKER_THRESHOLD) return true
  if (Date.now() - state.openedAt > BREAKER_COOLDOWN_MS) {
    breakers.delete(breakerKey(url))
    return true
  }
  return false
}

function recordHostFailure(url: string): void {
  const key = breakerKey(url)
  const state = breakers.get(key) ?? { failures: 0, openedAt: 0 }
  state.failures += 1
  if (state.failures === BREAKER_THRESHOLD) {
    state.openedAt = Date.now()
    console.error(`[api] circuit ouvert pour ${key} (${BREAKER_THRESHOLD} echecs consecutifs, cooldown ${BREAKER_COOLDOWN_MS / 1000}s)`)
  }
  breakers.set(key, state)
}

function recordHostSuccess(url: string): void {
  breakers.delete(breakerKey(url))
}

export function getBreakerStatus(): Array<{ origin: string; failures: number; open: boolean }> {
  return Array.from(breakers.entries()).map(([origin, state]) => ({
    origin,
    failures: state.failures,
    open: state.failures >= BREAKER_THRESHOLD && Date.now() - state.openedAt <= BREAKER_COOLDOWN_MS,
  }))
}

// ------------------------------ fetch + retries ------------------------------

/**
 * Message d'erreur HTTP normalisé pour les providers : statut + début du
 * corps (jamais de header/secrets). Format unique → logs et tests cohérents.
 */
export async function httpErrorMessage(res: Response): Promise<string> {
  const detail = await res.text().catch(() => '')
  return `HTTP ${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ''}`
}

/** Options étendues : clé d'idempotence durable pour autoriser le rejeu d'un POST. */
export interface FetchOptions extends RequestInit {
  idempotencyKey?: string
}

/**
 * fetch avec retries bornés.
 *
 * - GET/HEAD : retries automatiques (5xx/erreurs réseau), backoff exponentiel
 *   + jitter, timeout global (30s par défaut, signal appelant respecté).
 * - POST/PATCH et autres méthodes non idempotentes : UNE SEULE tentative,
 *   sauf si `idempotencyKey` est fournie (header `Idempotency-Key`) — dans ce
 *   cas les retries sont autorisés et le fournisseur peut dédupliquer.
 *
 * Raison d'être : éviter qu'une réponse perdue après acceptation d'un job
 * génératif ne provoque une seconde soumission (double facturation).
 *
 * @throws Error explicite après épuisement, ou immédiatement si circuit ouvert.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions,
  maxRetries = 3
): Promise<Response> {
  if (!isHostHealthy(url)) {
    throw new Error(
      `Service temporairement indisponible (circuit ouvert) : ${breakerKey(url)}. Reessaie dans moins d'une minute.`
    )
  }

  const method = (options.method ?? 'GET').toUpperCase()
  const { idempotencyKey, ...init } = options
  const retryAllowed = method === 'GET' || method === 'HEAD' || Boolean(idempotencyKey)
  const attempts = retryAllowed ? Math.max(1, maxRetries) : 1

  if (idempotencyKey) {
    init.headers = {
      ...(init.headers as Record<string, string> | undefined),
      'Idempotency-Key': idempotencyKey,
    }
  }

  const defaultTimeout = AbortSignal.timeout(30_000)
  const signal = init.signal ?? defaultTimeout

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal })
      if (res.ok) {
        recordHostSuccess(url)
        return res
      }
      if (res.status < 500) {
        // 4xx : erreur client (clé invalide, requête mal formée…) — inutile de rejouer.
        return res
      }
      console.warn(`[api] ${res.status} sur ${breakerKey(url)} (tentative ${attempt + 1}/${attempts})`)
      if (attempt < attempts - 1) await sleep(Math.pow(2, attempt) * 1000 + Math.random() * 400)
    } catch (e) {
      if (attempt === attempts - 1) {
        recordHostFailure(url)
        throw e
      }
      await sleep(Math.pow(2, attempt) * 1000 + Math.random() * 400)
    }
  }

  recordHostFailure(url)
  throw new Error(`Echec apres ${attempts} tentative(s) : ${breakerKey(url)}`)
}
