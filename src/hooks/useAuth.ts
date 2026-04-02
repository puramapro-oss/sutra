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
  const profileIdRef = useRef<string | null>(null)
  const initializedRef = useRef(false)

  const fetchProfile = useCallback(async (userId: string) => {
    // Skip if we already have this profile loaded
    if (profileIdRef.current === userId) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (data && !error) {
        profileIdRef.current = userId
        setProfile(data as Profile)
      }
    } catch {
      // Supabase query failed — leave profile null, loading will still resolve
    }
  }, [])

  useEffect(() => {
    // Get initial session once
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        fetchProfile(s.user.id).then(() => setLoading(false))
      } else {
        setLoading(false)
      }
      initializedRef.current = true
    })

    // Listen for auth changes — only react to actual sign in/out
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, s) => {
        // Skip token refreshes and initial session (already handled above)
        if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return

        setSession(s)
        setUser(s?.user ?? null)

        if (event === 'SIGNED_OUT') {
          profileIdRef.current = null
          setProfile(null)
          setLoading(false)
        } else if (s?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
          profileIdRef.current = null // Force refetch on sign in
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
    async (email: string, password: string, name: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name, name } },
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
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setSession(null)
  }, [])

  const refetch = useCallback(async () => {
    if (user) await fetchProfile(user.id)
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
