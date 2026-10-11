// Node worker only: the runtime must provide ffprobe and ffmpeg. No paid service.
import { execFile } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)
export const MAX_VIDEO_BYTES = 64 * 1024 * 1024
export interface ExpectedVideo { width: number; height: number; duration: number; fps?: number; requireAudio?: boolean }
export interface VerifiedVideo { width: number; height: number; duration: number; fps: number; hasAudio: boolean }
let available: Promise<void> | undefined

/** Check before generation; a missing binary is not a successful verification. */
export function assertMediaProbeAvailable(): Promise<void> {
  available ??= Promise.all(['ffprobe','ffmpeg'].map(binary => exec(binary, ['-version'], {timeout:5000,maxBuffer:65536})))
    .then(()=>undefined).catch(()=>{available=undefined;throw new Error('SUTRA_MEDIA_TOOLS_UNAVAILABLE')})
  return available
}
function finitePositive(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value > 0 }
function fpsFrom(value: unknown): number {
  if (typeof value !== 'string') return 0
  const parts = value.split('/').map(Number)
  const fps = parts.length === 2 ? parts[0] / parts[1] : parts[0]
  return finitePositive(fps) ? fps : 0
}

/** Inspects and decodes actual bytes; never supplies a URL or shell command to FFmpeg. */
export async function verifyVideoBytes(bytes: Uint8Array, expected: ExpectedVideo): Promise<VerifiedVideo> {
  if (!bytes.length || bytes.length > MAX_VIDEO_BYTES) throw new Error('SUTRA_MEDIA_INVALID_SIZE')
  if (![expected.width,expected.height].every(v=>Number.isInteger(v)&&v>0&&v<=8192)
      || !finitePositive(expected.duration) || expected.duration > 1200
      || (expected.fps !== undefined && (!finitePositive(expected.fps) || expected.fps > 120))) {
    throw new Error('SUTRA_MEDIA_INVALID_EXPECTATION')
  }
  await assertMediaProbeAvailable()
  const directory = await mkdtemp(join(tmpdir(), 'sutra-verify-'))
  const file = join(directory,'video.mp4')
  try {
    await writeFile(file, bytes, {mode:0o600,flag:'wx'})
    const {stdout} = await exec('ffprobe', ['-v','error','-protocol_whitelist','file,pipe','-format_whitelist','mov','-show_streams','-show_format','-of','json',file], {timeout:15000,maxBuffer:1048576,encoding:'utf8'})
    const info = JSON.parse(stdout) as {
      streams?: Array<{codec_type?:string;width?:number;height?:number;avg_frame_rate?:string;duration?:string;sample_aspect_ratio?:string;disposition?:{attached_pic?:number};side_data_list?:Array<{rotation?:number}>}>
      format?: {duration?:string}
    }
    const videos = info.streams?.filter(s=>s.codec_type==='video' && !s.disposition?.attached_pic) ?? []
    if (videos.length !== 1) throw new Error('SUTRA_MEDIA_VIDEO_STREAM_REQUIRED')
    const video=videos[0]
    const duration=Number(video.duration ?? info.format?.duration)
    const fps=fpsFrom(video.avg_frame_rate)
    const hasAudio=Boolean(info.streams?.some(s=>s.codec_type==='audio'))
    if (video.width!==expected.width || video.height!==expected.height) throw new Error('SUTRA_MEDIA_DIMENSIONS_MISMATCH')
    if (!finitePositive(duration) || !fps || Math.abs(duration-expected.duration)>Math.max(0.1,2/fps)) throw new Error('SUTRA_MEDIA_DURATION_MISMATCH')
    if (expected.fps !== undefined && Math.abs(fps-expected.fps)>0.01) throw new Error('SUTRA_MEDIA_FPS_MISMATCH')
    if (expected.requireAudio && !hasAudio) throw new Error('SUTRA_MEDIA_AUDIO_REQUIRED')
    if (video.sample_aspect_ratio && !['1:1','N/A'].includes(video.sample_aspect_ratio)) throw new Error('SUTRA_MEDIA_NON_SQUARE_PIXELS')
    if (video.side_data_list?.some(s=>s.rotation !== undefined && s.rotation % 360 !== 0)) throw new Error('SUTRA_MEDIA_UNEXPECTED_ROTATION')
    // Fully decode to catch corrupt frames, not just a plausible MP4 header.
    await exec('ffmpeg', ['-v','error','-nostdin','-xerror','-err_detect','explode','-protocol_whitelist','file,pipe','-format_whitelist','mov','-threads','2','-i',file,'-map','0:v:0','-map','0:a?','-threads','2','-f','null','-'], {timeout:60000,maxBuffer:1048576,encoding:'utf8'})
    return {width:video.width,height:video.height,duration,fps,hasAudio}
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('SUTRA_MEDIA_')) throw error
    throw new Error('SUTRA_MEDIA_INVALID_OR_UNDECODABLE')
  } finally { await rm(directory,{recursive:true,force:true}) }
}
