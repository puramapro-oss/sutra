import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { getOAuthUrl, type SocialPlatform } from '@/lib/zernio'
import { issueSocialOAuthState, socialOAuthCookieName, SOCIAL_OAUTH_TTL_SECONDS } from '@/lib/social-oauth-state'
import { enforceRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PLATFORMS: readonly SocialPlatform[] = [
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
] as const

const connectSchema = z.object({
  platform: z.enum([
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
  ]),
})

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const limited = enforceRateLimit(`social:connect:${user.id}`, 10, 60_000)
    if (limited) return limited

    const body = await req.json().catch(() => null)
    const parsed = connectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Plateforme invalide',
          details: parsed.error.flatten().fieldErrors,
          allowed: PLATFORMS,
        },
        { status: 400 }
      )
    }

    const { platform } = parsed.data
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sutra.purama.dev'
    const redirectUri = `${siteUrl}/api/social/callback`

    const { url: oauthUrl, state } = await getOAuthUrl(platform, user.id, redirectUri)

    const destination = new URL(oauthUrl)
    if (destination.protocol !== 'https:' || destination.username || destination.password) {
      throw new Error('SUTRA_OAUTH_INVALID_URL')
    }
    const browserSecret = await issueSocialOAuthState(user.id, platform, state)
    const response = NextResponse.json({ oauthUrl, state, platform })
    response.headers.set('Cache-Control', 'no-store')
    response.cookies.set(socialOAuthCookieName(state), browserSecret, {
      httpOnly: true, secure: new URL(siteUrl).protocol === 'https:', sameSite: 'lax',
      path: '/api/social', maxAge: SOCIAL_OAUTH_TTL_SECONDS,
    })
    return response
  } catch {
    return NextResponse.json(
      { error: 'Erreur génération OAuth' },
      { status: 500 }
    )
  }
}
