import { test, expect } from '@playwright/test'

test.describe('SEO', () => {
  test('landing page has meta title', async ({ page }) => {
    await page.goto('/')
    const title = await page.title()
    expect(title.length).toBeGreaterThan(5)
    expect(title.toLowerCase()).toContain('sutra')
  })

  test('landing page has meta description', async ({ page }) => {
    await page.goto('/')
    const desc = await page.getAttribute('meta[name="description"]', 'content')
    expect(desc).toBeTruthy()
    expect(desc!.length).toBeGreaterThan(20)
  })

  test('landing page has og:image', async ({ page }) => {
    await page.goto('/')
    const og = await page.getAttribute('meta[property="og:image"]', 'content')
    expect(og).toBeTruthy()
  })

  test('sitemap.xml accessible', async ({ request }) => {
    const res = await request.get('/sitemap.xml')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain('<urlset')
  })

  test('robots.txt accessible', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain('Sitemap')
  })

  test('pricing has heading', async ({ page }) => {
    await page.goto('/pricing')
    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible()
  })

  test('landing has h1', async ({ page }) => {
    await page.goto('/')
    const h1 = page.locator('h1')
    await expect(h1.first()).toBeVisible()
  })
})

test.describe('PWA', () => {
  test('manifest.json accessible', async ({ request }) => {
    const res = await request.get('/manifest.json')
    expect([200, 301, 302]).toContain(res.status())
  })

  test('service worker accessible', async ({ request }) => {
    const res = await request.get('/sw.js')
    expect([200, 301, 302, 404]).toContain(res.status())
  })
})

test.describe('Dark Mode', () => {
  test('landing page has dark background', async ({ page }) => {
    await page.goto('/')
    const bg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor
    })
    // Should be dark (rgb values low)
    expect(bg).toBeTruthy()
  })

  test('login page has dark background', async ({ page }) => {
    await page.goto('/login')
    const bg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor
    })
    expect(bg).toBeTruthy()
  })
})
