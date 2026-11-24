import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import type { Profile } from '@/types'

export interface AuthSnapshot {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: string | null
}

export const EMPTY_AUTH: AuthSnapshot = {
  user: null, session: null, profile: null, loading: true, error: null,
}

/** One subscription and one profile request shared by all useAuth consumers. */
export function createAuthSessionStore(client: Pick<SupabaseClient, 'auth' | 'from'>) {
  let snapshot = EMPTY_AUTH
  const listeners = new Set<() => void>()
  let active = false
  let epoch = 0
  let sessionRevision = 0
  let unsubscribe: (() => void) | undefined
  let scheduled: ReturnType<typeof setTimeout> | undefined
  let profileRequest: { id: string; controller: AbortController; promise: Promise<void> } | undefined

  function update(next: AuthSnapshot) {
    snapshot = next
    listeners.forEach(listener => listener())
  }

  function cancelProfile() {
    clearTimeout(scheduled)
    scheduled = undefined
    profileRequest?.controller.abort()
    profileRequest = undefined
  }

  function fetchProfile(force = false): Promise<void> {
    const id = snapshot.user?.id
    if (!active || !id) return Promise.resolve()
    if (profileRequest?.id === id) return profileRequest.promise
    if (snapshot.profile?.id === id && !force) return Promise.resolve()
    const currentEpoch = epoch
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new Error('PROFILE_TIMEOUT'))
      }, 12_000)
    })
    const request = { id, controller, promise: Promise.resolve() }
    profileRequest = request
    request.promise = (async () => {
      try {
        const { data, error } = await Promise.race([
          client.from('profiles').select('*').eq('id', id).abortSignal(controller.signal).single(),
          timeout,
        ])
        if (error) throw error
        if (data?.id !== id) throw new Error('PROFILE_ID_MISMATCH')
        if (active && epoch === currentEpoch && profileRequest === request && snapshot.user?.id === id) {
          update({ ...snapshot, profile: data as Profile, loading: false, error: null })
        }
      } catch {
        if (active && epoch === currentEpoch && profileRequest === request && snapshot.user?.id === id) {
          update({ ...snapshot, loading: false, error: 'Impossible de charger le profil. Réessaie.' })
        }
      } finally {
        clearTimeout(timer!)
        if (profileRequest === request) profileRequest = undefined
      }
    })()
    return request.promise
  }

  function receiveSession(session: Session | null, refreshProfile = false) {
    if (!active) return
    sessionRevision++
    const identityChanged = snapshot.user?.id !== session?.user.id
    if (identityChanged || !session) cancelProfile()
    const profile = identityChanged || !session ? null : snapshot.profile
    update({ user: session?.user ?? null, session, profile, loading: Boolean(session && !profile), error: null })
    // Never call a Supabase API while its auth notification holds the SDK lock.
    if (session && (!profile || refreshProfile)) {
      clearTimeout(scheduled)
      scheduled = setTimeout(() => { scheduled = undefined; void fetchProfile(refreshProfile) }, 0)
    }
  }

  function start() {
    active = true
    const currentEpoch = ++epoch
    const beforeSession = sessionRevision
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (active && epoch === currentEpoch) receiveSession(session, event === 'USER_UPDATED')
    })
    unsubscribe = () => data.subscription.unsubscribe()
    void client.auth.getSession().then(({ data, error }) => {
      if (!active || epoch !== currentEpoch || sessionRevision !== beforeSession) return
      if (error) throw error
      receiveSession(data.session)
    }).catch(() => {
      if (active && epoch === currentEpoch && sessionRevision === beforeSession) {
        update({ ...EMPTY_AUTH, loading: false, error: 'Impossible de vérifier la session.' })
      }
    })
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => EMPTY_AUTH,
    subscribe(listener: () => void) {
      listeners.add(listener)
      if (!active) start()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          active = false
          epoch++
          unsubscribe?.()
          unsubscribe = undefined
          cancelProfile()
          snapshot = EMPTY_AUTH
        }
      }
    },
    refetch: () => fetchProfile(true),
  }
}
