import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Redis } from '@upstash/redis'
import { verifySiret, isValidSiretFormat } from '@/lib/insee'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// POST /api/verify-siret
//
// Endpoint public (aucune auth requise) pour vérifier un SIRET FR via INSEE.
// Rate-limité par IP via Upstash Redis : 20 req / minute glissante.
//
// Body  : { siret: string }
// 200   : { ok: true, data: SiretInfo, fromCache }
// 400   : { error: 'invalid_format' | 'missing_siret' }
// 404   : { error: 'not_found', siret }
// 429   : { error: 'rate_limited', retryAfterSeconds }
// 500   : { error: 'upstream_error', status }
// 503   : { error: 'missing_api_key' } — config env manquante
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  siret: z.string().min(14).max(20),
})

const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_SEC = 60

function clientIp(req: Request): string {
  // Vercel forwarde X-Forwarded-For, on prend la 1ère IP (client réel).
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}

async function checkRateLimit(ip: string): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token || !url.startsWith('https://')) {
    // Redis absent → bypass (dev local sans Upstash). En prod les env sont configurés.
    return { ok: true }
  }
  try {
    const redis = new Redis({ url, token })
    const key = `sutra:ratelimit:insee:${ip}`
    const count = (await redis.incr(key)) as number
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC)
    if (count > RATE_LIMIT_MAX) {
      const ttl = (await redis.ttl(key)) as number
      return { ok: false, retryAfter: Math.max(1, ttl) }
    }
    return { ok: true }
  } catch {
    // Redis down → on autorise (fail open, préférable à fail closed sur un endpoint public).
    return { ok: true }
  }
}

export async function POST(req: Request): Promise<Response> {
  const ip = clientIp(req)
  const rl = await checkRateLimit(ip)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfterSeconds: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    )
  }

  const raw = await req.json().catch(() => null)
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ error: 'missing_siret' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_format', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const siret = parsed.data.siret.replace(/\s/g, '').trim()
  if (!isValidSiretFormat(siret)) {
    return NextResponse.json({ error: 'invalid_format', siret }, { status: 400 })
  }

  const result = await verifySiret(siret)

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      data: result.data,
      fromCache: result.fromCache,
    })
  }

  switch (result.reason) {
    case 'not_found':
      return NextResponse.json({ error: 'not_found', siret }, { status: 404 })
    case 'invalid_format':
      return NextResponse.json({ error: 'invalid_format', siret }, { status: 400 })
    case 'rate_limited':
      return NextResponse.json(
        { error: 'rate_limited_upstream', retryAfterSeconds: result.retryAfterSeconds },
        { status: 429 },
      )
    case 'missing_api_key':
      return NextResponse.json({ error: 'missing_api_key' }, { status: 503 })
    case 'upstream_error':
      return NextResponse.json(
        { error: 'upstream_error', status: result.status, detail: result.detail },
        { status: 502 },
      )
  }
}
