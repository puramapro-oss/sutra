import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { chromium, expect } from '@playwright/test'

const root = fileURLToPath(new URL('../', import.meta.url))
const fixture = name => resolve(root, 'qa/t05-real-export-20261014/exports', name)
const { outputFiles } = await build({
  absWorkingDir: root, bundle: true, write: false, jsx: 'automatic', format: 'iife',
  stdin: { resolveDir: root, loader: 'tsx', contents: `
    import { StrictMode, useState } from 'react'
    import { createRoot } from 'react-dom/client'
    import StoryboardRenderReview from './src/components/storyboard/StoryboardRenderReview'
    const scenes = [0.5, 1, 1].map((duration_seconds, index) => ({
      id: String(index), visual_prompt: 'Product detail', description: 'Plan produit', duration_seconds, transition: 'cut',
    }))
    function Host() {
      const [format, setFormat] = useState('16:9')
      return <>
        <button onClick={() => setFormat('9:16')}>Passer au portrait</button>
        <StoryboardRenderReview format={format} scenes={scenes} />
      </>
    }
    const app = createRoot(document.getElementById('root'))
    app.render(<StrictMode><Host /></StrictMode>)
    window.closeFixture = () => app.unmount()
  ` },
})

const browser = await chromium.launch({ executablePath: process.env.SUTRA_UI_CHROMIUM_PATH || undefined })
try {
  const page = await browser.newPage()
  const remoteRequests = []
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route(/^https?:/, route => {
    remoteRequests.push(route.request().url())
    return route.abort()
  })
  await page.setContent('<html lang="fr"><main id="root"></main></html>')
  await page.evaluate(() => {
    const create = URL.createObjectURL.bind(URL)
    const revoke = URL.revokeObjectURL.bind(URL)
    window.liveMediaUrls = new Set()
    URL.createObjectURL = file => {
      const url = create(file)
      window.liveMediaUrls.add(url)
      return url
    }
    URL.revokeObjectURL = url => {
      window.liveMediaUrls.delete(url)
      return revoke(url)
    }
  })
  await page.addScriptTag({ content: outputFiles[0].text })
  const input = page.getByLabel('Choisir un MP4 local')
  const status = page.getByRole('status')
  const alert = page.getByRole('alert')
  const video = page.locator('video')
  const jump = page.getByRole('combobox', { name: 'Aller au début d’un plan' })
  const liveUrls = () => page.evaluate(() => [...window.liveMediaUrls])

  await input.setInputFiles(fixture('16-9-logo.mp4'))
  await expect(status).toContainText('1280 × 720 px · 1,2 s')
  await expect(status).toContainText('Le cadrage correspond au format 16:9')
  await expect(status).toContainText('Le montage prévoit 2,5 s')
  assert.equal(await video.evaluate(element => element.controls), true)
  await expect(jump.locator('option').last()).toHaveJSProperty('disabled', true)
  await jump.selectOption('0.5')
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeCloseTo(0.5)
  await expect.poll(() => video.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2)
  const [landscape] = await liveUrls()
  assert.ok(landscape)

  await input.setInputFiles({ name: 'script.txt', mimeType: 'text/plain', buffer: Buffer.from('Texte') })
  await expect(alert).toContainText('Choisis un fichier vidéo MP4')
  await expect(status).toContainText('16-9-logo.mp4')
  assert.deepEqual(await liveUrls(), [landscape])
  await input.setInputFiles({ name: 'vide.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(0) })
  await expect(alert).toContainText('Choisis un fichier vidéo MP4')

  await input.setInputFiles(fixture('9-16-video-only.mp4'))
  await expect(status).toContainText('720 × 1280 px')
  await expect(status).toContainText('un autre cadrage (16:9)')
  await expect(alert).toHaveCount(0)
  const [portrait] = await liveUrls()
  assert.ok(portrait && portrait !== landscape)
  assert.deepEqual(await liveUrls(), [portrait])
  await page.getByRole('button', { name: 'Passer au portrait' }).click()
  await expect(status).toContainText('Le cadrage correspond au format 9:16')
  assert.deepEqual(await liveUrls(), [portrait])

  await input.setInputFiles({ name: 'illisible.mp4', mimeType: 'video/mp4', buffer: Buffer.from('Invalid MP4') })
  await expect(alert).toContainText('ne peut pas lire la piste vidéo')
  await expect(status).toHaveCount(0)
  await expect(jump).toHaveCount(0)
  assert.ok(!(await liveUrls()).includes(portrait))
  await input.setInputFiles(fixture('9-16-video-only.mp4'))
  await expect(status).toContainText('Le cadrage correspond au format 9:16')
  await expect(jump.locator('option')).toHaveCount(4)
  await page.evaluate(() => window.closeFixture())
  assert.deepEqual(await liveUrls(), [])
  assert.deepEqual(remoteRequests, [])
  assert.deepEqual(errors, [])
  console.log('PASS – deux MP4 H.264 lus dans Chromium, cadrages, durées, déplacement, erreurs, reprise et libération des URL locales.')
} finally {
  await browser.close()
}
