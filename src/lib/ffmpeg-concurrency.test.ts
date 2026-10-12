import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { acquireFfmpegSlot, getFfmpegConcurrencyState } from './ffmpeg-concurrency.ts'

describe('ffmpeg-concurrency', () => {
  test('limite le nombre de jobs actifs au plafond configure et mes en file les suivants', async () => {
    process.env.FFMPEG_MAX_CONCURRENT_JOBS = '2'
    try {
      const release1 = await acquireFfmpegSlot()
      const release2 = await acquireFfmpegSlot()
      assert.equal(getFfmpegConcurrencyState().active, 2)

      let thirdAcquired = false
      const third = acquireFfmpegSlot().then((release) => {
        thirdAcquired = true
        return release
      })

      await new Promise((r) => setTimeout(r, 20))
      assert.equal(thirdAcquired, false, 'le 3e job ne doit pas demarrer tant quun slot n est pas libere')
      assert.equal(getFfmpegConcurrencyState().waiting, 1)

      release1()
      const release3 = await third
      assert.equal(thirdAcquired, true)
      assert.equal(getFfmpegConcurrencyState().active, 2)

      release2()
      release3()
      assert.equal(getFfmpegConcurrencyState().active, 0)
    } finally {
      delete process.env.FFMPEG_MAX_CONCURRENT_JOBS
    }
  })

  test('appeler release() deux fois ne decremente pas deux fois le compteur actif', async () => {
    process.env.FFMPEG_MAX_CONCURRENT_JOBS = '3'
    try {
      const release = await acquireFfmpegSlot()
      const before = getFfmpegConcurrencyState().active
      release()
      release()
      assert.equal(getFfmpegConcurrencyState().active, before - 1)
    } finally {
      delete process.env.FFMPEG_MAX_CONCURRENT_JOBS
    }
  })
})
