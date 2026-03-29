import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

const templateSchema = z.object({
  name: z.string().min(2, 'Nom requis').max(100),
  description: z.string().max(500).optional(),
  format: z.enum(['16:9', '9:16', '1:1']),
  template_data: z.record(z.string(), z.unknown()),
  is_public: z.boolean().default(false),
})

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') ?? 'all'

    const serviceClient = createServiceClient()

    let query = serviceClient
      .from('user_templates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (type === 'mine') {
      query = query.eq('user_id', user.id)
    } else if (type === 'public') {
      query = query.eq('is_public', true)
    } else {
      query = query.or(`user_id.eq.${user.id},is_public.eq.true`)
    }

    const { data: templates } = await query

    return NextResponse.json({ templates: templates ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur recuperation templates', details: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = templateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const serviceClient = createServiceClient()

    const { count: existingCount } = await serviceClient
      .from('user_templates')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()

    const planLimits: Record<string, number> = {
      free: 3,
      starter: 10,
      creator: 999,
      empire: 999,
      admin: 999,
    }
    const maxTemplates = planLimits[profile?.plan ?? 'free'] ?? 3

    if ((existingCount ?? 0) >= maxTemplates) {
      return NextResponse.json(
        { error: `Limite de ${maxTemplates} templates atteinte pour votre plan.` },
        { status: 403 }
      )
    }

    const { data: template } = await serviceClient
      .from('user_templates')
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        format: parsed.data.format,
        template_data: parsed.data.template_data,
        is_public: parsed.data.is_public,
      })
      .select('*')
      .single()

    return NextResponse.json({ template }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur creation template', details: message }, { status: 500 })
  }
}
