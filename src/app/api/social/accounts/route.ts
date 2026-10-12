import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'
import { revokeSocialAccount } from '@/lib/social-account-revocation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
      .from('social_accounts')
      .select(
        'id, platform, external_id, username, display_name, avatar_url, status, connected_at, updated_at, metadata, token_expires_at'
      )
      .eq('user_id', user.id)
      .order('connected_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Erreur récupération comptes', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ accounts: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json(
      { error: 'Erreur interne', details: message },
      { status: 500 }
    )
  }
}

const deleteSchema = z.object({
  accountId: z.string().uuid('accountId invalide'),
})

export async function DELETE(req: Request) {
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
    const parsed = deleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const result = await revokeSocialAccount(user.id, parsed.data.accountId)
    return NextResponse.json(result, { status: result.success ? 200 : 202 })
  } catch (err) {
    if (err instanceof Error && err.message === 'SUTRA_ACCOUNT_NOT_FOUND') {
      return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Revocation non confirmee' }, { status: 503 })
  }
}
