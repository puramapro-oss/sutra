#!/usr/bin/env node
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')

test('WAN preserves landscape, portrait and square formats', () => {
  const source = read('src/lib/wan.ts')
  assert.match(source, /'16:9': \{ width:/)
  assert.match(source, /'9:16': \{ width:/)
  assert.match(source, /'1:1': \{ width:/)
  assert.match(source, /native4k: width >= 3840 && height >= 2160/)
})

test('Pexels uses the current video endpoint and keeps provenance', () => {
  const source = read('src/lib/pexels.ts')
  assert.match(source, /api\.pexels\.com\/v1\/videos\/search/)
  assert.match(source, /sourcePage:/)
  assert.match(source, /authorUrl:/)
})

test('fallbacks preserve requested format', () => {
  const ltx = read('src/lib/ltx.ts')
  const fallback = read('src/lib/fallbacks.ts')
  assert.match(ltx, /fallback_would_lose_constraints/)
  assert.match(ltx, /format,\n\s+duration,/)
  assert.match(fallback, /searchVideos\(prompt, 3, \{ format: stockFormat \}\)/)
})

test('cost estimates include quality and duration', () => {
  const source = read('src/lib/ltx-utils.ts')
  assert.match(source, /quality: VideoQuality/)
  assert.match(source, /rate \* safeDuration/)
  assert.match(source, /'4k': 0\.32/)
  assert.match(source, /'4k': 0\.24/)
})

test('AI outputs are schema validated before use', () => {
  const script = read('src/lib/claude.ts')
  const auto = read('src/lib/sutra-auto.ts')
  assert.match(script, /scriptDataSchema\.safeParse/)
  assert.match(auto, /videoPlanSchema\.safeParse/)
})

test('stock search includes cached Pixabay and Pexels sources', () => {
  const source = read('src/lib/stock.ts')
  assert.match(source, /pixabay\.com\/api\/videos/)
  assert.match(source, /api\.pexels\.com\/v1\/videos\/search/)
  assert.match(source, /revalidate: 86_400/)
})
