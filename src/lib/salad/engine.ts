import { assertMediaProbeAvailable, MAX_VIDEO_BYTES, verifyVideoBytes } from '../media-probe'
import { SaladError, inputSchema, sha256, type VideoInput } from './contracts'
import { boundedBytes, boundedJson, type Fetcher } from './http'

/** Reuses POST / and GET /files of scripts/comfyui-engine-server.mjs, inside one remote container.
 * The existing bridge must be PRIVATE; only the authenticated Salad wrapper is exposed.
 * Never import that script (it starts a server), spawn a second engine, or use a Mac URL.
 */
export function createComfyBridge(rawUrl: string, fetcher: Fetcher = fetch) {
  let url: URL
  try { url = new URL(rawUrl) } catch { throw new SaladError('SALAD_INVALID_PRIVATE_BRIDGE') }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password
    || url.search || url.hash || url.pathname !== '/') throw new SaladError('SALAD_INVALID_PRIVATE_BRIDGE')
  async function health(): Promise<boolean> {
    try {
      await assertMediaProbeAvailable()
      const signal = AbortSignal.timeout(3000)
      const response = await fetcher(`${url.origin}/health`, { redirect: 'error', signal })
      if (!response.ok) { await response.body?.cancel(); return false }
      const result = await boundedJson(response, signal)
      return typeof result === 'object' && result !== null && 'ok' in result && result.ok === true
    } catch { return false }
  }
  async function generate(value: VideoInput, timeoutMs: number) {
    const input = inputSchema.parse(value)
    await assertMediaProbeAvailable()
    const signal = AbortSignal.timeout(timeoutMs)
    try {
      const response = await fetcher(url.href, { method: 'POST', redirect: 'error', signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: input.prompt, ...input.profile }) })
      if (!response.ok) { await response.body?.cancel(); throw new SaladError('SALAD_BRIDGE_HTTP') }
      const data = await boundedJson(response, signal)
      // The canonical ComfyUI bridge returns a file path, not inline base64 or an external URL.
      if (!data || typeof data !== 'object' || !('video_url' in data) || typeof data.video_url !== 'string') throw new SaladError('SALAD_BRIDGE_RESPONSE')
      const file = new URL(data.video_url, url)
      if (file.origin !== url.origin || file.pathname !== '/files' || file.username || file.password || file.hash) throw new SaladError('SALAD_BRIDGE_FOREIGN_MEDIA')
      const download = await fetcher(file.href, { redirect: 'error', signal })
      if (!download.ok) { await download.body?.cancel(); throw new SaladError('SALAD_BRIDGE_MEDIA_HTTP') }
      const bytes = await boundedBytes(download, MAX_VIDEO_BYTES, signal)
      await verifyVideoBytes(bytes, { width: input.profile.width, height: input.profile.height,
        duration: input.profile.num_frames / input.profile.fps, fps: input.profile.fps })
      return { bytes, sha256: sha256(bytes) }
    } catch { throw new SaladError('SALAD_COMPUTE_UNCERTAIN') }
  }
  return { health, generate }
}
