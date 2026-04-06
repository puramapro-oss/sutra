import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'
import { disconnectAccount, type SocialPlatform } from '@/lib/zernio'

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

    const { accountId } = parsed.data
    const client = createPublicServiceClient()

    // Verify ownership + fetch platform for zernio disconnect
    const { data: account, error: fetchError } = await client
      .from('social_accounts')
      .select('id, user_id, platform, external_id, access_token')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !account) {
      return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })
    }

    // Best-effort zernio disconnect (do not fail if remote fails)
    try {
      await disconnectAccount(
        account.platform as SocialPlatform,
        account.external_id as string
      )
    } catch (err) {
      console.error(
        '[social/accounts] zernio disconnect failed:',
        err instanceof Error ? err.message : err
      )
    }

    const { error: deleteError } = await client
      .from('social_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', user.id)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Erreur suppression compte', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json(
      { error: 'Erreur interne', details: message },
      { status: 500 }
    )
  }
}
