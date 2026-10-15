import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { chromium, webkit } from '@playwright/test'
import { classifyRuntimeErrors } from './runtime-guard.mjs'
import { nativeRuntimeControls } from './native-controls.mjs'

const output = await mkdtemp('qa/t01-final-20261015/browser-harness/profile-head-guard-results-')
const base = 'https://127.0.0.1:1234'
const seed = () => ({ engine: 'webkit', nativeControl: { caughtUnloadDiagnostic: true },
  errors: [{ kind: 'pageerror', navigation: 1, at: 120, message: 'engine diagnostic', stack: `Fetch API cannot load ${base}/slow due to access control checks.\n    at unknown (${base}/caught:1:1)` }],
  events: [{ kind: 'unload-fetch', navigation: 1, document: base + '/caught', url: base + '/slow', at: 119 }],
  navigations: [{ id: 1, method: 'goto', from: base + '/caught', to: base + '/next', startedAt: 100, finishedAt: 125 }], domErrors: [] })

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
  ['unobserved method', state => { state.navigations[0].method = 'click' }],
  ['client navigation', state => { state.navigations = [] }],
  ['cross-origin resource', state => { state.errors[0].stack = 'Fetch API cannot load https://elsewhere.invalid/slow due to access control checks.' }],
  ['delayed error', state => { state.errors[0].at = 10000 }],
  ['real DOM exception during teardown', state => { state.domErrors.push({ navigation: 1, at: 120, message: 'real error' }) }],
]) test(`fail closed: ${name}`, () => {
  const state = seed(); mutate(state)
  assert.ok(classifyRuntimeErrors(state).unexpected.length > 0)
})
for (const method of ['goto', 'reload']) test(`exact Next RSC request during ${method} is qualified`, () => {
  const state = seed(); state.navigations[0].method = method
  state.errors[0].stack = `Fetch API cannot load ${base}/slow?_rsc=fixture_token due to access control checks.`
  state.events[0].url += '?_rsc=fixture_token'
  assert.equal(classifyRuntimeErrors(state).qualified.length, 1)
  state.events[0].url = base + '/slow?_rsc=different'
  assert.equal(classifyRuntimeErrors(state).qualified.length, 0)
})
for (const query of ['?token=private', '?_rsc=valid&token=private', '?_rsc=one&_rsc=two', '?_rsc=', '?_rsc=bad%20value', '#fragment']) test(`fail closed: unsupported query ${query}`, () => {
  const state = seed()
  state.errors[0].stack = `Fetch API cannot load ${base}/slow${query} due to access control checks.`
  state.events[0].url += query
  assert.equal(classifyRuntimeErrors(state).qualified.length, 0)
})
const syntheticSeed = () => {
  const state = seed(), origin = 'https://127.0.0.1:5678'
  state.fixtureOrigin = origin
  state.nativeControl.crossOriginCaughtUnloadDiagnostic = true
  state.events[0].method = 'GET'
  state.events[0].url = origin + '/rest/v1/affirmations?select=*&category=eq.abundance'
  state.errors[0].stack = `Fetch API cannot load ${state.events[0].url} due to access control checks.`
  return state
}
for (const method of ['goto', 'reload']) for (const category of ['abundance', 'power', 'wisdom']) test(`synthetic cross-origin ${method}/${category} needs exact observed GET`, () => {
  const state = syntheticSeed(); state.navigations[0].method = method
  state.events[0].url = state.events[0].url.replace('abundance', category)
  state.errors[0].stack = `Fetch API cannot load ${state.events[0].url} due to access control checks.`
  const result = classifyRuntimeErrors(state)
  assert.equal(result.qualified.length, 1); assert.equal(result.errors.length, 1); assert.equal(result.unexpected.length, 0)
})
for (const [name, mutate] of [
  ['native proof missing', state => { state.nativeControl.crossOriginCaughtUnloadDiagnostic = false }],
  ['fixture absent', state => { delete state.fixtureOrigin }],
  ['wrong fixture', state => { state.fixtureOrigin = 'https://127.0.0.1:4321' }],
  ['production fixture', state => { state.fixtureOrigin = 'https://provider.invalid' }],
  ['non-GET', state => { state.events[0].method = 'POST' }],
  ['unobserved method', state => { delete state.events[0].method }],
  ['unobserved request', state => { state.events = [] }],
  ['different query', state => { state.events[0].url = state.events[0].url.replace('abundance', 'power') }],
  ['navigation to another origin', state => { state.navigations[0].to = 'https://other.invalid/next' }],
  ['real DOM CORS failure', state => { state.domErrors.push({ navigation: 1, at: 120, message: 'TypeError: Load failed' }) }],
]) test(`cross-origin fail closed: ${name}`, () => {
  const state = syntheticSeed(); mutate(state)
  assert.ok(classifyRuntimeErrors(state).unexpected.length > 0)
})
for (const url of [
  'http://127.0.0.1:5678/rest/v1/affirmations?select=*&category=eq.abundance',
  'https://fixture.invalid/rest/v1/affirmations?select=*&category=eq.abundance',
  'https://127.0.0.1:5678/rest/v1/affirmations?select=*&category=eq.unknown',
  'https://127.0.0.1:5678/rest/v1/affirmations?select=*&category=eq.abundance&token=private',
  'https://127.0.0.1:5678/rest/v1/other?select=*&category=eq.abundance',
  'https://fixture:private@127.0.0.1:5678/rest/v1/affirmations?select=*&category=eq.abundance',
  'https://127.0.0.1:5678/rest/v1/affirmations?select=*&category=eq.abundance#fragment',
]) test(`cross-origin fail closed: unsupported synthetic URL ${url}`, () => {
  const state = syntheticSeed(); state.events[0].url = url
  state.errors[0].stack = `Fetch API cannot load ${url} due to access control checks.`
  assert.equal(classifyRuntimeErrors(state).qualified.length, 0)
})
const profileSeed = () => {
  const state = syntheticSeed()
  state.nativeControl.crossOriginProfileCaughtUnloadDiagnostic = true
  state.events[0].url = state.fixtureOrigin + '/rest/v1/profiles?select=*&id=eq.11111111-1111-4111-8111-111111111111'
  state.errors[0].stack = `Fetch API cannot load ${state.events[0].url} due to access control checks.`
  return state
}
for (const method of ['goto', 'reload']) test(`exact synthetic profile ${method} needs resource-specific native proof`, () => {
  const state = profileSeed(); state.navigations[0].method = method
  assert.equal(classifyRuntimeErrors(state).qualified.length, 1)
  state.nativeControl.crossOriginProfileCaughtUnloadDiagnostic = false
  assert.equal(classifyRuntimeErrors(state).qualified.length, 0)
})
for (const suffix of [
  '?select=*&id=eq.22222222-2222-4222-8222-222222222222',
  '?select=*&id=eq.11111111-1111-4111-8111-111111111111&token=private',
  '?select=*&id=eq.11111111-1111-4111-8111-111111111111#fragment',
  '?select=*', '',
]) test(`unknown profile query fails closed: ${suffix}`, () => {
  const state = profileSeed()
  state.events[0].url = state.fixtureOrigin + '/rest/v1/profiles' + suffix
  state.errors[0].stack = `Fetch API cannot load ${state.events[0].url} due to access control checks.`
  assert.equal(classifyRuntimeErrors(state).qualified.length, 0)
})
for (const method of ['HEAD', 'POST', 'PATCH', 'DELETE']) test(`profile ${method} cannot qualify as synthetic GET`, () => {
  const state = profileSeed(); state.events[0].method = method
  assert.equal(classifyRuntimeErrors(state).qualified.length, 0)
})
for (const [engine, type] of Object.entries({ chromium, webkit })) test(`${engine}: real native HTML controls without SUTRA or build`, async () => {
  const browser = await type.launch({ headless: true })
  try {
    const result = await nativeRuntimeControls(browser)
    await writeFile(`${output}/native-${engine}.json`, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' })
    assert.equal(result.negativeControls.realExceptionDetected, true)
    assert.equal(result.negativeControls.unhandledRejectionDetected, true)
    assert.equal(result.crossOrigin.normalCrossOriginRead, 'PASS')
    assert.equal(result.crossOrigin.realCorsDenialDetected, true)
    assert.equal(result.crossOriginProfile.normalCrossOriginRead, 'PASS')
    assert.equal(result.crossOriginProfile.realCorsDenialDetected, true)
  } finally { await browser.close() }
})
