import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const service = createServiceClient()
  const { data } = await service
    .from('social_feed')
    .select('id, event_type, display_name, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ events: data ?? [] })
}
