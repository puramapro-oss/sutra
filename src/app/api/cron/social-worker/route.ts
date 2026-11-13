import { NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { drainSocialPublications } from '@/lib/social-publication-worker'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/** Dedicated to already accepted social work; cannot reserve generation quota. */
export async function POST(req: Request) {
  const denied = assertCronAuth(req)
  if (denied) return denied
  try {
    const result = await drainSocialPublications()
    return NextResponse.json(result, { status: result.confirmed ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Traitement social indisponible' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
