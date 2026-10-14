import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { getPollinationsUrl, type VideoFormat } from '../src/lib/storyboard.ts'

// URL construction and route contract only: never request a generative image URL.
let authenticated = true
const forbidden = () => { throw new Error('UNEXPECTED_SIDE_EFFECT') }
globalThis.fetch = async () => forbidden()
mock.module('../src/lib/supabase-server.ts', { namedExports: {
  createServerClient: async () => ({ auth: { getUser: async () => ({
    data: { user: authenticated ? { id: 'fixture-user' } : null }, error: null,
  }) } }),
} })
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: forbidden } })
mock.module('../src/lib/pipeline-submit.ts', { namedExports: {
  submissionIdentity: forbidden, submitVideoJob: forbidden, submissionErrorStatus: () => 500,
} })
mock.module('../src/lib/video-worker.ts', { namedExports: { runVideoJob: forbidden } })
mock.module('../src/lib/video-queue.ts', { namedExports: {
  completeQuotaForFinishedJob: forbidden, claimJobByKey: forbidden, cancelJobByKey: forbidden, finishJob: forbidden,
} })
mock.module('../src/lib/ltx-utils.ts', { namedExports: { clampQualityToPlan: forbidden } })
mock.module('../src/lib/local-engine.ts', { namedExports: { shouldUseLocalEngine: forbidden } })
mock.module('../src/lib/salad/application.ts', { namedExports: { saladApplicationConfig: forbidden } })
mock.module('../src/lib/salad/config.ts', { namedExports: { requireActive: forbidden } })
const { POST } = await import('../src/app/api/production/route.ts')
const formats: VideoFormat[] = ['16:9', '9:16', '1:1']
const prompt = 'fixture / été ?nofeed=false&model=other # fragment'
const request = (body: unknown) => new Request('https://app.invalid/api/production', {
  method: 'POST', body: JSON.stringify(body),
})
function check(value: string, text: string, format: VideoFormat) {
  const url = new URL(value)
  assert.equal(url.origin, 'https://image.pollinations.ai')
  assert.equal(decodeURIComponent(url.pathname.slice('/prompt/'.length)), text)
  assert.equal(url.hash, '')
  assert.equal(url.searchParams.get('nofeed'), 'true')
  assert.deepEqual([...url.searchParams.keys()].sort(), ['height', 'nofeed', 'width'])
  const width = Number(url.searchParams.get('width')), height = Number(url.searchParams.get('height'))
  assert.ok(width > 0 && height > 0 && width * height <= 768 * 768)
  assert.equal(width / height, format === '16:9' ? 16 / 9 : format === '9:16' ? 9 / 16 : 1)
}
test('Pollinations helper preserves ratios and encoding, excludes public feed and unsupported options', () => {
  for (const format of formats) check(getPollinationsUrl(prompt, format), prompt, format)
})
test('production thumbnail uses the same Classic contract without provider, quota or worker calls', async () => {
  authenticated = true
  for (const format of formats) {
    const response = await POST(request({ step: 'thumbnail', idea: 'fixture', format,
      previousData: { script: { scenes: [], thumbnail_prompt: prompt } } }))
    assert.equal(response.status, 200)
    const { data } = await response.json()
    check(data.url, prompt, format)
    assert.equal(data.url, getPollinationsUrl(prompt, format))
  }
  const response = await POST(request({ step: 'thumbnail', idea: 'fixture' }))
  check((await response.json()).data.url, 'cinematic thumbnail for fixture', '16:9')
})
test('thumbnail retains authentication and format validation before constructing URL', async () => {
  authenticated = false
  assert.equal((await POST(request({ step: 'thumbnail', idea: 'fixture' }))).status, 401)
  authenticated = true
  assert.equal((await POST(request({ step: 'thumbnail', idea: 'fixture', format: '4:3' }))).status, 400)
})
