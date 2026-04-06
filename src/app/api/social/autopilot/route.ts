import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PLATFORM_ENUM = z.enum([
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
])

const CAPTION_STYLE = z.enum([
  'engaging',
  'professional',
  'casual',
  'educational',
  'humorous',
])

const upsertSchema = z.object({
  enabled: z.boolean(),
  default_platforms: z.array(PLATFORM_ENUM).default([]),
  auto_caption: z.boolean().default(true),
  auto_hashtags: z.boolean().default(true),
  caption_style: CAPTION_STYLE.default('engaging'),
  max_hashtags: z.number().int().min(0).max(30).default(10),
  include_cta: z.boolean().default(true),
  auto_publish_delay_minutes: z.number().int().min(0).max(10080).optional(),
  posting_schedule: z.record(z.string(), z.unknown()).optional(),
})

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

const DEFAULT_CONFIG = {
  enabled: false,
  default_platforms: [] as string[],
  auto_caption: true,
  auto_hashtags: true,
  auto_publish_delay_minutes: 0,
  posting_schedule: {} as Record<string, unknown>,
  caption_style: 'engaging',
  max_hashtags: 10,
  include_cta: true,
}

export async function GET() {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const client = createPublicServiceClient()
    const { data, error } = await client
      .from('social_autopilot_config')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: 'Erreur récupération config', details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      const nowIso = new Date().toISOString()
      const { data: created, error: insertError } = await client
        .from('social_autopilot_config')
        .insert({
          user_id: user.id,
          ...DEFAULT_CONFIG,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('*')
        .single()

      if (insertError) {
        return NextResponse.json(
          { error: 'Erreur création config', details: insertError.message },
          { status: 500 }
        )
      }
      return NextResponse.json({ config: created })
    }

    return NextResponse.json({ config: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json(
      { error: 'Erreur interne', details: message },
      { status: 500 }
    )
  }
}

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
    const parsed = upsertSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const client = createPublicServiceClient()
    const nowIso = new Date().toISOString()

    const { data, error } = await client
      .from('social_autopilot_config')
      .upsert(
        {
          user_id: user.id,
          ...parsed.data,
          updated_at: nowIso,
        },
        { onConflict: 'user_id' }
      )
      .select('*')
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Erreur enregistrement', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ config: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json(
      { error: 'Erreur interne', details: message },
      { status: 500 }
    )
  }
}
