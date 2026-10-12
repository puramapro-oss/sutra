// .mts + import dynamique APRES les env vars : en ESM les import statiques
// sont hoistes avant tout code, meme ecrit plus haut textuellement — le
// chargement de video-compositor.ts (-> storage.ts -> supabase.ts) crashe
// sinon a l'import si les env vars Supabase ne sont pas deja definies
// (meme piege que test-shotstack-contracts.mts).
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test-ref.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'

import { test, describe } from 'node:test'
import { simulatedValidation } from '../../scripts/helpers/media-validation-fixture.ts'
import assert from 'node:assert/strict'
const { composeVideoWithFallback } = await import('./video-compositor.ts')
const { FfmpegCompositorError } = await import('./ffmpeg-compositor.ts')
type VideoCompositionJob = Parameters<typeof composeVideoWithFallback>[0]

function baseJob(overrides: Partial<VideoCompositionJob> = {}): VideoCompositionJob {
  return {
    clips: [{ url: 'https://x/clip0.mp4', type: 'ia', durationSeconds: 5 }],
    voiceUrl: 'https://x/voice.mp3',
    musicUrl: null,
    subtitles: [],
    format: '16:9',
    quality: '1080p',
    ...overrides,
  }
}

describe('composeVideoWithFallback', () => {
  test('moteur FFmpeg primaire : succes sans jamais appeler Shotstack', async () => {
    let shotstackCalled = false
    const result = await composeVideoWithFallback(baseJob(), {
      compose: async () => ({ buffer: Buffer.from('mp4'), durationSeconds: 5, resolution: '1920x1080', validation: simulatedValidation(baseJob()) }),
      assemble: async () => {
        shotstackCalled = true
        return { url: 'https://cdn/should-not-happen.mp4', timeline: {}, duration: 0, outputVerified: false, outputQuality: 'hd', outputSize: { width: 0, height: 0 } }
      },
      upload: async (filename: string) => `https://cdn/${filename}`,
    })
    assert.equal(result.engine, 'ffmpeg')
    assert.equal(shotstackCalled, false)
    assert.equal(result.durationSeconds, 5)
    assert.match(result.url, /^https:\/\/cdn\/compositions\//)
  })

  test('secours Shotstack si FFmpeg local indisponible (erreur non-validation)', async () => {
    const result = await composeVideoWithFallback(baseJob(), {
      compose: async () => {
        throw new Error('ffmpeg binaire absent')
      },
      assemble: async () => ({
        url: 'https://cdn/shotstack-out.mp4',
        timeline: { tracks: [] },
        duration: 5,
        validation: simulatedValidation(baseJob()),
        outputVerified: false, outputQuality: 'hd',
        outputSize: { width: 1920, height: 1080 },
      }),
      upload: async (filename: string) => `https://cdn/${filename}`,
    })
    assert.equal(result.engine, 'shotstack')
    assert.equal(result.url, 'https://cdn/shotstack-out.mp4')
    assert.equal(result.durationSeconds, 5)
  })

  test('erreur de validation (clip invalide) propagee directement, jamais de secours Shotstack couteux', async () => {
    let shotstackCalled = false
    await assert.rejects(
      composeVideoWithFallback(baseJob(), {
        compose: async () => {
          throw new FfmpegCompositorError('duree de clip invalide', 'validation')
        },
        assemble: async () => {
          shotstackCalled = true
          return { url: 'x', timeline: {}, duration: 0, outputVerified: false, outputQuality: 'hd', outputSize: { width: 0, height: 0 } }
        },
        upload: async (filename: string) => `https://cdn/${filename}`,
      }),
      /duree de clip invalide/
    )
    assert.equal(shotstackCalled, false)
  })
})
