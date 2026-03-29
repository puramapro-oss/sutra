import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const appSchema = process.env.NEXT_PUBLIC_APP_SCHEMA || 'sutra'

export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: appSchema as 'public' },
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })
}

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
