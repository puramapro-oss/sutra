import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const services: Record<string, { status: string; latency_ms?: number }> = {}

    const supabaseStart = Date.now()
    try {
      const supabase = createServiceClient()
      const { error } = await supabase.from('profiles').select('id').limit(1)
      services.supabase = {
        status: error ? 'degraded' : 'operational',
        latency_ms: Date.now() - supabaseStart,
      }
    } catch {
      services.supabase = { status: 'down', latency_ms: Date.now() - supabaseStart }
    }

    const stripeStart = Date.now()
    try {
      const res = await fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
        signal: AbortSignal.timeout(5000),
      })
      services.stripe = {
        status: res.ok ? 'operational' : 'degraded',
        latency_ms: Date.now() - stripeStart,
      }
    } catch {
      services.stripe = { status: 'down', latency_ms: Date.now() - stripeStart }
    }

    const elevenlabsStart = Date.now()
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '' },
        signal: AbortSignal.timeout(5000),
      })
      services.elevenlabs = {
        status: res.ok ? 'operational' : 'degraded',
        latency_ms: Date.now() - elevenlabsStart,
      }
    } catch {
      services.elevenlabs = { status: 'down', latency_ms: Date.now() - elevenlabsStart }
    }

    const allOperational = Object.values(services).every((s) => s.status === 'operational')
    const anyDown = Object.values(services).some((s) => s.status === 'down')

    return NextResponse.json({
      status: anyDown ? 'partial_outage' : allOperational ? 'ok' : 'degraded',
      app: 'SUTRA',
      version: '1.0.0',
      services,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json(
      { status: 'error', message, timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
