import { test, expect } from '@playwright/test'

const BASE = 'https://sutra.purama.dev'

const PAGES = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/pricing',
  '/how-it-works',
  '/ecosystem',
  '/help',
  '/aide',
  '/status',
  '/changelog',
  '/mentions-legales',
  '/politique-confidentialite',
  '/cgv',
  '/cgu',
  '/legal',
  '/partenariat',
]

test.describe('No dead internal links', () => {
  for (const path of PAGES) {
    test(`${path} - all internal links are reachable`, async ({ page, request }) => {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
      const hrefs = await page.$$eval('a[href]', (els) =>
        Array.from(new Set(els.map((e) => (e as HTMLAnchorElement).getAttribute('href') || '')))
      )
      const internal = hrefs
        .filter((h) => h.startsWith('/') && !h.startsWith('//') && !h.startsWith('/#'))
        .map((h) => h.split('#')[0])
        .filter((h, i, arr) => arr.indexOf(h) === i)
        .filter((h) => h.length > 0)

      const broken: string[] = []
      for (const link of internal) {
        // Skip dynamic param routes that need real IDs
        if (/\[/.test(link)) continue
        const res = await request.get(`${BASE}${link}`, { maxRedirects: 5 })
        if (res.status() >= 400) {
          broken.push(`${link} -> ${res.status()}`)
        }
      }
      expect(broken, `Broken links on ${path}:\n${broken.join('\n')}`).toEqual([])
    })
  }
})
