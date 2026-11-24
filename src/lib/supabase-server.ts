import { createServerClient as createSSRClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sessionCookieOptions } from '@/lib/auth-navigation'
import { enforceAccountAccess } from '@/lib/account-access'

export async function createServerClient() {
  const cookieStore = await cookies()

  return enforceAccountAccess(createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: process.env.NEXT_PUBLIC_APP_SCHEMA || 'sutra' },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, sessionCookieOptions(options, cookieStore.get('sutra_persist')?.value))
            })
          } catch {
            // Server component — ignore
          }
        },
      },
    }
  ))
}
