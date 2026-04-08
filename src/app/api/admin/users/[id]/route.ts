import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/utils'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Non autorise' }, { status: 401 }) }
  }
  if (!isSuperAdmin(user.email)) {
    return { error: NextResponse.json({ error: 'Acces interdit' }, { status: 403 }) }
  }
  return { user }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdmin()
    if ('error' in guard) return guard.error
    const { id } = await params

    const service = createServiceClient()

    const [{ data: profile }, { data: videos }, { data: payments }] = await Promise.all([
      service.from('profiles').select('*').eq('id', id).maybeSingle(),
      service.from('videos').select('id, title, status, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
      service.from('payments').select('id, amount, status, plan, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
    ])

    if (!profile) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    return NextResponse.json({
      profile,
      videos: videos ?? [],
      payments: payments ?? [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdmin()
    if ('error' in guard) return guard.error
    const { id } = await params

    const body = await req.json()
    const action = String(body?.action ?? '')

    const service = createServiceClient()

    // Prevent banning the super admin himself
    const { data: target } = await service.from('profiles').select('email').eq('id', id).maybeSingle()
    if (target?.email && isSuperAdmin(target.email)) {
      return NextResponse.json({ error: 'Impossible de modifier le super admin' }, { status: 403 })
    }

    if (action === 'ban') {
      await service
        .from('profiles')
        .update({ subscription_status: 'banned', updated_at: new Date().toISOString() })
        .eq('id', id)
      return NextResponse.json({ success: true, status: 'banned' })
    }

    if (action === 'unban') {
      await service
        .from('profiles')
        .update({ subscription_status: 'active', updated_at: new Date().toISOString() })
        .eq('id', id)
      return NextResponse.json({ success: true, status: 'active' })
    }

    if (action === 'set_plan') {
      const plan = String(body?.plan ?? '')
      const allowed = ['free', 'starter', 'creator', 'empire', 'admin']
      if (!allowed.includes(plan)) {
        return NextResponse.json({ error: 'Plan invalide' }, { status: 400 })
      }
      await service
        .from('profiles')
        .update({ plan, updated_at: new Date().toISOString() })
        .eq('id', id)
      return NextResponse.json({ success: true, plan })
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
