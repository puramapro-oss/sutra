import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://sutra.purama.dev').trim()

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/dashboard', '/create', '/editor', '/settings'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
