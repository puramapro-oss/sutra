import { composeVideoWithFallback } from './video-compositor'
import { shotstackContract } from './shotstack-timeline'
import { compositionPlan } from './composition-contract'
import type { AssembleParams, AssembleResult } from './shotstack'

/** One composition contract; a resumed remote ID bypasses local rendering. */
export async function assembleFinalVideo(params: AssembleParams): Promise<AssembleResult> {
  const contract = shotstackContract(params)
  const plan = compositionPlan(contract)
  const result = await composeVideoWithFallback({ ...contract,
    clips: params.clips.map(c => ({ ...c, durationSeconds: c.duration })),
    format: params.format as '16:9' | '9:16' | '1:1',
    quality: params.quality as '720p' | '1080p' | '4k',
    transitions: ['fade', 'crossfade', 'fondu'].includes(params.transitions) ? 'fade' : 'none',
    subtitles: params.subtitles, renderJob: params.renderJob, signal: params.signal,
  })
  return { url: result.url, duration: result.durationSeconds,
    outputQuality: params.quality === '4k' ? '4k' : params.quality === '1080p' ? '1080' : 'hd',
    outputSize: { width: plan.width, height: plan.height }, outputVerified: false,
    contract, validation: result.validation, timeline: { ...(result.timeline ?? { engine: result.engine }), sutraEditorClips: params.clips } }
}
