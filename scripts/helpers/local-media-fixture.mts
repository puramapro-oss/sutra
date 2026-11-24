// Test-only transport for synthetic loopback assets; production download policy stays strict.
import { mock } from 'node:test'
async function download(url: string, options: { signal?: AbortSignal; maxBytes?: number } = {}) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1') throw new Error('FIXTURE_LOOPBACK_REQUIRED')
  const response = await fetch(parsed, { signal: options.signal, redirect: 'error' })
  if (!response.ok) throw new Error('FIXTURE_HTTP_ERROR')
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > (options.maxBytes ?? 64 * 1024 * 1024)) throw new Error('FIXTURE_TOO_LARGE')
  return bytes
}
mock.module('../../src/lib/media-download.ts', { namedExports: { downloadMediaBytes: download, downloadVideoBytes: download } })
