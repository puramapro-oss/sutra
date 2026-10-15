import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { cancelJobByKey } from '@/lib/video-queue'

const headers = { 'Cache-Control': 'private, no-store' }

/** Control the existing create queue without submitting or replaying any work. */
async function control(req: Request, cancel: boolean) {
  try {
    const session = await createServerClient()
    const { data: { user }, error: authError } = await session.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non autorise' }, { status: 401, headers })
    const query = new URL(req.url).searchParams
    const requestId = query.get('requestId')
    if (query.getAll('requestId').length !== 1 || !requestId?.trim() || requestId.length > 200) {
      return NextResponse.json({ error: 'Identite de tache invalide' }, { status: 400, headers })
    }
    const key = `create-${user.id}-${requestId}`
    const service = createServiceClient()
    const read = () => service.from('video_jobs').select('id,status,video_id')
      .eq('user_id', user.id).eq('kind', 'create').eq('idempotency_key', key).maybeSingle()
    let result = await read()
    if (result.error) throw new Error('Read unconfirmed')
    // Absence never proves cancellation: the initial POST can still arrive.
    if (!result.data) return NextResponse.json({ error: 'Tache introuvable' }, { status: 404, headers })
    if (cancel) {
      await cancelJobByKey(key)
      result = await read()
      if (result.error || !result.data) throw new Error('Cancellation unconfirmed')
    }
    const job = result.data
    return NextResponse.json({ jobId: job.id, status: job.status,
      ...(job.status === 'done' ? { videoId: job.video_id } : {}),
    }, { headers })
  } catch {
    return NextResponse.json({ error: 'Etat de la tache non confirme' }, { status: 503, headers })
  }
}

export async function GET(req: Request) { return control(req, false) }
export async function DELETE(req: Request) { return control(req, true) }
