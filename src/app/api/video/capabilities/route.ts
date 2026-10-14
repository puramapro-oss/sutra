import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { isSuperAdmin } from '@/lib/utils'
import { saladPublicCapabilities } from '@/lib/salad/application'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' }
  try {
    const supabase = await createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers })
    return NextResponse.json(await saladPublicCapabilities(isSuperAdmin(user.email)), { headers })
  } catch {
    return NextResponse.json({ error: 'CAPABILITIES_UNAVAILABLE' }, { status: 503, headers })
  }
}
