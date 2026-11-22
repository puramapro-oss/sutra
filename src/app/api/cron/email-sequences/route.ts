import { NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { createServiceClient } from '@/lib/supabase'
import { runEmailSequences } from '@/lib/email-sequence-runner'

export async function GET(request: Request) {
  const authError = assertCronAuth(request)
  if (authError) return authError
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return NextResponse.json({ error: 'Service email indisponible' }, { status: 503 })
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(45_000)])
    const result = await runEmailSequences(createServiceClient(), (message, options) => resend.emails.send(message, options), signal)
    const partial = result.errors > 0 || result.needsReconciliation > 0 || result.incomplete
    return NextResponse.json({ status: partial ? 'partial' : 'ok', ...result }, { status: partial ? 503 : 200 })
  } catch {
    return NextResponse.json({ error: 'Séquences email indisponibles' }, { status: 503 })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 60
