'use client'

import { useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase'
import { createAuthSessionStore } from '@/lib/auth-session-store'
import { safeNextPath } from '@/lib/auth-navigation'

const supabase = createClient()
const store = createAuthSessionStore(supabase)

async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

async function signUp(email: string, password: string, name: string, referralCode?: string) {
  const { error } = await supabase.auth.signUp({
    email, password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: { full_name: name, name, referral_code: referralCode ?? null },
    },
  })
  if (error) throw error
}

async function signInWithGoogle(next?: string) {
  const redirectTo = new URL('/auth/callback', window.location.origin)
  redirectTo.searchParams.set('next', safeNextPath(next))
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo.toString() } })
  if (error) throw error
}

async function signOut() {
  // The SDK removes only its own session cookies. Preserve consent and user preferences.
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function useAuth() {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
  return {
    ...snapshot, signIn, signUp, signInWithGoogle, signOut, refetch: store.refetch,
    isAuthenticated: Boolean(snapshot.user),
    isSuperAdmin: snapshot.profile?.is_admin === true && snapshot.profile.email === 'matiss.frasne@gmail.com',
    isAdmin: snapshot.profile?.is_admin ?? false,
    plan: snapshot.profile?.plan ?? 'free',
  }
}
