import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, webkit } from '@playwright/test'
import { classifyRuntimeErrors } from './runtime-guard.mjs'
import { nativeRuntimeControls } from './native-controls.mjs'

const base = 'https://127.0.0.1:1234'
const seed = () => ({ engine: 'webkit', nativeControl: { caughtUnloadDiagnostic: true },
  errors: [{ kind: 'pageerror', navigation: 1, at: 120, message: 'engine diagnostic', stack: `Fetch API cannot load ${base}/slow due to access control checks.\n    at unknown (${base}/caught:1:1)` }],
  events: [{ kind: 'unload-fetch', navigation: 1, document: base + '/caught', url: base + '/slow', at: 119 }],
  navigations: [{ id: 1, from: base + '/caught', to: base + '/next', startedAt: 100, finishedAt: 125 }], domErrors: [] })

test('exact native teardown control is qualified and raw error retained', () => {
  const result = classifyRuntimeErrors(seed())
  assert.equal(result.qualified.length, 1); assert.equal(result.errors.length, 1); assert.equal(result.unexpected.length, 0)
})
for (const [name, mutate] of [
  ['other engine', state => { state.engine = 'chromium' }],
  ['missing native reproduction', state => { state.nativeControl.caughtUnloadDiagnostic = false }],
  ['ordinary load error', state => { state.errors[0].stack = 'TypeError: Load failed' }],
  ['hydration', state => { state.errors[0].kind = 'hydration' }],
  ['no teardown fetch', state => { state.events = [] }],
  ['different document', state => { state.events[0].document = base + '/wrong' }],
  ['client navigation', state => { state.navigations = [] }],
  ['cross-origin resource', state => { state.errors[0].stack = 'Fetch API cannot load https://elsewhere.invalid/slow due to access control checks.' }],
  ['delayed error', state => { state.errors[0].at = 10000 }],
  ['real DOM exception during teardown', state => { state.domErrors.push({ navigation: 1, at: 120, message: 'real error' }) }],
]) test(`fail closed: ${name}`, () => {
  const state = seed(); mutate(state)
  assert.ok(classifyRuntimeErrors(state).unexpected.length > 0)
})
for (const [engine, type] of Object.entries({ chromium, webkit })) test(`${engine}: real native HTML controls without SUTRA or build`, async () => {
  const browser = await type.launch({ headless: true })
  try {
    const result = await nativeRuntimeControls(browser)
    await mkdir('qa/t01-final-20261015/browser-harness/results', { recursive: true })
    await writeFile(`qa/t01-final-20261015/browser-harness/results/native-${engine}.json`, JSON.stringify(result, null, 2) + '\n')
    assert.equal(result.negativeControls.realExceptionDetected, true)
    assert.equal(result.negativeControls.unhandledRejectionDetected, true)
  } finally { await browser.close() }
})
