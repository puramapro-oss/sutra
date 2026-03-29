import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/utils'

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    if (!isSuperAdmin(user.email)) {
      return NextResponse.json({ error: 'Acces interdit' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const search = searchParams.get('search') ?? ''
    const planFilter = searchParams.get('plan') ?? ''
    const sortBy = searchParams.get('sort') ?? 'created_at'
    const sortOrder = searchParams.get('order') === 'asc' ? true : false

    const offset = (page - 1) * limit
    const serviceClient = createServiceClient()

    let query = serviceClient
      .from('profiles')
      .select('id, email, name, plan, is_admin, credits, wallet_balance, monthly_video_count, subscription_status, created_at, updated_at', { count: 'exact' })

    if (search.length > 0) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`)
    }

    if (planFilter.length > 0) {
      query = query.eq('plan', planFilter)
    }

    const validSorts = ['created_at', 'email', 'plan', 'monthly_video_count', 'wallet_balance']
    const sortColumn = validSorts.includes(sortBy) ? sortBy : 'created_at'

    query = query.order(sortColumn, { ascending: sortOrder })
    query = query.range(offset, offset + limit - 1)

    const { data: users, count } = await query

    return NextResponse.json({
      users: users ?? [],
      total: count ?? 0,
      page,
      limit,
      total_pages: Math.ceil((count ?? 0) / limit),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur recuperation utilisateurs', details: message }, { status: 500 })
  }
}
