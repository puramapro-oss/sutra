import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import test from 'node:test'
import { chromium } from '@playwright/test'
import { assertStoredMarkupInert } from './stored-markup-readiness.mjs'

const id = '88888888-8888-4888-8888-888888888888'
const payload = '<img src=x onerror="window.__t08Xss=1">'

test('T08 stored-markup readiness with native Chromium and unfinished background traffic', async t => {
  let variant = 'valid', dataReads = 0
  const pending = new Set()
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://fixture.invalid').pathname
    if (path === '/background') {
      pending.add(response)
      response.on('close', () => pending.delete(response))
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.write('deliberately unfinished background response')
      return
    }
    if (path === '/missing') { response.writeHead(404); response.end(); return }
    if (path === '/data') {
      dataReads++
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ id, payload, variant }))
      return
    }
    const editor = path.startsWith('/editor/')
    response.writeHead(variant === 'http-error' ? 503 : 200, { 'content-type': 'text/html' })
    response.end(`<!doctype html><main></main><script>
      window.__t08Xss = 0;
      fetch('/background').catch(() => {});
      fetch('/data').then(response => response.json()).then(async data => {
        const main = document.querySelector('main');
        if (data.variant === 'executable-markup') {
          const image = document.createElement('img');
          image.setAttribute('onerror', 'window.__t08Xss=1');
          const failed = new Promise(resolve => image.addEventListener('error', resolve));
          image.src = '/missing'; main.append(image); await failed;
        }
        const content = document.createElement(${JSON.stringify(editor ? 'h1' : 'article')});
        content.dataset.testid = ${JSON.stringify(editor ? 'editor-title' : `video-card-${id}`)};
        content.textContent = data.variant === ${JSON.stringify(editor ? 'wrong-editor' : 'wrong-library')} ? 'Wrong persisted content' : data.payload;
        main.append(content);
        if (${editor}) {
          const button = document.createElement('button'); button.dataset.testid = 'editor-export';
          button.textContent = 'Export'; button.disabled = data.variant === 'disabled-export'; main.append(button);
        }
      });
    </script>`)
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  let browser
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.SUTRA_CHROMIUM_PATH ? { executablePath: process.env.SUTRA_CHROMIUM_PATH } : {}) })
    await t.test('reproduces networkidle timing out while the exact library content is already rendered', async () => {
      const page = await browser.newPage()
      try {
        await assert.rejects(() => page.goto(base + '/library', { waitUntil: 'networkidle', timeout: 1000 }), /Timeout 1000ms exceeded/)
        assert.equal(await page.getByTestId(`video-card-${id}`).textContent(), payload)
        assert.ok(pending.size > 0, 'the document is usable while a background response remains open')
      } finally { await page.close() }
    })
    for (const [name, setting, expectedFailure] of [
      ['loads exact inert content and export control while background traffic stays pending', 'valid', null],
      ['rejects the wrong library content', 'wrong-library', /toContainText/],
      ['rejects the wrong editor content', 'wrong-editor', /toHaveText/],
      ['rejects executable stored markup', 'executable-markup', /1 !== 0/],
      ['rejects a disabled export control', 'disabled-export', /toBeEnabled/],
      ['rejects an unsuccessful document even if its DOM looks ready', 'http-error', /503 !== 200/],
    ]) {
      await t.test(name, async () => {
        variant = setting
        const before = dataReads, page = await browser.newPage()
        page.setDefaultNavigationTimeout(5000)
        try {
          const check = () => assertStoredMarkupInert({ page, base, id, payload })
          if (expectedFailure) await assert.rejects(check, expectedFailure)
          else {
            await check()
            assert.ok(dataReads >= before + 2, 'both actual content reads completed')
            assert.ok(pending.size > 0, 'background traffic is still unfinished at successful readiness')
          }
        } finally { await page.close() }
      })
    }
  } finally {
    await browser?.close()
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})
