import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const registerSchema = z.object({
  channel: z.enum(['influencer', 'website', 'media', 'physical']),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional().or(z.literal('')),
  social_links: z.record(z.string(), z.string()).optional(),
})

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20)
}

function randomChars(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

async function generateUniqueCode(
  service: ReturnType<typeof createServiceClient>,
  baseName: string
): Promise<string> {
  const slug = slugify(baseName)
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `${slug}-${randomChars(4)}`
    const { data: existing } = await service
      .from('partners')
      .select('id')
      .eq('code', code)
      .single()
    if (!existing) return code
  }
  // Fallback with longer random suffix
  return `${slug}-${randomChars(8)}`
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { channel, bio, website, social_links } = parsed.data
    const service = createServiceClient()

    // Check if already a partner
    const { data: existingPartner } = await service
      .from('partners')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existingPartner) {
      return NextResponse.json(
        { error: 'Tu es deja partenaire' },
        { status: 400 }
      )
    }

    // Get profile for name
    const { data: profile } = await service
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const baseName = profile?.full_name || profile?.email?.split('@')[0] || 'partner'
    const partnerCode = await generateUniqueCode(service, baseName)

    // Insert partner record
    const { data: partner, error: insertError } = await service
      .from('partners')
      .insert({
        user_id: user.id,
        code: partnerCode,
        slug: partnerCode,
        channel,
        bio: bio ?? null,
        website_url: website || null,
        social_links: social_links ?? {},
        status: 'active',
        tier: 'bronze',
        current_balance: 0,
        total_earned: 0,
        total_referrals: 0,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: 'Erreur creation partenaire', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ partner })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur inscription partenaire', details: message }, { status: 500 })
  }
}
