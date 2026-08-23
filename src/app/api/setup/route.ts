import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { setupSchema } from '@/data/setup-schema'

export async function GET() {
  try {
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
      })
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
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Setup failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
