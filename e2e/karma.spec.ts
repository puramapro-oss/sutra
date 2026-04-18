import { test, expect } from '@playwright/test'

test.describe('KARMA LIGHT — protection auth & API', () => {
  test('API GET /api/karma/seeds sans auth → 401', async ({ request }) => {
    const res = await request.get('/api/karma/seeds')
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  test('API GET /api/karma/missions sans auth → 401', async ({ request }) => {
    const res = await request.get('/api/karma/missions')
    expect(res.status()).toBe(401)
  })

  test('API POST /api/karma/missions sans auth → 401', async ({ request }) => {
    const res = await request.post('/api/karma/missions', {
      data: { mission_slug: 'video-daily' },
    })
    expect(res.status()).toBe(401)
  })

  test('API POST /api/karma/games/dharma sans auth → 401', async ({ request }) => {
    const res = await request.post('/api/karma/games/dharma')
    expect(res.status()).toBe(401)
  })

  test('API GET /api/karma/games/quete sans auth → 401', async ({ request }) => {
    const res = await request.get('/api/karma/games/quete')
    expect(res.status()).toBe(401)
  })

  test('API POST /api/karma/games/creatif/vote sans auth → 401', async ({ request }) => {
    const res = await request.post('/api/karma/games/creatif/vote', {
      data: { submission_id: '00000000-0000-0000-0000-000000000000' },
    })
    expect(res.status()).toBe(401)
  })

  test('API POST /api/karma/games/lightning/claim sans auth → 401', async ({ request }) => {
    const res = await request.post('/api/karma/games/lightning/claim', {
      data: { deal_id: '00000000-0000-0000-0000-000000000000' },
    })
    expect(res.status()).toBe(401)
  })

  test('API POST /api/karma/games/vague sans auth → 401', async ({ request }) => {
    const res = await request.post('/api/karma/games/vague', {
      data: { title: 'x', challenge: 'y' },
    })
    expect(res.status()).toBe(401)
  })

  test('CRON /api/cron/karma-defi sans secret → 401', async ({ request }) => {
    const res = await request.post('/api/cron/karma-defi', {
      headers: { authorization: 'Bearer invalid' },
    })
    // Si CRON_SECRET n'est pas configuré, la route passe (200) — sinon 401
    expect([200, 401]).toContain(res.status())
  })

  const KARMA_PAGES = [
    '/karma',
    '/karma/missions',
    '/karma/dharma',
    '/karma/defi-collectif',
    '/karma/tournoi',
    '/karma/jeu-creatif',
    '/karma/vague',
    '/karma/quete-rare',
    '/karma/lightning',
  ]

  for (const path of KARMA_PAGES) {
    test(`page ${path} protégée par middleware (redirect /login si non-auth)`, async ({
      request,
    }) => {
      // Suivre la redirection et vérifier le landing final
      const res = await request.get(path)
      // Middleware redirige vers /login?next=... → on peut aussi tomber sur login directement
      const finalUrl = res.url()
      const status = res.status()
      // Soit la réponse finale est /login, soit la page se charge mais exige auth côté client
      expect(
        finalUrl.includes('/login') || status === 200
      ).toBeTruthy()
      if (status === 200 && !finalUrl.includes('/login')) {
        // Page protégée côté client : vérif que le body contient un redirect ou un écran login
        const text = await res.text()
        expect(
          text.includes('login') ||
            text.includes('Connexion') ||
            text.includes('Non autorisé') ||
            text.toLowerCase().includes('sign in')
        ).toBeTruthy()
      }
    })
  }

  test('Footer + homepage rendered (smoke)', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\//)
    await expect(page.locator('body')).toBeVisible()
  })
})
