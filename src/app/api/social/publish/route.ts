import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { publishVideoRecord } from '@/lib/social-publication'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

const schema = z.object({
  videoId: z.string().uuid(),
  platforms: z.array(z.enum(['tiktok', 'youtube', 'instagram', 'facebook', 'x', 'linkedin', 'pinterest', 'reddit', 'threads', 'snapchat', 'tumblr', 'mastodon', 'bluesky', 'vimeo'])).min(1).max(14),
  accountIds: z.record(z.string(), z.string().uuid()).optional(),
  caption: z.string().max(20000).optional(), hashtags: z.array(z.string().max(100)).max(100).optional(),
  title: z.string().max(500).optional(), description: z.string().max(20000).optional(), tags: z.array(z.string().max(100)).max(100).optional(),
  autoCaption: z.boolean().optional(), scheduledAt: z.string().datetime({ offset: true }).optional(),
})

export async function POST(req: Request) {
  try {
    const session = await createServerClient()
    const { data: { user }, error } = await session.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    const body = await req.json().catch(() => null)
    const parsed = schema.safeParse(body && { ...body, videoId: body.videoId ?? body.video_id, scheduledAt: body.scheduledAt ?? body.scheduled_at })
    if (!parsed.success) return NextResponse.json({ error: 'Donnees de publication invalides' }, { status: 400 })
    const outcome = await publishVideoRecord(user.id, parsed.data)
    return NextResponse.json(outcome, { status: ['publishing', 'scheduled'].includes(outcome.status) ? 202 : 200 })
  } catch (error) {
    const code = error instanceof Error && /^SUTRA_[A-Z_]+/.test(error.message) ? error.message.split(':')[0] : 'SUTRA_PUBLICATION_UNCONFIRMED'
    return NextResponse.json({ error: 'Publication non confirmee', code }, { status: 409 })
  }
}
