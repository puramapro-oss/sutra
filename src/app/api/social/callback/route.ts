import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getConnectedAccount, getAuthorizedProfileId, OAUTH_PLATFORMS, type SocialPlatform } from '@/lib/zernio'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase-server'
import { consumeSocialOAuthState, socialOAuthCookieName } from '@/lib/social-oauth-state'
import { publicOrigin } from '@/lib/public-origin'
import { readSocialOAuthAccount, updateSocialOAuthAccount } from '@/lib/social-oauth-account'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function createPublicServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: 'public' },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
}

function redirectToSettings(baseUrl: string, params: Record<string, string>) {
  const url = new URL('/settings/social', baseUrl)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return NextResponse.redirect(url.toString(), { status: 302 })
}

export async function GET(req: Request) {
  const siteUrl = publicOrigin('https://sutra.purama.dev')
  try {
    const url = new URL(req.url)
    const connected = url.searchParams.get('connected')
    const returnedProfileId = url.searchParams.get('profileId')
    const accountId = url.searchParams.get('accountId')
    const state = url.searchParams.get('state')
    const returnedPlatform = url.searchParams.get('platform')
    const platformParam = returnedPlatform === 'twitter' ? 'x' : returnedPlatform
    const errorParam = url.searchParams.get('error')

    if (!state || !platformParam || (!errorParam && (!connected || !returnedProfileId || !accountId))) {
      return redirectToSettings(siteUrl, { error: 'missing_params' })
    }

    if (!(OAUTH_PLATFORMS as readonly string[]).includes(platformParam)) {
      return redirectToSettings(siteUrl, { error: 'invalid_platform' })
    }

    const platform = platformParam as SocialPlatform

    const session = await createServerClient()
    const { data: { user }, error: authError } = await session.auth.getUser()
    if (authError || !user) return redirectToSettings(siteUrl, { error: 'session_required' })
    const { data: claimsData, error: claimsError } = await session.auth.getClaims()
    const sessionId = claimsData?.claims.session_id
    if (claimsError || claimsData?.claims.sub !== user.id || typeof sessionId !== 'string') return redirectToSettings(siteUrl, { error: 'session_required' })
    const profileId = getAuthorizedProfileId(user.id)
    if (((!errorParam || returnedProfileId) && returnedProfileId !== profileId)
      || ((!errorParam || connected) && connected !== (platform === 'x' ? 'twitter' : platform))) {
      return redirectToSettings(siteUrl, { error: 'invalid_or_expired_state' })
    }
    const binding = { profileId, sessionId }
    const cookieStore = await cookies()
    const cookieName = socialOAuthCookieName(state)
    const client = createPublicServiceClient()
    const account = await readSocialOAuthAccount(user.id, platform, client)
    const consumed = await consumeSocialOAuthState(user.id, platform, state, cookieStore.get(cookieName)?.value, binding, undefined, account)
    if (!consumed) return redirectToSettings(siteUrl, { error: 'invalid_or_expired_state' })
    cookieStore.set(cookieName, '', { path: '/api/social', maxAge: 0, httpOnly: true,
      secure: new URL(siteUrl).protocol === 'https:', sameSite: 'lax' })
    // A denial ends this attempt too. It must not leave a reusable state or
    // accept an unbound error query as a verified provider callback.
    if (errorParam) return redirectToSettings(siteUrl, {
      error: ['oauth_denied', 'access_denied'].includes(errorParam) ? 'oauth_denied' : 'oauth_failed',
    })
    const userId = user.id

    // Zernio holds all platform tokens; verify the hosted result by a scoped server GET.
    const profile = await getConnectedAccount(platform, profileId, accountId!)

    // The provider GET awaited remote I/O. A reassigned profile must not become
    // a new local authorization using the binding captured before that wait.
    if (getAuthorizedProfileId(userId) !== profileId) {
      return redirectToSettings(siteUrl, { error: 'invalid_or_expired_state' })
    }

    if (!profile.externalId || !profile.username) {
      return redirectToSettings(siteUrl, { error: 'oauth_empty_profile' })
    }

    const record = {
      user_id: userId,
      platform,
      external_id: profile.externalId,
      username: profile.username,
      display_name: profile.displayName ?? null,
      avatar_url: profile.avatarUrl ?? null,
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      status: 'connected',
      metadata: { zernio_profile_id: profileId, credential_owner: 'zernio', sutra_oauth_revision: randomUUID() },
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    // First connection uses the unique (user_id, platform) constraint; existing
    // connections use CAS. Neither path may replace a newer authorization.
    const saved = account
      ? await updateSocialOAuthAccount(userId, account, record, client)
      : await client.from('social_accounts').insert(record).select('id').maybeSingle()

    if (saved.error || !saved.data) {
      return redirectToSettings(siteUrl, {
        error: 'db_error',
      })
    }

    return redirectToSettings(siteUrl, { connected: platform })
  } catch {
    return redirectToSettings(siteUrl, { error: 'oauth_failed' })
  }
}
