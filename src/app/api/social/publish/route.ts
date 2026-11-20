import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { publishVideoRecord } from '@/lib/social-publication'
import { durablePublicationReceipt, readDurablePublicationReceipt } from '@/lib/social-publication-receipt'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120
const privateResponse = { 'Cache-Control': 'private, no-store' }

const platformSchema = z.enum(['tiktok', 'youtube', 'instagram', 'facebook', 'x', 'linkedin', 'pinterest', 'reddit', 'threads', 'snapchat', 'tumblr', 'mastodon', 'bluesky', 'vimeo'])
const schema = z.object({
  videoId: z.string().uuid(),
  platforms: z.array(platformSchema).min(1).max(14),
  accountIds: z.record(z.string(), z.string().uuid()).optional(),
  destinations: z.array(z.object({ platform: platformSchema, accountId: z.string().uuid() }).strict()).min(1).max(50).optional(),
  caption: z.string().max(20000).optional(), hashtags: z.array(z.string().max(100)).max(100).optional(),
  title: z.string().max(500).optional(), description: z.string().max(20000).optional(), tags: z.array(z.string().max(100)).max(100).optional(),
  autoCaption: z.boolean().optional(), reconcileOnly: z.boolean().optional(), scheduledAt: z.string().datetime({ offset: true }).optional(),
}).superRefine((input, context) => {
  if (!input.destinations) return
  const platforms = new Set(input.destinations.map(destination => destination.platform))
  if (input.accountIds || new Set(input.destinations.map(destination => destination.accountId)).size !== input.destinations.length
    || input.platforms.some(platform => !platforms.has(platform))
    || input.destinations.some(destination => !input.platforms.includes(destination.platform))) {
    context.addIssue({ code: 'custom', path: ['destinations'], message: 'Selection des comptes incoherente' })
  }
})

export async function POST(req: Request) {
  try {
    const session = await createServerClient()
    const { data: { user }, error } = await session.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    const body = await req.json().catch(() => null)
    const parsed = schema.safeParse(body && { ...body, videoId: body.videoId ?? body.video_id, scheduledAt: body.scheduledAt ?? body.scheduled_at })
    if (!parsed.success) return NextResponse.json({ error: 'Donnees de publication invalides' }, { status: 400 })
    if (parsed.data.reconcileOnly) {
      const durable = await readDurablePublicationReceipt(user.id, parsed.data.videoId)
      if (durable) return NextResponse.json(durable, { status: durable.hasPending ? 202 : 200, headers: privateResponse })
    }
    const outcome = await publishVideoRecord(user.id, parsed.data, undefined, undefined, undefined, {}, undefined,
      parsed.data.reconcileOnly ? undefined : { mode: 'enqueue' })
    const response = parsed.data.reconcileOnly || 'reconciliationRequired' in outcome
      ? outcome : durablePublicationReceipt(parsed.data.videoId, outcome.operations)
    return NextResponse.json(response, {
      status: ('hasPending' in response && response.hasPending) || ['publishing', 'scheduled'].includes(response.status) ? 202 : 200,
      headers: privateResponse,
    })
  } catch (error) {
    const code = error instanceof Error && /^SUTRA_[A-Z_]+/.test(error.message) ? error.message.split(':')[0] : 'SUTRA_PUBLICATION_UNCONFIRMED'
    return NextResponse.json({ error: 'Publication non confirmee', code }, { status: 409 })
  }
}

/** Reload/polling reads committed evidence only; it never grants or retries work. */
export async function GET(req: Request) {
  try {
    const session = await createServerClient()
    const { data: { user }, error } = await session.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Non autorise' }, { status: 401, headers: privateResponse })
    const params = new URL(req.url).searchParams
    const parsed = z.string().uuid().safeParse(params.get('videoId'))
    if (!parsed.success || params.getAll('videoId').length !== 1) {
      return NextResponse.json({ error: 'Identite de publication invalide' }, { status: 400, headers: privateResponse })
    }
    const receipt = await readDurablePublicationReceipt(user.id, parsed.data)
    if (!receipt) return NextResponse.json({ error: 'Lot durable introuvable' }, { status: 404, headers: privateResponse })
    return NextResponse.json(receipt, { headers: privateResponse })
  } catch {
    return NextResponse.json({ error: 'Suivi de publication indisponible' }, { status: 503, headers: privateResponse })
  }
}
