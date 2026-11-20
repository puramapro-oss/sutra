export interface DurableRequestState<Intent> {
  intent: Intent | null
  ready: boolean
  busy: boolean
  cancelling: boolean
  message: string
  error: string | null
}

/** One mounted owner/session. Reading server snapshots never accesses storage. */
export function createDurableRequestStore<
  State extends { busy: boolean; cancelling: boolean },
  Active extends { controller: AbortController },
>(initial: State, restore: () => State) {
  let snapshot = initial
  let initialized = false
  let active: Active | null = null
  const listeners = new Set<() => void>()

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    getActive: () => active,
    setActive: (next: Active | null) => { active = next },
    set<Key extends keyof State>(key: Key, value: State[Key] | ((previous: State[Key]) => State[Key])) {
      const next = typeof value === 'function'
        ? (value as (previous: State[Key]) => State[Key])(snapshot[key]) : value
      if (Object.is(next, snapshot[key])) return
      snapshot = { ...snapshot, [key]: next }
      listeners.forEach(listener => listener())
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      if (!initialized) {
        initialized = true
        snapshot = restore()
        listeners.forEach(notify => notify())
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          active?.controller.abort()
          active = null
          // A stopped observer does not prove that its server task stopped.
          // Retain the intent so a remount can reconcile the same operation.
          snapshot = { ...snapshot, busy: false, cancelling: false }
        }
      }
    },
  }
}
