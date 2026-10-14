import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync('src/app/(dashboard)/settings/social/page.tsx', 'utf8')
const start = source.indexOf('const handleConnect = useCallback(')
const end = source.indexOf('\n  const handleDisconnect', start)
assert.ok(start >= 0 && end > start)
const code = ts.transpile(source.slice(start, end).replace('const handleConnect =', 'globalThis.handler ='), { target: ts.ScriptTarget.ES2022 })
for (const [status, expected] of [[409, 'Déconnexion en cours de vérification'], [503, 'Profil social non attribué'], [500, 'Connexion YouTube indisponible']] as const) {
  test(`connect ${status}: actionable safe feedback and retry enabled`, async () => {
    const messages: string[] = [], states: unknown[] = []
    const ctx = vm.createContext({ useCallback: (fn: unknown) => fn, setConnecting: (state: unknown) => states.push(state), PLATFORM_INFO: { youtube: { label: 'YouTube' } }, toast: { error: (msg: string) => messages.push(msg) }, fetch: async () => ({ ok: false, status, json: async () => ({ error: 'UNTRUSTED_PROVIDER_SECRET' }) }), window: { location: { href: '/settings/social' } } })
    vm.runInContext(code, ctx)
    await ctx.handler('youtube')
    assert.equal(messages.length, 1)
    assert.ok(messages[0].startsWith(expected), messages[0])
    assert.ok(!messages[0].includes('UNTRUSTED'))
    assert.deepEqual(states, ['youtube', null])
    assert.equal(ctx.window.location.href, '/settings/social')
  })
}
test('connect success preserves authorized OAuth redirect', async () => {
 const ctx = vm.createContext({ useCallback: (fn: unknown) => fn, setConnecting: () => {}, PLATFORM_INFO: { youtube: { label: 'YouTube' } }, toast: { error: () => assert.fail('unexpected toast') }, fetch: async () => ({ ok: true, status: 200, json: async () => ({ oauthUrl: 'https://consent.example.invalid/authorize' }) }), window: { location: { href: '' } } })
 vm.runInContext(code, ctx); await ctx.handler('youtube'); assert.equal(ctx.window.location.href, 'https://consent.example.invalid/authorize')
})
