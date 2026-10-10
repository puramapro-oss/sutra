// Personal video route only. Customer requests must never use the owner's worker.
// No configuration, worker failure, legacy auto mode: fail closed, no paid fallback.
// Script, music, voice and final assembly need their own complete local workflow.
import { isSuperAdmin } from '@/lib/utils'
import { logVideoGeneration } from './ltx-helpers'
import { getWanDimensions } from './wan'
import { assertMediaProbeAvailable, verifyVideoBytes } from './media-probe'
import type { LtxResult } from './ltx-types'
import type { Plan } from '@/types'

export type LocalEngineMode = 'strict' | 'auto'
const MAX_BYTES = 64 * 1024 * 1024
function localUrl(): URL {
  const raw = process.env.LOCAL_VIDEO_API_URL?.trim()
  if (process.env.LOCAL_ENGINE_ENABLED !== 'true' || !raw) throw new Error('SUTRA_LOCAL_NOT_CONFIGURED')
  const url = new URL(raw)
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('SUTRA_LOCAL_INVALID_URL')
  return url
}
export function isLocalEngineConfigured(): boolean {
  try { localUrl(); return true } catch { return false }
}
/** Legacy auto configuration cannot override the owner's zero-paid-fallback rule. */
export function localEngineMode(): LocalEngineMode { return 'strict' }
/** Identity must come from the authenticated server context, not the request body. */
export function shouldUseLocalEngine(userEmail: string | null): boolean {
  return Boolean(userEmail?.trim()) && isSuperAdmin(userEmail?.trim().toLowerCase())
}

interface LocalGenerateParams { prompt:string; width:number; height:number; duration:number; fps?:number }
async function readBounded(res: Response, max: number, signal: AbortSignal): Promise<Buffer> {
  const length=res.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length)>max)) {
    await res.body?.cancel()
    throw new Error('SUTRA_LOCAL_RESPONSE_TOO_LARGE')
  }
  if (!res.body) throw new Error('SUTRA_LOCAL_EMPTY_RESPONSE')
  const reader=res.body.getReader()
  const chunks:Uint8Array[]=[]
  let total=0
  try {
    while (true) {
      signal.throwIfAborted()
      const {done,value}=await reader.read()
      if (done) break
      total+=value.byteLength
      if (total>max) throw new Error('SUTRA_LOCAL_RESPONSE_TOO_LARGE')
      chunks.push(value)
    }
    return Buffer.concat(chunks,total)
  } catch (error) { await reader.cancel().catch(()=>{}); throw error }
  finally { reader.releaseLock() }
}

export async function generateLocalVideo(params: LocalGenerateParams): Promise<LtxResult> {
  const url=localUrl()
  const fps=params.fps ?? 16
  if (!params.prompt.trim() || params.prompt.length>20000
      || ![params.width,params.height].every(n=>Number.isInteger(n)&&n>=16&&n<=8192&&n%2===0)
      || !Number.isFinite(params.duration) || params.duration<=0 || params.duration>60
      || !Number.isFinite(fps) || fps<1 || fps>60) throw new Error('SUTRA_LOCAL_INVALID_REQUEST')
  await assertMediaProbeAvailable()
  const signal=AbortSignal.timeout(600_000)
  const res=await fetch(url.href, {method:'POST',headers:{'Content-Type':'application/json'},redirect:'error',signal,
    body:JSON.stringify({prompt:params.prompt,width:params.width,height:params.height,num_frames:Math.round(params.duration*fps),fps})})
  if (!res.ok) { await res.body?.cancel(); throw new Error(`SUTRA_LOCAL_HTTP_${res.status}`) }
  const data=JSON.parse((await readBounded(res,Math.ceil(MAX_BYTES*4/3)+8192,signal)).toString('utf8')) as {video_base64?:unknown;video_url?:unknown}
  if (!data || Boolean(data.video_base64)===Boolean(data.video_url)) throw new Error('SUTRA_LOCAL_INVALID_RESPONSE')
  let bytes:Buffer
  if (data.video_base64) {
    const encoded=data.video_base64
    if (typeof encoded!=='string' || encoded.length>Math.ceil(MAX_BYTES/3)*4 || encoded.length%4!==0
        || /[^A-Za-z0-9+/=]/.test(encoded)) throw new Error('SUTRA_LOCAL_INVALID_BASE64')
    bytes=Buffer.from(encoded,'base64')
    if (!bytes.length || bytes.length>MAX_BYTES || bytes.toString('base64')!==encoded) throw new Error('SUTRA_LOCAL_INVALID_BASE64')
  } else {
    if (typeof data.video_url!=='string') throw new Error('SUTRA_LOCAL_INVALID_VIDEO_URL')
    const fileUrl=new URL(data.video_url,url)
    if (fileUrl.origin!==url.origin || fileUrl.username || fileUrl.password || fileUrl.hash) throw new Error('SUTRA_LOCAL_FOREIGN_VIDEO_URL')
    const downloadSignal=AbortSignal.any([signal,AbortSignal.timeout(60_000)])
    const file=await fetch(fileUrl.href,{redirect:'error',signal:downloadSignal})
    if (!file.ok) { await file.body?.cancel(); throw new Error(`SUTRA_LOCAL_FILE_HTTP_${file.status}`) }
    bytes=await readBounded(file,MAX_BYTES,downloadSignal)
  }
  const measured=await verifyVideoBytes(bytes,{width:params.width,height:params.height,duration:params.duration,fps})
  const videoBuffer=new Uint8Array(bytes).buffer
  return {videoBuffer,engine:'wan-classic',model:'local-m4max',duration:measured.duration,resolution:`${measured.width}x${measured.height}`}
}

export async function probeLocalEngine(): Promise<{ok:boolean;detail?:string}> {
  if (!isLocalEngineConfigured()) return {ok:false,detail:'non configure'}
  try {
    const url=localUrl()
    url.pathname=`${url.pathname.replace(/\/$/,'')}/health`
    const res=await fetch(url.href,{redirect:'error',signal:AbortSignal.timeout(3000)})
    const ok=res.ok
    await res.body?.cancel()
    return {ok,detail:ok?undefined:`HTTP ${res.status}`}
  } catch { return {ok:false,detail:'connexion impossible'} }
}

export async function tryLocalRoute(params: {
  prompt:string; plan:Plan; quality:string; format?:string; duration?:number;
  userEmail?:string|null; userId?:string; videoId?:string
}): Promise<LtxResult|null> {
  if (!shouldUseLocalEngine(params.userEmail ?? null)) return null
  // A missing/disabled worker is NOT permission to call a paid provider.
  if (!isLocalEngineConfigured()) throw new Error('SUTRA_LOCAL_NOT_CONFIGURED: aucun repli payant autorise')
  const format=params.format ?? '16:9'
  const quality=params.quality.trim().toLowerCase()==='uhd'?'4k':params.quality.trim().toLowerCase()
  if (!['9:16','16:9','1:1'].includes(format) || !['720p','1080p','4k'].includes(quality)) throw new Error('SUTRA_LOCAL_UNSUPPORTED_FORMAT_OR_QUALITY')
  const dims=getWanDimensions(quality as '720p'|'1080p'|'4k',format as '9:16'|'16:9'|'1:1')
  const start=Date.now()
  const track={userId:params.userId??null,videoId:params.videoId??null,plan:params.plan,engineRequested:'wan-classic' as const,modelRequested:'wan-2.2' as const,engineUsed:'local' as const,modelUsed:'local-m4max',fallbackTriggered:false}
  let result:LtxResult
  try { result=await generateLocalVideo({prompt:params.prompt,width:dims.width,height:dims.height,duration:params.duration??6}) }
  catch {
    await logVideoGeneration({...track,fallbackReason:'local_strict_failure',durationMs:Date.now()-start,success:false,errorMessage:'SUTRA_LOCAL_FAILED'}).catch(()=>{})
    throw new Error('SUTRA_LOCAL_FAILED: moteur local indisponible ou fichier invalide; aucun repli payant autorise')
  }
  // Observability must not invalidate a completed render and cause regeneration.
  await logVideoGeneration({...track,fallbackReason:null,durationMs:Date.now()-start,success:true,errorMessage:null}).catch(()=>{})
  return result
}
