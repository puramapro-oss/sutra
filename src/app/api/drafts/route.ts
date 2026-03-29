import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

const draftSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.string().min(1).max(50),
  data: z.record(z.string(), z.unknown()),
})

const deleteDraftSchema = z.object({
  id: z.string().uuid('ID de brouillon invalide'),
})

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const serviceClient = createServiceClient()
    const { data: drafts } = await serviceClient
      .from('drafts')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)

    return NextResponse.json({ drafts: drafts ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur recuperation brouillons', details: message }, { status: 500 })
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
    const parsed = draftSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { id, type, data } = parsed.data
    const serviceClient = createServiceClient()

    if (id) {
      const { data: existing } = await serviceClient
        .from('drafts')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (existing) {
        const { data: updated } = await serviceClient
          .from('drafts')
          .update({ type, data, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', user.id)
          .select('*')
          .single()

        return NextResponse.json({ draft: updated })
      }
    }

    const { data: draft } = await serviceClient
      .from('drafts')
      .insert({ user_id: user.id, type, data })
      .select('*')
      .single()

    return NextResponse.json({ draft }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur sauvegarde brouillon', details: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = deleteDraftSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const serviceClient = createServiceClient()
    const { error: deleteError } = await serviceClient
      .from('drafts')
      .delete()
      .eq('id', parsed.data.id)
      .eq('user_id', user.id)

    if (deleteError) {
      return NextResponse.json({ error: 'Erreur suppression brouillon' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur suppression brouillon', details: message }, { status: 500 })
  }
}
