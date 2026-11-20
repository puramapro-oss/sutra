import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

export function assertCronAuth(request: Pick<Request, 'headers'>): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret?.trim() || ['dev', 'undefined', 'null'].includes(secret.trim().toLowerCase())) {
    console.warn('[sutra:cron] refused: secret unavailable')
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  const auth = request.headers.get('authorization')
  const expected = Buffer.from(`Bearer ${secret}`)
  const supplied = Buffer.from(auth ?? '')
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    console.warn('[sutra:cron] refused: invalid authorization')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
