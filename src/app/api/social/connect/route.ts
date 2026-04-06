import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { getOAuthUrl, type SocialPlatform } from '@/lib/zernio'

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

    return NextResponse.json({ oauthUrl, state, platform })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur connexion OAuth'
    return NextResponse.json(
      { error: 'Erreur génération OAuth', details: message },
      { status: 500 }
    )
  }
}
