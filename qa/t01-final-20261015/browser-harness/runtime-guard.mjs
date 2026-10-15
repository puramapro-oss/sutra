import { randomUUID } from 'node:crypto'

// Native HTML keyboard calibration, independent of application tab order.
export async function calibrateKeyboard(browser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const observations = []
  try {
    await page.setContent('<input id="password"><button id="toggle">Show password</button><input id="next">')
    for (const key of ['Tab', 'Alt+Tab']) {
      await page.locator('#password').focus()
      await page.keyboard.press(key)
      observations.push({ key, focused: await page.evaluate(() => document.activeElement.id) })
    }
    const key = observations.find(row => row.focused === 'toggle')?.key
    if (!key) throw new Error('Native HTML keyboard control could not reach a button')
    await page.locator('#toggle').evaluate(button => { button.tabIndex = -1 })
    await page.locator('#password').focus()
    await page.keyboard.press(key)
    const negativeFocused = await page.evaluate(() => document.activeElement.id)
    if (negativeFocused === 'toggle') throw new Error('Keyboard negative control failed')
    return { engine: browser.browserType().name(), key, observations, negativeFocused, nativeSafari: false }
  } finally { await context.close() }
}

// The only admissible engine diagnostic requires a matching fetch STARTED by
// the departing document during lifecycle teardown under an explicit goto/reload.
// No general string allowlist: every other pageerror remains a gate failure.
export function classifyRuntimeErrors({ engine, nativeControl, errors, events, navigations, domErrors, fixtureOrigin }) {
  const qualified = [], unexpected = []
  for (const error of errors) {
    const match = /^Fetch API cannot load (https?:\/\/[^\s]+) due to access control checks\.$/.exec(error.stack?.split('\n')[0] ?? '')
    const navigation = navigations.find(row => row.id === error.navigation && ['goto', 'reload'].includes(row.method))
    let allowedResource = false, syntheticRead = false
    try {
      const url = new URL(match?.[1]), query = [...url.searchParams]
      const fixture = fixtureOrigin && new URL(fixtureOrigin)
      syntheticRead = Boolean(fixture && fixture.origin === fixtureOrigin && fixture.protocol === 'https:' && fixture.hostname === '127.0.0.1' && fixture.port
        && url.origin === fixtureOrigin && !url.username && !url.password && !url.hash
        && ((url.pathname === '/rest/v1/affirmations' && /^\?select=\*&category=eq\.(abundance|power|wisdom)$/.test(url.search))
          || (url.pathname === '/rest/v1/profiles' && url.search === '?select=*&id=eq.11111111-1111-4111-8111-111111111111'
            && nativeControl?.crossOriginProfileCaughtUnloadDiagnostic === true)))
      allowedResource = !url.hash && (!url.search || (query.length === 1 && query[0][0] === '_rsc' && /^[a-zA-Z0-9_-]{1,128}$/.test(query[0][1])))
    } catch { /* Malformed/unknown query is never qualified. */ }
    const fetch = match && events.find(row => row.kind === 'unload-fetch' && row.url === match[1]
      && row.navigation === error.navigation && row.document === navigation?.from
      && Math.abs(row.at - error.at) <= 1000)
    let sameOrigin = false
    try { sameOrigin = Boolean(navigation && match && new URL(match[1]).origin === new URL(navigation.from).origin && new URL(navigation.to).origin === new URL(navigation.from).origin) } catch { /* unknown remains a failure */ }
    let syntheticOriginProof = false
    try { syntheticOriginProof = Boolean(syntheticRead && fetch?.method === 'GET' && nativeControl?.crossOriginCaughtUnloadDiagnostic === true
      && new URL(navigation.to).origin === new URL(navigation.from).origin && new URL(navigation.from).origin !== fixtureOrigin) } catch { /* unknown remains a failure */ }
    const domFailure = domErrors.some(row => row.navigation === error.navigation && Math.abs(row.at - error.at) <= 1000)
    if (engine === 'webkit' && error.kind === 'pageerror'
      && ((nativeControl?.caughtUnloadDiagnostic === true && allowedResource && sameOrigin) || syntheticOriginProof)
      && fetch && !domFailure && navigation && error.at >= navigation.startedAt
      && error.at <= (navigation.finishedAt ?? error.at) + 1000) {
      qualified.push({ ...error, qualification: syntheticOriginProof ? 'native-webkit-synthetic-cross-origin-fetch-during-explicit-document-teardown' : 'native-webkit-caught-fetch-during-explicit-document-teardown', matchingFetch: fetch })
    } else unexpected.push(error)
  }
  // DOM errors are retained independently even if the engine omitted pageerror.
  unexpected.push(...domErrors.map(error => ({ ...error, kind: 'dom-uncaught' })))
  return { errors, qualified, unexpected, events, navigations, domErrors }
}

export async function observeRuntimeErrors(page, { engine, nativeControl, fixtureOrigin }) {
  const marker = 'sutra-harness-' + randomUUID()
  const errors = [], events = [], navigations = [], domErrors = []
  let activeNavigation = null
  page.on('console', message => {
    const text = message.text()
    if (text.startsWith(marker)) {
      try {
        const event = { ...JSON.parse(text.slice(marker.length)), navigation: activeNavigation?.id, at: Date.now() }
        if (event.kind === 'uncaught' || event.kind === 'unhandledrejection') domErrors.push(event)
        else events.push(event)
      } catch { errors.push({ kind: 'harness', message: 'Malformed runtime observation', at: Date.now() }) }
    } else if (message.type() === 'error' && /hydration|did not match|server rendered/i.test(text)) {
      errors.push({ kind: 'hydration', message: text, at: Date.now(), navigation: activeNavigation?.id })
    }
  })
  page.on('pageerror', error => errors.push({ kind: 'pageerror', message: error.message, stack: error.stack, navigation: activeNavigation?.id, at: Date.now() }))
  await page.addInitScript(({ marker, fixtureOrigin }) => {
    let unloading = false
    const emit = row => console.warn(marker + JSON.stringify({ ...row, document: location.origin + location.pathname }))
    addEventListener('beforeunload', () => { unloading = true }, true)
    addEventListener('pagehide', () => { unloading = true; emit({ kind: 'pagehide' }) }, true)
    addEventListener('error', event => { if (event.error) emit({ kind: 'uncaught', message: event.message }) }, true)
    addEventListener('unhandledrejection', event => emit({ kind: 'unhandledrejection', message: String(event.reason) }), true)
    const originalFetch = window.fetch
    window.fetch = function (...args) {
      if (unloading) {
        try {
          const url = new URL(typeof args[0] === 'string' || args[0] instanceof URL ? args[0] : args[0].url, location.href)
          // Only bounded Next-cache / synthetic affirmation and fixed fixture-profile queries are observed.
          // Unknown query/header/body data is never collected or qualified.
          const query = [...url.searchParams]
          const nextRsc = query.length === 1 && query[0][0] === '_rsc' && /^[a-zA-Z0-9_-]{1,128}$/.test(query[0][1])
          const fixture = fixtureOrigin && new URL(fixtureOrigin)
          const method = String(args[1]?.method ?? (args[0] instanceof Request ? args[0].method : 'GET')).toUpperCase()
          const syntheticRead = fixture && fixture.origin === fixtureOrigin && fixture.protocol === 'https:' && fixture.hostname === '127.0.0.1' && fixture.port
            && url.origin === fixtureOrigin && !url.username && !url.password && method === 'GET'
            && ((url.pathname === '/rest/v1/affirmations' && /^\?select=\*&category=eq\.(abundance|power|wisdom)$/.test(url.search))
              || (url.pathname === '/rest/v1/profiles' && url.search === '?select=*&id=eq.11111111-1111-4111-8111-111111111111'))
          if (!url.hash && ((url.origin === location.origin && (!url.search || nextRsc)) || syntheticRead)) {
            emit({ kind: 'unload-fetch', url: url.origin + url.pathname + url.search, method })
          }
        } catch { /* Original fetch determines success/failure unchanged. */ }
      }
      return Reflect.apply(originalFetch, this, args)
    }
  }, { marker, fixtureOrigin })
  for (const method of ['goto', 'reload']) {
    const original = page[method].bind(page)
    page[method] = async (...args) => {
      const from = new URL(page.url()), to = method === 'goto' ? new URL(args[0]) : from
      const row = { id: navigations.length + 1, method, from: from.origin + from.pathname, to: to.origin + to.pathname, startedAt: Date.now() }
      navigations.push(row); activeNavigation = row
      try { return await original(...args) } finally { row.finishedAt = Date.now() }
    }
  }
  return () => classifyRuntimeErrors({ engine, nativeControl, errors, events, navigations, domErrors, fixtureOrigin })
}
