import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyRuntimeErrors } from '../t01-final-20261015/browser-harness/runtime-guard.mjs'

// Independent negative controls: a native GET reproduction must not hide a
// mutation whose remote outcome is unknown during document teardown.
const origin = 'https://127.0.0.1:1234'
const example = method => ({
  engine: 'webkit', nativeControl: { caughtUnloadDiagnostic: true },
  errors: [{ kind: 'pageerror', navigation: 1, at: 120,
    stack: `Fetch API cannot load ${origin}/api/production due to access control checks.` }],
  events: [{ kind: 'unload-fetch', navigation: 1, document: origin + '/create',
    url: origin + '/api/production', method, at: 119 }],
  navigations: [{ id: 1, method: 'goto', from: origin + '/create', to: origin + '/library',
    startedAt: 100, finishedAt: 125 }], domErrors: [],
})

test('ordinary error without an observed teardown stays visible', () => {
  const state = example('GET')
  state.events = []
  assert.equal(classifyRuntimeErrors(state).unexpected.length, 1)
})

for (const method of ['POST', 'PATCH', 'DELETE', undefined]) {
  test(`native GET evidence cannot qualify same-origin ${method ?? 'unknown method'}`, () => {
    const result = classifyRuntimeErrors(example(method))
    assert.equal(result.qualified.length, 0, 'Mutation or unknown method must retain its failure')
    assert.equal(result.unexpected.length, 1)
  })
}

test('synthetic profile GET requires its resource-specific native proof', () => {
  const state = example('GET')
  state.fixtureOrigin = 'https://127.0.0.1:5678'
  const resource = state.fixtureOrigin + '/rest/v1/profiles?select=*&id=eq.11111111-1111-4111-8111-111111111111'
  state.events[0].url = resource
  state.errors[0].stack = `Fetch API cannot load ${resource} due to access control checks.`
  state.nativeControl.crossOriginCaughtUnloadDiagnostic = true
  assert.equal(classifyRuntimeErrors(state).unexpected.length, 1)
  state.nativeControl.crossOriginProfileCaughtUnloadDiagnostic = true
  assert.equal(classifyRuntimeErrors(state).qualified.length, 1)
  state.events[0].method = 'POST'
  assert.equal(classifyRuntimeErrors(state).unexpected.length, 1)
})
