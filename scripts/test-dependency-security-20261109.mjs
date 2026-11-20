#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readdir as nativeReaddir } from 'node:fs'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { setImmediate as nextTurn } from 'node:timers/promises'
import test from 'node:test'
import { globFiles } from '@sentry/bundler-plugins/core'
import { z } from 'zod'

// Resolve the dependency from Sentry itself, even if npm stops hoisting it.
// These tests exercise real modules and real files, without initializing Sentry.
const sentryRequire = createRequire(import.meta.resolve('@sentry/bundler-plugins/core'))
const { glob } = sentryRequire('glob')

async function fixture(t, paths) {
  const root = await mkdtemp(join(tmpdir(), 'sutra-dependency-security-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const path of paths) {
    const file = join(root, path)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, 'fixture\n')
  }
  return root
}

test('Sentry globFiles preserves absolute files, brace patterns, nodir and ignore', async (t) => {
  const root = await fixture(t, [
    'build/main.js',
    'build/main.js.map',
    'build/nested/worker.cjs',
    'build/nested/worker.cjs.map',
    'build/ignored/private.js.map',
    'build/looks-like.js.map/child.txt',
    'build/.hidden.js.map',
    'build/image.png',
  ])
  const files = await globFiles(join(root, 'build/**/*.{js,cjs,js.map,cjs.map}'), {
    ignore: join(root, 'build/ignored/**'),
  })
  assert.deepEqual(files.sort(), [
    'build/main.js', 'build/main.js.map', 'build/nested/worker.cjs', 'build/nested/worker.cjs.map',
  ].map(path => join(root, path)).sort())
  assert.ok(files.every(isAbsolute), 'Sentry upload paths must remain absolute')
  for (const file of files) assert.ok((await stat(file)).isFile(), 'Directories are not upload assets')
})

test('Sentry globFiles accepts overlapping pattern arrays, ignores and empty matches', async (t) => {
  const root = await fixture(t, ['chunk one.js', 'chunk one.js.map', 'nested/chunk two.js.map'])
  const files = await globFiles([
    join(root, '**/*.js.map'),
    join(root, 'chunk one.js.map'),
    join(root, 'chunk one.js'),
  ], { ignore: [join(root, 'nested/**')] })
  assert.deepEqual(files.sort(), [join(root, 'chunk one.js'), join(root, 'chunk one.js.map')].sort())
  assert.deepEqual(await globFiles(join(root, '**/*.does-not-exist')), [])
})

test('Sentry-resolved glob stops reading directories after AbortSignal cancellation', { timeout: 5000 }, async (t) => {
  const root = await fixture(t, Array.from({ length: 8 }, (_, index) => `branch-${index}/deep/file.js.map`))
  const controller = new AbortController()
  const reason = new Error('SUTRA_TEST_TRAVERSAL_CANCELLED')
  let reads = 0
  let readsAfterAbort = 0
  let pendingReads = 0
  let resolveIdle

  // Instrument the supported filesystem adapter while delegating every read to
  // node:fs. Abort as the first real directory read completes, before recursion.
  const trackedFs = {
    readdir(path, options, callback) {
      reads += 1
      if (controller.signal.aborted) readsAfterAbort += 1
      pendingReads += 1
      nativeReaddir(path, options, (error, entries) => {
        try {
          if (!controller.signal.aborted) controller.abort(reason)
          callback(error, entries)
        } finally {
          pendingReads -= 1
          if (pendingReads === 0) resolveIdle?.()
        }
      })
    },
  }

  await assert.rejects(glob('**/*', {
    cwd: root, nodir: true, signal: controller.signal, fs: trackedFs,
  }), error => error === reason)
  // The vulnerable walker rejects while more reads continue in the background.
  // Drain actual callbacks, then one event-loop turn; do not rely on a sleep.
  if (pendingReads !== 0) await new Promise(resolve => { resolveIdle = resolve })
  await nextTurn()
  assert.ok(reads >= 1, 'The cancellation fixture must exercise a real directory read')
  assert.equal(pendingReads, 0, 'No filesystem reads may remain in flight')
  assert.equal(readsAfterAbort, 0, 'An aborted traversal must not start additional directory reads')
  t.diagnostic(`directory reads=${reads}; reads after abort=${readsAfterAbort}`)
})

test('Zod array max rejects oversized input before invoking sync or async item parsers', async (t) => {
  let syncItems = 0
  const syncSchema = z.array(z.preprocess(value => {
    syncItems += 1
    return value
  }, z.object({ id: z.string() }))).max(3)
  const oversized = Array.from({ length: 128 }, () => ({ id: 'fixture' }))
  const result = syncSchema.safeParse(oversized)
  assert.equal(result.success, false)
  assert.ok(result.error.issues.some(issue => issue.code === 'too_big' && issue.maximum === 3))
  assert.equal(syncItems, 0, 'Array limits must precede potentially expensive element parsing')

  let asyncItems = 0
  const asyncSchema = z.array(z.string().transform(async value => {
    asyncItems += 1
    return value.toUpperCase()
  })).max(3)
  const asyncResult = await asyncSchema.safeParseAsync(Array(128).fill('fixture'))
  assert.equal(asyncResult.success, false)
  assert.ok(asyncResult.error.issues.some(issue => issue.code === 'too_big'))
  assert.equal(asyncItems, 0, 'Oversized arrays must not start asynchronous element work')
  t.diagnostic(`oversized array item parsers: sync=${syncItems}; async=${asyncItems}`)
})

test('Zod array bounds preserve accepted transforms and element validation', async () => {
  const schema = z.array(z.string().min(1).transform(value => value.toUpperCase())).max(3)
  assert.deepEqual(schema.parse(['one', 'two', 'three']), ['ONE', 'TWO', 'THREE'])
  assert.deepEqual(await schema.parseAsync(['one']), ['ONE'])
  assert.deepEqual(schema.parse([]), [])
  const invalid = schema.safeParse(['valid', 42])
  assert.equal(invalid.success, false)
  assert.ok(invalid.error.issues.some(issue => issue.code === 'invalid_type' && issue.path[0] === 1))
})
