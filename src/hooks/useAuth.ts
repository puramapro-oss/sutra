'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { Profile } from '@/types'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'

const supabase = createClient()

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const loadedRef = useRef(false)
  const fetchingRef = useRef(false)

  const fetchProfile = useCallback(async (userId: string) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (data && !error) {
        setProfile(data as Profile)
      }
    } catch {
      // Query failed — profile stays null
    } finally {
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    // 1. Get initial session (skip if user manually signed out)
    const wasSignedOut = (() => {
      try { return sessionStorage.getItem('sutra_signed_out') === 'true' } catch { return false }
    })()

    if (wasSignedOut) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        await fetchProfile(s.user.id)
      }
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    // 2. Listen for auth changes (sign in, sign out, user updated)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, s: Session | null) => {
        if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return

        setSession(s)
        setUser(s?.user ?? null)

        if (event === 'SIGNED_OUT') {
          setProfile(null)
          setLoading(false)
        } else if (s?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
          await fetchProfile(s.user.id)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    []
  )

  const signUp = useCallback(
    async (email: string, password: string, name: string, referralCode?: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name, name, referral_code: referralCode ?? null } },
      })
      if (error) throw error
    },
    []
  )

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    // 1. Sign out from Supabase
    await supabase.auth.signOut()

    // 2. Clear ALL localStorage
    try {
      localStorage.clear()
    } catch {
      // SSR guard
    }

    // 3. Clear ALL Supabase session cookies
    document.cookie.split(';').forEach((c) => {
      const name = c.trim().split('=')[0]
      if (name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`
      }
    })

    // 4. Mark as manually signed out to prevent auto-reconnect
    try {
      sessionStorage.setItem('sutra_signed_out', 'true')
    } catch {
      // SSR guard
    }

    setUser(null)
    setProfile(null)
    setSession(null)
  }, [])

  const refetch = useCallback(async () => {
    if (user) {
      fetchingRef.current = false
      await fetchProfile(user.id)
    }
  }, [user, fetchProfile])

  return {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    refetch,
    isAuthenticated: !!user,
    isSuperAdmin: profile?.email === 'matiss.frasne@gmail.com',
    isAdmin: profile?.is_admin ?? false,
    plan: profile?.plan ?? 'free',
  }
}
