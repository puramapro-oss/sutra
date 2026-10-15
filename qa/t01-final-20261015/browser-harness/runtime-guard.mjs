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
// the departing document during lifecycle teardown under an explicit goto.
// No general string allowlist: every other pageerror remains a gate failure.
export function classifyRuntimeErrors({ engine, nativeControl, errors, events, navigations, domErrors }) {
  const qualified = [], unexpected = []
  for (const error of errors) {
    const match = /^Fetch API cannot load (https?:\/\/[^\s]+) due to access control checks\.$/.exec(error.stack?.split('\n')[0] ?? '')
    const navigation = navigations.find(row => row.id === error.navigation)
    const fetch = match && events.find(row => row.kind === 'unload-fetch' && row.url === match[1]
      && row.navigation === error.navigation && row.document === navigation?.from
      && Math.abs(row.at - error.at) <= 1000)
    let sameOrigin = false
    try { sameOrigin = Boolean(navigation && match && new URL(match[1]).origin === new URL(navigation.from).origin && new URL(navigation.to).origin === new URL(navigation.from).origin) } catch { /* unknown remains a failure */ }
    const domFailure = domErrors.some(row => row.navigation === error.navigation && Math.abs(row.at - error.at) <= 1000)
    if (engine === 'webkit' && nativeControl?.caughtUnloadDiagnostic === true && error.kind === 'pageerror'
      && sameOrigin && fetch && !domFailure && navigation && error.at >= navigation.startedAt
      && error.at <= (navigation.finishedAt ?? error.at) + 1000) {
      qualified.push({ ...error, qualification: 'native-webkit-caught-fetch-during-explicit-document-teardown', matchingFetch: fetch })
    } else unexpected.push(error)
  }
  // DOM errors are retained independently even if the engine omitted pageerror.
  unexpected.push(...domErrors.map(error => ({ ...error, kind: 'dom-uncaught' })))
  return { errors, qualified, unexpected, events, navigations, domErrors }
}

export async function observeRuntimeErrors(page, { engine, nativeControl }) {
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
  await page.addInitScript(({ marker }) => {
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
          // Loopback fixture metadata only; never retain query/body/header data.
          if (url.origin === location.origin && !url.search && !url.hash) emit({ kind: 'unload-fetch', url: url.origin + url.pathname })
        } catch { /* Original fetch determines success/failure unchanged. */ }
      }
      return Reflect.apply(originalFetch, this, args)
    }
  }, { marker })
  const goto = page.goto.bind(page)
  page.goto = async (target, options) => {
    const from = new URL(page.url()), to = new URL(target)
    const row = { id: navigations.length + 1, from: from.origin + from.pathname, to: to.origin + to.pathname, startedAt: Date.now() }
    navigations.push(row); activeNavigation = row
    try { return await goto(target, options) } finally { row.finishedAt = Date.now() }
  }
  return () => classifyRuntimeErrors({ engine, nativeControl, errors, events, navigations, domErrors })
}
