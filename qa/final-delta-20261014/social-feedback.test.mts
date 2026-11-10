import assert from 'node:assert/strict'
import { test, mock, beforeEach, afterEach } from 'node:test'

// Import the actual hook. Instrument its React ports; never extract a source fragment.
let stateWrites: unknown[][] = [], cleanups: Array<() => void> = [], messages: string[] = []
mock.module('react', { namedExports: {
  useCallback: (fn: unknown) => fn,
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => {
    const index = stateWrites.length
    stateWrites.push([])
    return [initial, (value: unknown) => stateWrites[index].push(value)]
  },
  useEffect: (effect: () => (() => void) | undefined) => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup) },
} })
mock.module('sonner', { namedExports: { toast: { error: (message: string) => messages.push(message) } } })
const { useConnectSocialAccount } = await import('../../src/components/settings/social/useConnectSocialAccount.ts')
const originalFetch = globalThis.fetch
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const localId = '33333333-3333-4333-8333-333333333333'
const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  stateWrites = []; cleanups = []; messages = []
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: { location: { href: '/settings/social' } } })
  globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
})
afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  globalThis.fetch = originalFetch
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

for (const [status, expected] of [[409, 'Déconnexion en cours de vérification'], [503, 'Profil social non attribué'], [500, 'Connexion YouTube indisponible']] as const) {
  test(`connect ${status}: actionable safe feedback and retry enabled`, async () => {
    globalThis.fetch = async () => response(status, { error: 'UNTRUSTED_PROVIDER_SECRET' })
    const hook = useConnectSocialAccount(null, { current: null })
    await hook.handleConnect('youtube')
    assert.equal(messages.length, 1)
    assert.ok(messages[0].startsWith(expected), messages[0])
    assert.ok(!messages[0].includes('UNTRUSTED'))
    assert.deepEqual(stateWrites[0], ['youtube', null])
    assert.deepEqual(stateWrites[1], [null, null])
    assert.deepEqual(stateWrites[2], [null, messages[0]])
    assert.equal(hook.connectRequest.current, null, 'failed connection releases the manual retry guard')
    assert.equal(window.location.href, '/settings/social')
  })
}

test('connect success preserves authorized OAuth redirect and duplicate-request guard', async () => {
  let requests = 0
  globalThis.fetch = async () => { requests++; return response(200, { oauthUrl: 'https://consent.example.invalid/authorize' }) }
  const hook = useConnectSocialAccount(null, { current: null })
  await hook.handleConnect('youtube')
  assert.equal(window.location.href, 'https://consent.example.invalid/authorize')
  assert.ok(hook.connectRequest.current instanceof AbortController)
  await hook.handleConnect('youtube')
  assert.equal(requests, 1)
  assert.deepEqual(stateWrites[0], ['youtube'])
  assert.deepEqual(stateWrites[2], [null])
  assert.deepEqual(messages, [])
})

test('reconnect sends the exact local account and releases only its own UI guard', async () => {
  const requests: unknown[] = []
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)))
    return response(503, { error: 'UNTRUSTED_PROVIDER_SECRET' })
  }
  const hook = useConnectSocialAccount(null, { current: null })
  await Promise.all([hook.handleConnect('youtube', localId), hook.handleConnect('youtube')])
  assert.deepEqual(requests, [{ platform: 'youtube', accountId: localId }])
  assert.deepEqual(stateWrites[1], [localId, null])
  await hook.handleConnect('youtube')
  assert.deepEqual(requests[1], { platform: 'youtube' })
})

test('pending revocation blocks a connection without an extra request', async () => {
  const hook = useConnectSocialAccount(null, { current: new AbortController() })
  await hook.handleConnect('youtube', localId)
  assert.equal(hook.connectRequest.current, null)
  assert.deepEqual(stateWrites, [[], [], []])
  assert.deepEqual(messages, [])
})

test('unmount ignores a late OAuth response and cannot redirect a later screen', async () => {
  let resolveFetch!: (response: Response) => void
  let signal: AbortSignal | null | undefined
  globalThis.fetch = async (_input, init) => { signal = init?.signal; return new Promise(resolve => { resolveFetch = resolve }) }
  const hook = useConnectSocialAccount(null, { current: null })
  const pending = hook.handleConnect('youtube', localId)
  for (const cleanup of cleanups) cleanup()
  assert.equal(signal?.aborted, true)
  resolveFetch(response(200, { oauthUrl: 'https://consent.example.invalid/late' }))
  await pending
  assert.equal(window.location.href, '/settings/social')
  assert.equal(hook.connectRequest.current, null)
  assert.deepEqual(stateWrites[0], ['youtube'])
  assert.deepEqual(stateWrites[2], [null])
  assert.deepEqual(messages, [])
})
