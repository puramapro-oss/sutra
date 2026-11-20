'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

/** Do not submit a client-only form natively before its event handlers are hydrated. */
export function useHydrated() { return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) }
