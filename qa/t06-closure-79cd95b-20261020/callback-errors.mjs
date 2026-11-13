// Execute the real page callback effect with an isolated React/toast boundary.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'
const visualComponents = ['PageHeader', 'ConnectionSummary', 'PlatformGrid', 'AutopilotSection', 'DisconnectConfirmModal']
const compiled = await build({
  entryPoints: ['src/app/(dashboard)/settings/social/page.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'next/navigation', 'sonner', '@/hooks/useAuth', '@/lib/zernio', '@/components/ui/Button',
    ...visualComponents.map(name => `@/components/settings/social/${name}`)],
})
async function callback(error) {
  const effects = [], messages = [], updates = [], history = [], reads = []
  const exports = {}, cjsModule = { exports }
  const window = { location: { pathname: '/settings/social', search: '?keep=1&error=' + encodeURIComponent(error) }, history: { replaceState: (...args) => history.push(args[2]) } }
  const react = { Suspense: ({ children }) => children, useState: initial => [typeof initial === 'function' ? initial() : initial, value => updates.push(value)], useRef: value => ({ current: value }), useCallback: value => value, useEffect: effect => effects.push(effect) }
  const jsx = (type, props) => typeof type === 'function' ? type(props) : { type, props }
  runInNewContext(compiled.outputFiles[0].text, { module: cjsModule, exports, URLSearchParams, window, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      reads.push([url, options?.method ?? 'GET'])
      return { ok: false } // Isolate account reads without any provider or database access.
    },
    require: name => {
      if (name === 'react') return react
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (name === 'next/navigation') return { useSearchParams: () => new URLSearchParams(window.location.search) }
      if (name === 'sonner') return { toast: { error: value => messages.push(value), success: value => messages.push(value) } }
      if (name === '@/hooks/useAuth') return { useAuth: () => ({ loading: false, profile: { id: '11111111-1111-4111-8111-111111111111' } }) }
      if (name === '@/lib/zernio') return { PLATFORM_INFO: {} }
      if (name === '@/components/ui/Button') return { default: () => null }
      const component = visualComponents.find(value => name === `@/components/settings/social/${value}`)
      if (component) return { [component]: () => null }
      throw new Error(`Unexpected fixture import: ${name}`)
    } })
  // Traverse the real authenticated wrapper, content, hook and error-message helper.
  const rendered = cjsModule.exports.default()
  const cleanups = effects.map(effect => effect()).filter(value => typeof value === 'function')
  try {
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(reads, [['/api/social/accounts', 'GET'], ['/api/social/autopilot', 'GET']])
    function elements(node) {
      if (Array.isArray(node)) return node.flatMap(elements)
      return node?.props ? [node, ...elements(node.props.children)] : []
    }
    const errors = elements(rendered).filter(node => node.props['data-testid'] === 'social-connect-error')
    assert.equal(errors.length, 1)
    assert.equal(errors[0].props.role, 'alert')
    return { effects, messages, updates, history, persistentError: errors[0].props.children }
  } finally {
    for (const cleanup of cleanups.reverse()) cleanup()
  }
}

for (const [code, expected] of [
  ['fixture_private_token_never_display', /Connexion indisponible/],
  ['invalid_or_expired_state', /expiré|déjà utilisé/],
  ['session_required', /session/],
  ['oauth_denied', /refusée/],
  ['oauth_empty_profile', /Aucun compte/],
  ['db_error', /enregistrer/],
]) test('callback error safely explains ' + code, async () => {
  const result = await callback(code)
  assert.equal(result.messages.length, 1)
  assert.match(result.messages[0], expected)
  assert.ok(!result.messages[0].includes('fixture_private_token_never_display'))
  assert.equal(result.persistentError, result.messages[0], 'persistent accessible error mirrors safe toast')
  assert.deepEqual(result.history, ['/settings/social?keep=1'])
})
