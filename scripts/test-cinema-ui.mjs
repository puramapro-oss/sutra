import assert from 'node:assert/strict'
import http from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, isAbsolute, resolve } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { chromium, expect } from '@playwright/test'

// Real storyboard page, hook and export components in an isolated React host.
// Auth/navigation/Image are fixtures. No backend, paid generation or provider is contacted.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const serveOnly = process.argv.includes('--serve-only')
const staticFlag = process.argv.indexOf('--write-static')
const staticPath = staticFlag >= 0 ? process.argv[staticFlag + 1] : null
if (staticFlag >= 0 && (!staticPath || !isAbsolute(staticPath))) throw new Error('--write-static requires an absolute output path')
if (serveOnly && staticPath) throw new Error('Choose --serve-only or --write-static, not both')
const localPreviewMode = serveOnly || Boolean(staticPath)
const previewSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect width="800" height="450" fill="#24143c"/><text x="400" y="230" text-anchor="middle" fill="#ddd6fe" font-family="sans-serif" font-size="30">Aperçu simulé</text></svg>'
const checks = [], unexpectedRequests = [], previewRequests = [], apiRequests = [], browserErrors = []
const startedAt = performance.now()

const bundle = await build({
  absWorkingDir: root,
  stdin: { resolveDir: root, loader: 'tsx', contents: `
    import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import StoryboardPage from './src/app/(dashboard)/storyboard/page';
    import CinemaExport from './src/components/storyboard/CinemaExport';
    const scene = {id:'preview-fixture', visual_prompt:'A quiet forest in morning light', description:'Forêt au matin', duration_seconds:5, transition:'cut'};
    function InvalidExport() {
      const [duration, setDuration] = useState(0);
      return <main>
        <button onClick={()=>setDuration(5)}>Réparer le plan de test</button>
        <CinemaExport title="Projet à valider" format="16:9" scenes={[{...scene,duration_seconds:duration}]}/>
      </main>;
    }
    const appRoot = createRoot(document.getElementById('root'));
    const render = () => appRoot.render(location.pathname === '/invalid-export' || location.hash === '#invalid-export' ? <InvalidExport/> : <StoryboardPage/>);
    window.addEventListener('hashchange', render);
    render();
  ` },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env': '{}' }, logLevel: 'silent',
  plugins: [{ name: 'cinema-browser-fixtures', setup(builder) {
    builder.onResolve({ filter: /^(next\/(navigation|image)|@\/hooks\/useAuth)$/ }, args => ({ path: args.path, namespace: 'cinema-fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'cinema-fixture' }, args => ({ loader: 'tsx', resolveDir: root,
      contents: args.path === 'next/navigation'
        ? `export function useRouter() {return {push:(path)=>{window.__navigation=path}}}`
        : args.path === 'next/image'
          ? (staticPath
              ? `import React from 'react'; export default function Image({src,fill,unoptimized,priority,...props}) {return <img {...props} src={${JSON.stringify(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}`)}} data-original-source={src} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}:undefined}/>} `
              : serveOnly
              ? `import React from 'react'; export default function Image({src,fill,unoptimized,priority,...props}) {return <img {...props} src={'/__preview?source='+encodeURIComponent(src)} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}:undefined}/>} `
              : `import React from 'react'; export default function Image({fill,unoptimized,priority,...props}) {return <img {...props} style={{width:240,height:135,objectFit:'cover'}}/>}`)
          : `export function useAuth() {return {loading:false,profile:{id:'cinema-ui-fixture',plan:'creator'}}}`,
    }))
  } }],
})
const javascript = bundle.outputFiles[0].text
let stylesheet = 'body{font-family:sans-serif}button,input,select,textarea{margin:4px;min-height:32px}svg{width:20px;height:20px}section{padding:12px;margin:12px 0}textarea{display:block;width:500px}'
if (localPreviewMode) {
  const [{ default: postcss }, { default: tailwindcss }] = await Promise.all([import('postcss'), import('@tailwindcss/postcss')])
  const globalsPath = resolve(root, 'src/app/globals.css')
  stylesheet = (await postcss([tailwindcss({ base: resolve(root, 'src') })]).process(await readFile(globalsPath, 'utf8'), { from: globalsPath })).css
  // The isolated host has no Next font loader. Keep the real stylesheet and
  // make its fallback font explicit; do not fetch a font from an external host.
  stylesheet += '\n:root{--font-space-grotesk:system-ui,sans-serif;}'
}
if (staticPath) {
  const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; connect-src \'none\'; font-src data:; object-src \'none\'; base-uri \'none\'">'
    + '<title>SUTRA cinéma — vérification locale</title><style>' + stylesheet.replace(/<\/style/gi, '<\\/style') + '</style></head><body>'
    + '<aside role="note" style="padding:12px 24px;border-bottom:1px solid #a78bfa;color:#ede9fe;background:#24143c;font-family:system-ui,sans-serif">'
    + '<strong>Vérification locale — services simulés</strong><nav aria-label="Scénarios de vérification" style="display:flex;gap:20px;margin-top:8px">'
    + '<a href="#storyboard">Storyboard</a><a href="#invalid-export">Tester une entrée invalide</a></nav></aside>'
    + '<div id="root"></div><script>' + javascript.replace(/<\/script/gi, '<\\/script') + '</script></body></html>'
  await mkdir(dirname(staticPath), { recursive: true })
  await writeFile(staticPath, html, 'utf8')
  console.log(JSON.stringify({ status: 'WROTE_STATIC', path: staticPath, fileUrl: pathToFileURL(staticPath).href,
    bytes: Buffer.byteLength(html), style: 'real globals.css and Tailwind, system fallback font, isolated page',
    preview: 'inline SVG fixture with data-original-source', network: 'CSP connect-src none; no remote images', browserLaunched: false }, null, 2))
  process.exit(0)
}
const servedRequests = { api: [], preview: [] }
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  res.setHeader('Cache-Control', 'no-store')
  if (serveOnly) res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'")
  if (url.pathname === '/app.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); res.end(javascript); return }
  if (url.pathname === '/app.css') { res.writeHead(200, { 'Content-Type': 'text/css' }); res.end(stylesheet); return }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return }
  if (serveOnly && url.pathname === '/__evidence') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ scope: 'isolated real React page; auth, navigation and images are fixtures',
      style: 'compiled src/app/globals.css and Tailwind; system font fallback; dashboard shell excluded',
      counters: { api: servedRequests.api.length, simulatedPreview: servedRequests.preview.length }, requests: servedRequests }, null, 2))
    return
  }
  if (serveOnly && url.pathname === '/__preview') {
    servedRequests.preview.push({ method: req.method, originalSource: url.searchParams.get('source') })
    // Never dereference originalSource. This endpoint always returns a local fixture.
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' })
    res.end(previewSvg)
    return
  }
  if (url.pathname.startsWith('/api/')) {
    servedRequests.api.push({ method: req.method, path: url.pathname })
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'API désactivée dans ce test isolé' }))
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SUTRA cinéma UI isolée</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>')
})
const port = serveOnly ? Number(process.env.SUTRA_CINEMA_UI_PORT ?? 0) : 0
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('SUTRA_CINEMA_UI_PORT must be an integer from 0 to 65535')
await new Promise(resolveListen => server.listen(port, '127.0.0.1', resolveListen))
const origin = `http://127.0.0.1:${server.address().port}`
let browser

async function downloadText(page, testId, filename) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId(testId).click()])
  assert.equal(download.suggestedFilename(), filename)
  const stream = await download.createReadStream()
  assert.ok(stream, 'Download must be readable')
  const parts = []
  for await (const part of stream) parts.push(Buffer.from(part))
  assert.equal(await download.failure(), null)
  return Buffer.concat(parts).toString('utf8')
}

async function settleRendering(page) {
  await page.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))))
}

if (serveOnly) {
  console.log(JSON.stringify({ status: 'READY', mode: 'serve-only', url: `${origin}/storyboard`,
    invalidExportUrl: `${origin}/invalid-export`, evidenceUrl: `${origin}/__evidence`,
    style: 'real globals.css and Tailwind, system fallback font, isolated page', browserLaunched: false }, null, 2))
  const close = () => { server.closeAllConnections(); server.close(() => process.exit(0)) }
  process.once('SIGINT', close)
  process.once('SIGTERM', close)
} else try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.SUTRA_UI_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: true })
  await context.addInitScript(() => {
    const originalCreate = URL.createObjectURL.bind(URL), originalRevoke = URL.revokeObjectURL.bind(URL)
    window.__blobUrls = { created: [], revoked: [] }
    URL.createObjectURL = blob => { const url = originalCreate(blob); window.__blobUrls.created.push(url); return url }
    URL.revokeObjectURL = url => { window.__blobUrls.revoked.push(url); return originalRevoke(url) }
  })
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.hostname === 'image.pollinations.ai' && request.method() === 'GET') {
      previewRequests.push(url)
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="135"><rect width="240" height="135" fill="#6b46c1"/></svg>' })
    }
    if (url.origin !== origin) { unexpectedRequests.push(request.url()); return route.abort('blockedbyclient') }
    if (url.pathname.startsWith('/api/')) { apiRequests.push(url.pathname); return route.fulfill({ status: 500, json: { error: 'No API expected in manual export' } }) }
    return route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', error => browserErrors.push(error.message))

  // The actual page starts empty; its manual path needs no AI response.
  await page.goto(`${origin}/storyboard`)
  await page.getByTestId('add-first-scene-btn').click()
  await expect(page.getByTestId('export-blender-btn')).toBeVisible()
  await expect(page.getByTestId('add-first-scene-btn')).toHaveCount(0)
  await page.getByLabel('Idee de video').fill('Le souffle — projet cinéma 🌿')
  await page.getByLabel('Description du plan 1', { exact: true }).fill('Premier plan : lumière dorée et forêt.')
  await page.getByLabel('Instruction visuelle du plan 1', { exact: true }).fill('Wide shot of an emerald forest, golden sunrise 🌿')
  await page.getByLabel('Durée du plan 1 en secondes', { exact: true }).fill('7')
  await page.getByLabel('Transition du plan 1', { exact: true }).selectOption('fade')
  await page.getByTestId('add-scene-btn').click()
  await page.getByLabel('Description du plan 2', { exact: true }).fill('Deuxième plan : un chemin vers la lumière.')
  await page.getByLabel('Instruction visuelle du plan 2', { exact: true }).fill('Slow dolly toward a bright forest path')
  await page.getByLabel('Durée du plan 2 en secondes', { exact: true }).fill('11')
  await page.getByRole('button', { name: /^9:16/ }).click()
  await settleRendering(page)
  assert.equal(previewRequests.length, 0)
  assert.equal(apiRequests.length, 0)
  checks.push('Page réelle : ajout et édition manuels de deux plans, sans API ni aperçu externe')

  const project = JSON.parse(await downloadText(page, 'export-cinema-json-btn', 'sutra-cinema.project.json'))
  const script = await downloadText(page, 'export-blender-btn', 'sutra-cinema.blender.py')
  const literal = script.match(/^PROJECT_JSON\s*=\s*(".*")\s*$/m)
  assert.ok(literal, 'Downloaded Python must carry its readable, quoted project manifest')
  assert.match(script, /import bpy/)
  assert.deepEqual(JSON.parse(JSON.parse(literal[1])), project, 'Python and JSON downloads must describe the same project')
  assert.equal(project.title, 'Le souffle — projet cinéma 🌿')
  assert.equal(project.format, '9:16')
  assert.equal(project.schemaVersion, 1)
  assert.equal(project.productionStatus, 'previsualization')
  assert.deepEqual(project.fps, { numerator: 24, denominator: 1 })
  assert.deepEqual(project.scenes.map(scene => scene.description), ['Premier plan : lumière dorée et forêt.', 'Deuxième plan : un chemin vers la lumière.'])
  assert.deepEqual(project.scenes.map(scene => scene.visual_prompt), ['Wide shot of an emerald forest, golden sunrise 🌿', 'Slow dolly toward a bright forest path'])
  assert.equal(project.higgsfield.status, 'not_submitted')
  assert.deepEqual(project.higgsfield.requests.map(request => request.body.prompt), project.scenes.map(scene => scene.visual_prompt))
  assert.deepEqual(project.higgsfield.requests.map(request => request.sceneId), project.scenes.map(scene => scene.id))
  assert.deepEqual(project.scenes.map(scene => scene.duration_seconds), [7, 11])
  assert.deepEqual(project.scenes.map(scene => scene.transition), ['fade', 'cut'])
  assert.equal(new Set(project.scenes.map(scene => scene.id)).size, 2)
  assert.ok(project.scenes.every(scene => typeof scene.id === 'string' && scene.id.length > 0))
  assert.deepEqual(project.scenes.map(scene => scene.timeline), [
    { startFrame: 0, durationFrames: 168, endFrameExclusive: 168 },
    { startFrame: 168, durationFrames: 264, endFrameExclusive: 432 },
  ])
  assert.equal(project.timeline.totalFrames, 432)
  await expect.poll(() => page.evaluate(() => window.__blobUrls.revoked.length)).toBe(2)
  const urls = await page.evaluate(() => window.__blobUrls)
  assert.deepEqual(urls.revoked.sort(), urls.created.sort())
  assert.equal(previewRequests.length, 0)
  assert.equal(apiRequests.length, 0)
  checks.push('Téléchargements réels .py/.json cohérents : Unicode, IDs, ordre, format, durées, transitions, images temporelles et libération des Blob URLs')

  await page.getByRole('button', { name: 'Générer un aperçu du plan 1', exact: true }).click()
  await expect.poll(() => previewRequests.length).toBe(1)
  assert.equal(previewRequests[0].searchParams.get('width'), '432')
  assert.equal(previewRequests[0].searchParams.get('height'), '768')
  assert.equal(previewRequests[0].searchParams.get('nofeed'), 'true')
  assert.equal(decodeURIComponent(previewRequests[0].pathname.slice('/prompt/'.length)), project.scenes[0].visual_prompt)
  checks.push('Aperçu sur la page réelle : seul le clic explicite transmet le prompt et le format choisis à la fixture Pollinations')

  // Editing a visual instruction or the format invalidates the old preview.
  const beforePreview = previewRequests.length
  await expect(page.getByRole('img')).toBeVisible()
  const changedPrompt = 'Une forêt émeraude — "lumière" 🌿'
  await page.getByLabel('Instruction visuelle du plan 1', { exact: true }).fill(changedPrompt)
  await page.getByRole('button', { name: /^1:1/ }).click()
  await expect(page.getByRole('img')).toHaveCount(0)
  await settleRendering(page)
  assert.equal(previewRequests.length, beforePreview, 'Editing must not send a new prompt')
  await page.getByRole('button', { name: 'Générer un aperçu du plan 1', exact: true }).click()
  await expect.poll(() => previewRequests.length).toBe(beforePreview + 1)
  const lastPreview = previewRequests.at(-1)
  assert.equal(decodeURIComponent(lastPreview.pathname.slice('/prompt/'.length)), changedPrompt)
  assert.equal(lastPreview.searchParams.get('width'), '600')
  assert.equal(lastPreview.searchParams.get('height'), '600')
  checks.push('Page réelle : changer prompt et format masque l’ancien aperçu sans nouvelle requête avant confirmation')

  // Invalid props cannot be entered through bounded duration controls, so this
  // component fixture exercises the exporter error boundary without weakening it.
  await page.goto(`${origin}/invalid-export`)
  const invalidDownloads = []
  const onDownload = download => invalidDownloads.push(download.suggestedFilename())
  page.on('download', onDownload)
  await page.getByTestId('export-blender-btn').click()
  await expect(page.getByRole('alert')).toContainText(/durée|plan/i)
  assert.deepEqual(invalidDownloads, [])
  assert.deepEqual(await page.evaluate(() => window.__blobUrls.created), [])
  await page.getByRole('button', { name: 'Réparer le plan de test', exact: true }).click()
  const repaired = JSON.parse(await downloadText(page, 'export-cinema-json-btn', 'sutra-cinema.project.json'))
  assert.equal(repaired.scenes[0].duration_seconds, 5)
  await expect(page.getByRole('alert')).toHaveCount(0)
  page.off('download', onDownload)
  checks.push('Composant réel : durée invalide refusée avec alerte accessible, aucun fichier créé ; correction puis export réussi')

  assert.deepEqual(apiRequests, [])
  assert.deepEqual(unexpectedRequests, [])
  assert.deepEqual(browserErrors, [])
  console.log(JSON.stringify({ status: 'PASS', scope: 'isolated React page and components; backend and Blender execution excluded',
    browserVersion: browser.version(), durationMs: Math.round(performance.now() - startedAt), checks,
    providerRequestsSent: 0, simulatedPreviewRequests: previewRequests.length, apiRequests: apiRequests.length }, null, 2))
} finally {
  await browser?.close()
  server.closeAllConnections()
  await new Promise(resolveClose => server.close(resolveClose))
}
