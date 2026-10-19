import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { createServerClient } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/utils'
import { setupSchema } from '@/data/setup-schema'

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' }
  try {
    const session = await createServerClient()
    const { data: { user }, error } = await session.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401, headers })
    }
    if (!isSuperAdmin(user.email)) {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403, headers })
    }

    const supabase = createServiceClient()

    // Check if profiles table exists
    const { error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)

    if (checkError && checkError.code === '42P01') {
      return NextResponse.json({
        status: 'needs_setup',
        message: 'Tables need to be created. Run the SQL below in Supabase SQL Editor.',
        sql_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}`,
        sql: setupSchema,
      }, { headers })
    }

    // Verify key tables
    const tables = ['profiles', 'videos', 'user_notifications', 'api_logs']
    const results: Record<string, string> = {}

    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1)
      results[table] = error ? `error: ${error.code}` : 'ok'
    }

    // Check super admin
    const { data: admin } = await supabase
      .from('profiles')
      .select('id, email, plan, is_admin')
      .eq('email', 'matiss.frasne@gmail.com')
      .single()

    return NextResponse.json({
      status: 'ok',
      tables: results,
      super_admin: admin ? 'exists' : 'not_found',
    }, { headers })
  } catch {
    return NextResponse.json(
      { error: 'Setup failed' },
      { status: 500, headers }
    )
  }
}
