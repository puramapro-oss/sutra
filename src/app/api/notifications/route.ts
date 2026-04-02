import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { cached, invalidateCachePattern } from '@/lib/redis'

const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
  all: z.boolean().optional(),
}).refine((data) => data.ids || data.all, {
  message: 'Fournir "ids" ou "all: true"',
})

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    const result = await cached(
      `notifs:${user.id}:${offset}:${limit}`,
      async () => {
        const serviceClient = createServiceClient()
        const { data: notifications, count } = await serviceClient
          .from('user_notifications')
          .select('*', { count: 'exact' })
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        const { count: unreadCount } = await serviceClient
          .from('user_notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false)

        return {
          notifications: notifications ?? [],
          total: count ?? 0,
          unread: unreadCount ?? 0,
        }
      },
      30
    )

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur recuperation notifications', details: message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = markReadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const serviceClient = createServiceClient()

    if (parsed.data.all) {
      await serviceClient
        .from('user_notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
    } else if (parsed.data.ids) {
      await serviceClient
        .from('user_notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .in('id', parsed.data.ids)
    }

    await invalidateCachePattern(`notifs:${user.id}:*`)

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur mise a jour notifications', details: message }, { status: 500 })
  }
}
