import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    if (!jobId || jobId.length < 5) {
      return NextResponse.json({ error: 'Job ID invalide' }, { status: 400 })
    }

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY
    const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID

    if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
      return NextResponse.json({ error: 'RunPod non configure' }, { status: 503 })
    }

    const res = await fetch(
      `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/status/${jobId}`,
      { headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` } }
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'Impossible de recuperer le statut' }, { status: 502 })
    }

    const data = await res.json()

    if (data.status === 'COMPLETED') {
      const output = data.output?.images?.[0] ?? data.output?.video_url ?? data.output
      const url = typeof output === 'string' ? output : output?.data ?? null
      return NextResponse.json({ status: 'completed', url })
    }

    if (data.status === 'FAILED') {
      return NextResponse.json({ status: 'failed', error: data.error ?? 'Generation echouee' })
    }

    return NextResponse.json({ status: data.status?.toLowerCase() ?? 'in_queue' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur verification statut', details: message }, { status: 500 })
  }
}
