import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = path.resolve('test-results/screenshots')
fs.mkdirSync(OUT, { recursive: true })

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
]

const browser = await chromium.launch()
for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  await ctx.addInitScript(() => {
    try { localStorage.setItem('cookie-consent', 'all') } catch {}
  })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('[data-testid="landing-mounted"]', { timeout: 10000 })

  // Scroll all the way down (slowly) to trigger every framer-motion whileInView
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const total = document.documentElement.scrollHeight
    const step = window.innerHeight * 0.5
    for (let y = 0; y <= total; y += step) {
      window.scrollTo(0, y)
      await sleep(220)
    }
    // Stay at bottom a moment so all delays complete
    window.scrollTo(0, total)
    await sleep(900)
    window.scrollTo(0, 0)
    await sleep(400)
  })
  await page.waitForTimeout(1200)

  const file = path.join(OUT, `landing-${vp.name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log(`✓ ${vp.name} → ${file}`)

  // Hero only (above the fold)
  const heroFile = path.join(OUT, `hero-${vp.name}.png`)
  await page.screenshot({ path: heroFile, fullPage: false })
  console.log(`✓ hero-${vp.name} → ${heroFile}`)

  await ctx.close()
}
await browser.close()
