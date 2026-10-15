// Native fetch control: no Next.js, React, app code, identity or external network.
import { createServer } from 'node:https'
import { once } from 'node:events'
import { writeFile } from 'node:fs/promises'
import { chromium, webkit } from '@playwright/test'
import { prepareTLS } from '../t07-frontend-journey-20261014/tls-fixture.mjs'
const tls = await prepareTLS()
const server = createServer(tls.options, (req, res) => {
  if (req.url === '/slow') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.write('partial')
    const timer = setTimeout(() => res.end('end'), 2000)
    res.on('close', () => clearTimeout(timer))
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<h1>Native fetch navigation control</h1><script>window.probe=()=>fetch("/slow").then(r=>r.text()); if(location.pathname==="/on-hide") addEventListener("pagehide",()=>{fetch("/slow").catch(()=>{})});</script>')
  }
})
server.listen(0, '127.0.0.1'); await once(server, 'listening')
const base = `https://127.0.0.1:${server.address().port}`
const results = []
try {
  for (const [name, type] of Object.entries({ chromium, webkit })) {
    const browser = await type.launch({ headless: true })
    const page = await browser.newPage({ ignoreHTTPSErrors: true })
    const errors = [], failures = []
    page.on('pageerror', error => errors.push({ message: error.message, stack: error.stack }))
    page.on('requestfailed', request => failures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }))
    await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    await page.goto(base)
    await page.evaluate(() => { window.probe() })
    await page.waitForTimeout(100)
    await page.goto(base + '/next')
    await page.waitForTimeout(500)
    results.push({ browser: name, errors, failures })
    const caughtErrors = []
    page.on('pageerror', error => caughtErrors.push({ message: error.message, stack: error.stack }))
    await page.goto(base + '/on-hide')
    await page.goto(base + '/next')
    await page.waitForTimeout(500)
    results.push({ browser: name, control: 'caught fetch during pagehide', errors: caughtErrors })
    await browser.close()
  }
} finally { server.closeAllConnections(); await new Promise(done => server.close(done)) }
await writeFile('qa/t07-final-ux-perf-20261015/webkit-navigation-probe-pagehide.json', JSON.stringify(results, null, 2) + '\n')
process.stdout.write(JSON.stringify(results, null, 2) + '\n')
