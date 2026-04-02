import { createBrowserClient } from '@supabase/ssr'
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
