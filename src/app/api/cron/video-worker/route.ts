import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { assertCronAuth } from '@/lib/cron-auth'
import { claimJobs, finishJob } from '@/lib/video-queue'
import { runVideoJob } from '@/lib/video-worker'

export const maxDuration = 300

export async function GET(req: Request) {
  const denied = assertCronAuth(req)
  if (denied) return denied
  const worker = `worker-${randomUUID()}`
  const results: Array<{ jobId: string; status: string; error?: string }> = []
  try {
    const jobs = await claimJobs(worker, 1, 600)
    for (const job of jobs) {
      try {
        await runVideoJob(job, worker)
        const status = await finishJob(job.id, worker, 'done')
        results.push({ jobId: job.id, status })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur pipeline'
        try {
          const status = await finishJob(job.id, worker, 'queued', message)
          results.push({ jobId: job.id, status, error: message })
        } catch (writeError) {
          results.push({ jobId: job.id, status: 'write_unconfirmed', error: String(writeError) })
        }
      }
    }
    const unconfirmed = results.some(r => r.status === 'write_unconfirmed')
    return NextResponse.json({ status: unconfirmed ? 'write_unconfirmed' : 'ok', claimed: jobs.length, results }, { status: unconfirmed ? 503 : 200 })
  } catch (err) {
    return NextResponse.json({ error: String(err), status: 'queue_unavailable' }, { status: 503 })
  }
}
