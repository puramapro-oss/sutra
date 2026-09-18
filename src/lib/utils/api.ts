// -----------------------------------------------------------------------------
// HTTP utilitaire partagé par tous les providers :
//   - timeout par requête (respecte le signal fourni par l'appelant)
//   - retries bornés + backoff exponentiel avec jitter
//   - circuit breaker par origine (échecs consécutifs → refus immédiat
//     pendant le cooldown, sans spammer un fournisseur à terre)
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

/**
 * Message d'erreur HTTP normalisé pour les providers : statut + début du
 * corps (jamais de header/secrets). Format unique → logs et tests cohérents.
 */
export async function httpErrorMessage(res: Response): Promise<string> {
  const detail = await res.text().catch(() => '')
  return `HTTP ${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ''}`
}

// ------------------------------ fetch + retries ------------------------------

/**
 * fetch avec retries bornés (5xx et erreurs réseau uniquement — les 4xx ne
 * sont jamais rejoués), backoff exponentiel + jitter, timeout global
 * couvrant l'ensemble des tentatives (30s par défaut).
 *
 * Le `signal` fourni dans options EST respecté (le timeout par défaut de 30s
 * ne s'applique qu'en son absence) — un appelant peut exiger un timeout plus
 * long (ex. génération LTX synchrone 180s).
 *
 * @throws Error explicite après épuisement, ou immédiatement si circuit ouvert.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  if (!isHostHealthy(url)) {
    throw new Error(
      `Service temporairement indisponible (circuit ouvert) : ${breakerKey(url)}. Reessaie dans moins d'une minute.`
    )
  }

  const defaultTimeout = AbortSignal.timeout(30_000)
  const signal = options.signal ?? defaultTimeout

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, { ...options, signal })
      if (res.ok) {
        recordHostSuccess(url)
        return res
      }
      if (res.status < 500) {
        // 4xx : erreur client (clé invalide, requête mal formée…) — inutile de rejouer.
        return res
      }
      console.warn(`[api] ${res.status} sur ${breakerKey(url)} (tentative ${attempt + 1}/${maxRetries})`)
      if (attempt < maxRetries - 1) await sleep(Math.pow(2, attempt) * 1000 + Math.random() * 400)
    } catch (e) {
      if (attempt === maxRetries - 1) {
        recordHostFailure(url)
        throw e
      }
      await sleep(Math.pow(2, attempt) * 1000 + Math.random() * 400)
    }
  }

  recordHostFailure(url)
  throw new Error(`Echec apres ${maxRetries} tentatives : ${breakerKey(url)}`)
}
