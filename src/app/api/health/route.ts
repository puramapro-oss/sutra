import { NextResponse } from 'next/server'
import { getLtxHealth } from '@/lib/ltx'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface ServiceStatus {
  status: 'ok' | 'degraded' | 'down'
  latency?: number
  details?: string
}

async function checkService(
  checker: () => Promise<void>,
  timeoutMs = 10_000
): Promise<ServiceStatus> {
  const start = Date.now()
  try {
    await Promise.race([
      checker(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      ),
    ])
    return { status: 'ok', latency: Date.now() - start }
  } catch (err) {
    return {
      status: 'down',
      latency: Date.now() - start,
      details: err instanceof Error ? err.message : 'unknown',
    }
  }
}

export async function GET() {
  const [supabase, stripe, elevenlabs, suno] = await Promise.all([
    checkService(async () => {
      const client = createServiceClient()
      const { error } = await client.from('profiles').select('id').limit(1)
      if (error) throw error
    }),
    checkService(async () => {
      const res = await fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`${res.status}`)
    }),
    checkService(async () => {
      const res = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '' },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`${res.status}`)
    }),
    checkService(async () => {
      const baseUrl = process.env.SUNO_BASE_URL ?? 'https://api.suno.ai/v1'
      const res = await fetch(`${baseUrl}/health`, {
        headers: { Authorization: `Bearer ${process.env.SUNO_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      }).catch(() => { throw new Error('unreachable') })
      if (!res.ok) throw new Error(`${res.status}`)
    }),
  ])

  const ltxHealth = getLtxHealth()
  const ltx: ServiceStatus = {
    status: ltxHealth.healthy ? 'ok' : 'degraded',
    details: `failures: ${ltxHealth.failures}`,
  }

  const services = { supabase, ltx, stripe, elevenlabs, suno }

  const allOk = Object.values(services).every((s) => s.status === 'ok')
  const anyDown = Object.values(services).some((s) => s.status === 'down')

  return NextResponse.json(
    {
      status: anyDown ? 'degraded' : allOk ? 'ok' : 'degraded',
      app: 'SUTRA',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      services,
    },
    { status: anyDown ? 503 : 200 }
  )
}
