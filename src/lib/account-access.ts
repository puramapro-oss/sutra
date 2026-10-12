import { AuthApiError, type SupabaseClient, type UserResponse } from '@supabase/supabase-js'

/** Keep Supabase's verified identity, then check current application access on every request. */
export function enforceAccountAccess<T extends Pick<SupabaseClient, 'auth' | 'from'>>(client: T): T {
  const getUser = client.auth.getUser.bind(client.auth)
  client.auth.getUser = async (...args): Promise<UserResponse> => {
    try {
      const result = await getUser(...args)
      if (result.error || !result.data.user) return result
      const user = result.data.user
      const { data: profile, error } = await client.from('profiles')
        .select('id, subscription_status, access_revoked_at').eq('id', user.id).maybeSingle()
      if (error) return denied(503)
      if (!profile || profile.id !== user.id || profile.subscription_status === 'banned' || profile.access_revoked_at) return denied(403)
      return result
    } catch {
      return denied(503)
    }
  }
  return client
}

function denied(status: number): UserResponse {
  // Do not propagate database/provider messages (which may contain credentials).
  return { data: { user: null }, error: new AuthApiError('Account access unavailable', status, 'account_access_denied') }
}
