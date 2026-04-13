import { test, expect } from '@playwright/test'

test.describe('Gamification — API endpoints', () => {
  test('GET /api/points requires auth', async ({ request }) => {
    const res = await request.get('/api/points')
    expect([401, 403]).toContain(res.status())
  })

  test('GET /api/daily-gift requires auth', async ({ request }) => {
    const res = await request.get('/api/daily-gift')
    expect([401, 403]).toContain(res.status())
  })

  test('GET /api/boutique returns items or requires auth', async ({ request }) => {
    const res = await request.get('/api/boutique')
    expect([200, 401, 403]).toContain(res.status())
  })

  test('GET /api/achievements returns data or requires auth', async ({ request }) => {
    const res = await request.get('/api/achievements')
    expect([200, 401, 403]).toContain(res.status())
  })

  test('GET /api/lottery returns data or requires auth', async ({ request }) => {
    const res = await request.get('/api/lottery')
    expect([200, 401, 403]).toContain(res.status())
  })

  test('GET /api/feedback requires auth', async ({ request }) => {
    const res = await request.get('/api/feedback')
    expect([401, 403, 405]).toContain(res.status())
  })

  test('POST /api/share requires auth', async ({ request }) => {
    const res = await request.post('/api/share', { data: {} })
    expect([401, 403]).toContain(res.status())
  })
})

test.describe('Gamification — Pages redirect', () => {
  test('boutique redirects to login', async ({ page }) => {
    await page.goto('/boutique')
    await page.waitForURL(/login/)
    expect(page.url()).toContain('login')
  })

  test('achievements redirects to login', async ({ page }) => {
    await page.goto('/achievements')
    await page.waitForURL(/login/)
    expect(page.url()).toContain('login')
  })

  test('community redirects to login', async ({ page }) => {
    await page.goto('/community')
    await page.waitForURL(/login/)
    expect(page.url()).toContain('login')
  })

  test('lottery redirects to login', async ({ page }) => {
    await page.goto('/lottery')
    await page.waitForURL(/login/)
    expect(page.url()).toContain('login')
  })

  test('wallet redirects to login', async ({ page }) => {
    await page.goto('/wallet')
    await page.waitForURL(/login/)
    expect(page.url()).toContain('login')
  })

  test('referral redirects to login', async ({ page }) => {
    await page.goto('/referral')
    await page.waitForURL(/login/)
    expect(page.url()).toContain('login')
  })
})

test.describe('Community — API endpoints', () => {
  test('GET /api/community/wall requires auth', async ({ request }) => {
    const res = await request.get('/api/community/wall')
    expect([401, 403]).toContain(res.status())
  })

  test('GET /api/community/circles requires auth', async ({ request }) => {
    const res = await request.get('/api/community/circles')
    expect([401, 403]).toContain(res.status())
  })

  test('GET /api/community/buddy requires auth', async ({ request }) => {
    const res = await request.get('/api/community/buddy')
    expect([401, 403]).toContain(res.status())
  })
})
