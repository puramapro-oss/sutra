import { test, expect } from '@playwright/test'

test.describe('V7 — Cross-promo /go/[source]?coupon=WELCOME50', () => {
  test('GET /go/midas?coupon=WELCOME50 → sets purama_promo cookie and redirects to /signup', async ({
    context,
    request,
  }) => {
    const res = await request.get('/go/midas?coupon=WELCOME50', { maxRedirects: 0 })
    expect(res.status()).toBe(302)
    const location = res.headers()['location']
    expect(location).toContain('/signup')
    expect(location).toContain('promo=WELCOME50')
    expect(location).toContain('src=midas')

    const cookies = await context.cookies()
    const promo = cookies.find((c) => c.name === 'purama_promo')
    expect(promo).toBeDefined()
    expect(promo!.value).toContain('WELCOME50')
    expect(promo!.value).toContain('midas')
  })

  test('GET /go/kash?coupon=WELCOME50 → valid source_app accepted', async ({ request }) => {
    const res = await request.get('/go/kash?coupon=WELCOME50', { maxRedirects: 0 })
    expect(res.status()).toBe(302)
    expect(res.headers()['location']).toContain('/signup')
  })

  test('GET /go/akasha?coupon=WELCOME50 → AKASHA source accepted', async ({ request }) => {
    const res = await request.get('/go/akasha?coupon=WELCOME50', { maxRedirects: 0 })
    expect(res.status()).toBe(302)
    expect(res.headers()['location']).toContain('promo=WELCOME50')
  })

  test('GET /go/unknown-source?coupon=WELCOME50 → falls back to influencer/referral lookup', async ({
    request,
  }) => {
    const res = await request.get('/go/definitely-not-an-app?coupon=WELCOME50', {
      maxRedirects: 0,
    })
    expect(res.status()).toBe(302)
    expect(res.headers()['location']).not.toContain('promo=')
  })

  test('GET /go/midas without coupon → influencer/referral fallback, no cookie set', async ({
    context,
    request,
  }) => {
    await context.clearCookies()
    const res = await request.get('/go/midas', { maxRedirects: 0 })
    expect(res.status()).toBe(302)
    const cookies = await context.cookies()
    const promo = cookies.find((c) => c.name === 'purama_promo')
    expect(promo).toBeUndefined()
  })

  test('GET /go/midas?coupon=INVALID123 → coupon ignored, no cookie set', async ({
    context,
    request,
  }) => {
    await context.clearCookies()
    const res = await request.get('/go/midas?coupon=INVALID123', { maxRedirects: 0 })
    expect(res.status()).toBe(302)
    const cookies = await context.cookies()
    const promo = cookies.find((c) => c.name === 'purama_promo')
    expect(promo).toBeUndefined()
  })

  test('cookie purama_promo has sameSite=lax and 7-day max-age', async ({ request }) => {
    const res = await request.get('/go/sutra?coupon=WELCOME50', { maxRedirects: 0 })
    const setCookie = res.headers()['set-cookie'] ?? ''
    expect(setCookie.toLowerCase()).toContain('samesite=lax')
    expect(setCookie.toLowerCase()).toContain('max-age=604800')
  })
})
