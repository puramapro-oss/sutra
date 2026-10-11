import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import { sessionCookieOptions } from '@/lib/auth-navigation'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const appSchema = process.env.NEXT_PUBLIC_APP_SCHEMA || 'sutra'

/**
 * Browser client — stores auth tokens + PKCE verifier in cookies
 * so the server callback route can read them.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: appSchema },
    ...(typeof document !== 'undefined' ? {
      cookies: {
        getAll: () => parseCookieHeader(document.cookie).map(({ name, value }) => ({ name, value: value ?? '' })),
        setAll: (items: { name: string; value: string; options: import('@supabase/ssr').CookieOptions }[]) => {
          const remember = parseCookieHeader(document.cookie).find(c => c.name === 'sutra_persist')?.value
          for (const { name, value, options } of items) {
            document.cookie = serializeCookieHeader(name, value, sessionCookieOptions(options, remember))
          }
        },
      },
    } : {}),
  })
}

/**
 * Service role client — server-side only, bypasses RLS.
 */
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    db: { schema: appSchema as 'public' },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export const supabase = createClient()
