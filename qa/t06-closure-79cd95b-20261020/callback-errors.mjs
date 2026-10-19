// Execute the real page callback effect with an isolated React/toast boundary.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'
const compiled = await build({ entryPoints: ['src/app/(dashboard)/settings/social/page.tsx'], bundle: false, write: false, format: 'cjs', platform: 'node', jsx: 'automatic' })
function callback(error) {
  const effects = [], messages = [], updates = [], history = []
  const exports = {}, cjsModule = { exports }
  const window = { location: { pathname: '/settings/social', search: '?keep=1&error=' + encodeURIComponent(error) }, history: { replaceState: (...args) => history.push(args[2]) } }
  const react = { useState: initial => [initial, value => updates.push(value)], useRef: value => ({ current: value }), useCallback: value => value, useEffect: effect => effects.push(effect) }
  runInNewContext(compiled.outputFiles[0].text, { module: cjsModule, exports, URLSearchParams, window,
    require: name => name === 'react' ? react : name === 'react/jsx-runtime' ? { jsx: () => ({}), jsxs: () => ({}) } : name === 'sonner' ? { toast: { error: value => messages.push(value), success: value => messages.push(value) } } : name.endsWith('useAuth') ? { useAuth() {} } : name.endsWith('zernio') ? { PLATFORM_INFO: {} } : {} })
  cjsModule.exports.default()
  assert.equal(effects.length, 2)
  effects[1]()
  return { effects, messages, updates, history }
}

for (const [code, expected] of [
  ['fixture_private_token_never_display', /Connexion indisponible/],
  ['invalid_or_expired_state', /expiré|déjà utilisé/],
  ['session_required', /session/],
  ['oauth_denied', /refusée/],
  ['oauth_empty_profile', /Aucun compte/],
  ['db_error', /enregistrer/],
]) test('callback error safely explains ' + code, () => {
  const result = callback(code)
  assert.equal(result.messages.length, 1)
  assert.match(result.messages[0], expected)
  assert.ok(!result.messages[0].includes('fixture_private_token_never_display'))
  assert.ok(result.updates.includes(result.messages[0]), 'persistent accessible error mirrors safe toast')
  assert.deepEqual(result.history, ['/settings/social?keep=1'])
})
