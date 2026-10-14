import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { getOAuthUrl, getAuthorizedProfileId, OAUTH_PLATFORMS } from '@/lib/zernio'
import { issueSocialOAuthState, socialOAuthCookieName, SOCIAL_OAUTH_TTL_SECONDS } from '@/lib/social-oauth-state'
import { enforceRateLimit } from '@/lib/rate-limit'
import { publicOrigin } from '@/lib/public-origin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const connectSchema = z.object({ platform: z.enum(OAUTH_PLATFORMS) }).strict()

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
          allowed: OAUTH_PLATFORMS,
        },
        { status: 400 }
      )
    }

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
    const sessionId = claimsData?.claims.session_id
    if (claimsError || claimsData?.claims.sub !== user.id || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Session OAuth invalide' }, { status: 401 })
    }
    const { platform } = parsed.data
    const profileId = getAuthorizedProfileId(user.id)
    const binding = { profileId, sessionId }
    const state = randomBytes(32).toString('hex')
    const siteUrl = publicOrigin('https://sutra.purama.dev')
    const redirectUri = new URL('/api/social/callback', siteUrl)
    redirectUri.searchParams.set('state', state)
    redirectUri.searchParams.set('platform', platform)
    // Persist before obtaining any provider URL. Never use its internal OAuth state as ours.
    const browserSecret = await issueSocialOAuthState(user.id, platform, state, binding)
    const { url: oauthUrl } = await getOAuthUrl(platform, profileId, redirectUri.href)
    const response = NextResponse.json({ oauthUrl, state, platform })
    response.headers.set('Cache-Control', 'no-store')
    response.cookies.set(socialOAuthCookieName(state), browserSecret, {
      httpOnly: true, secure: new URL(siteUrl).protocol === 'https:', sameSite: 'lax',
      path: '/api/social', maxAge: SOCIAL_OAUTH_TTL_SECONDS,
    })
    return response
  } catch (error) {
    if (error instanceof Error && error.message === 'SUTRA_SOCIAL_REVOCATION_PENDING') {
      return NextResponse.json({ error: 'Déconnexion en cours de vérification. Réessayez plus tard ; si le blocage persiste, contactez votre administrateur.' }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'SUTRA_ZERNIO_PROFILE_BINDING_REQUIRED') {
      return NextResponse.json({ error: 'Profil social non attribué. Contactez votre administrateur.' }, { status: 503 })
    }
    return NextResponse.json(
      { error: 'Erreur génération OAuth' },
      { status: 500 }
    )
  }
}
