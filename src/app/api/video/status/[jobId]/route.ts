import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params
    const session = await createServerClient()
    const { data: { user }, error: authError } = await session.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(jobId)) {
      return NextResponse.json({ error: 'Job ID invalide' }, { status: 400 })
    }
    const { data: job, error } = await createServiceClient().from('video_jobs')
      .select('id,status,video_id,kind,progress').eq('id', jobId).eq('user_id', user.id).maybeSingle()
    if (error) return NextResponse.json({ error: 'Statut indisponible' }, { status: 503 })
    if (!job) return NextResponse.json({ error: 'Tache introuvable' }, { status: 404 })
    return NextResponse.json({ jobId: job.id, videoId: job.video_id, status: job.status,
      ...(job.kind === 'production' && job.status === 'done' ? { data: job.progress?.result } : {}),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Statut indisponible' }, { status: 503 })
  }
}
