import { persistPipelineVideo, pipelineNotification as sendNotification, pipelineActivity as logActivity } from '@/lib/pipeline-state'
import type { createServiceClient } from '@/lib/supabase'
import type { ProductionJobInput } from '@/lib/production-pipeline'
import { sanitizeScriptData, MAX_SCENES } from '@/lib/production-schema'
import type { AssembleClip } from '@/lib/shotstack'
import type { ScriptData } from '@/types'

/** Persistance finale (assembly/all → table videos) + mise en forme réponse,
 *  formes strictement IDENTIQUES aux réponses historiques (contrat client). */
export async function persistProductionResult(
  jobId: string,
  step: string,
  result: unknown,
  stepsDone: Record<string, unknown>,
  input: ProductionJobInput,
  serviceClient: ReturnType<typeof createServiceClient>
): Promise<unknown> {
  // The durable job ID is also the video ID. Replaying persistence cannot
  // duplicate a video or reset one that has since been published.
  const persistVideo = async (values: Record<string, unknown>) => {
    return persistPipelineVideo(serviceClient, 'videos', jobId, values, true)
  }
  if (step === 'assembly') {
    const scriptData = sanitizeScriptData(input.previousData.script)
    const assembled = result as { url: string; videoId: string | null; quality: string; duration: number }
    const videoRow = await persistVideo({
      user_id: input.userId,
      title: scriptData?.title ?? 'Production',
      description: scriptData?.description ?? '',
      video_url: assembled.url,
      shotstack_json: (stepsDone.verified as { timeline?: unknown } | undefined)?.timeline ?? null,
      duration: assembled.duration,
      format: input.format ?? '16:9',
      quality: assembled.quality,
      status: 'ready',
      tags: scriptData?.tags ?? [],
      script_data: scriptData ?? null,
      voice_url: (input.previousData.voice as { url?: string } | undefined)?.url ?? null,
      music_url: (input.previousData.music as { url?: string } | undefined)?.url ?? null,
    })
    await sendNotification(input.userId, {
      type: 'success',
      title: 'Production terminee',
      message: `Ta video "${scriptData?.title ?? 'Production'}" est prete !`,
    })
    return { url: assembled.url, videoId: videoRow.id }
  }

  if (step === 'all') {
    const script = stepsDone.script as ScriptData
    const clips: AssembleClip[] = []
    for (let i = 0; i < MAX_SCENES; i++) {
      const visual = stepsDone[`scene:${i}`] as { url: string; source: string } | undefined
      if (!visual) break
      const scene = script.scenes[i]
      clips.push({
        url: visual.url,
        type: visual.source === 'pexels-stock' ? 'stock' : 'ia',
        kind: 'video',
        duration: Math.max(1, scene?.duration_seconds || 5),
      })
    }
    const assembled = result as { url: string; quality: string; duration: number }
    const voiceUrl = stepsDone.voice_url as string
    const musicUrl = stepsDone.music as string | null
    // Miniature : IMAGE uniquement (jamais un MP4 dans une balise <img>).
    const thumbnailUrl = clips.find((c) => c.kind === 'photo')?.url
      ?? null
    // This label describes the requested renderer preset, not native AI detail.
    const actualQuality = assembled.quality
    await persistVideo({
      user_id: input.userId,
      title: script.title,
      description: script.description,
      video_url: assembled.url,
      shotstack_json: (stepsDone.verified as { timeline?: unknown } | undefined)?.timeline ?? null,
      thumbnail_url: thumbnailUrl,
      duration: assembled.duration,
      format: input.format ?? '16:9',
      quality: actualQuality,
      status: 'ready',
      tags: script.tags,
      script_data: script,
      voice_url: voiceUrl || null,
      music_url: musicUrl || null,
    })
    await logActivity(input.userId, 'production_completed', `Production "${script.title}" terminee`)
    return {
      script,
      video: clips,
      voice: { url: voiceUrl },
      music: { url: musicUrl ?? null },
      assembly: { url: assembled.url },
      thumbnail: { url: thumbnailUrl },
    }
  }

  return result
}
