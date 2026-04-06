import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { exchangeOAuthCode, type SocialPlatform } from '@/lib/zernio'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_PLATFORMS: readonly string[] = [
  'tiktok',
  'youtube',
  'instagram',
  'facebook',
  'x',
  'linkedin',
  'pinterest',
  'reddit',
  'threads',
  'snapchat',
  'tumblr',
  'mastodon',
  'bluesky',
  'vimeo',
]

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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const platformParam = url.searchParams.get('platform')
    const errorParam = url.searchParams.get('error')

    if (errorParam) {
      return redirectToSettings(siteUrl, { error: errorParam })
    }

    if (!code || !state || !platformParam) {
      return redirectToSettings(siteUrl, { error: 'missing_params' })
    }

    if (!ALLOWED_PLATFORMS.includes(platformParam)) {
      return redirectToSettings(siteUrl, { error: 'invalid_platform' })
    }

    const platform = platformParam as SocialPlatform

    // State format: "userId:platform:random"
    const stateParts = state.split(':')
    if (stateParts.length < 3) {
      return redirectToSettings(siteUrl, { error: 'invalid_state' })
    }
    const userId = stateParts[0]
    const statePlatform = stateParts[1]

    if (statePlatform !== platform) {
      return redirectToSettings(siteUrl, { error: 'state_mismatch' })
    }

    // Exchange OAuth code for account profile + tokens
    const profile = await exchangeOAuthCode(platform, code, state)

    const client = createPublicServiceClient()

    if (!profile.externalId || !profile.username) {
      return redirectToSettings(siteUrl, { error: 'oauth_empty_profile' })
    }

    const { error: upsertError } = await client
      .from('social_accounts')
      .upsert(
        {
          user_id: userId,
          platform,
          external_id: profile.externalId,
          username: profile.username,
          display_name: profile.displayName ?? null,
          avatar_url: profile.avatarUrl ?? null,
          access_token: profile.accessToken ?? null,
          refresh_token: profile.refreshToken ?? null,
          token_expires_at: profile.tokenExpiresAt ?? null,
          status: 'connected',
          metadata: {},
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,platform' }
      )

    if (upsertError) {
      return redirectToSettings(siteUrl, {
        error: 'db_error',
        message: upsertError.message,
      })
    }

    return redirectToSettings(siteUrl, { connected: platform })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_exchange_failed'
    return redirectToSettings(siteUrl, { error: 'oauth_failed', message })
  }
}
