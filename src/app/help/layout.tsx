import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Centre d\'aide — SUTRA',
  description: 'Guides, FAQ et support pour SUTRA. Apprends a creer des videos IA, gerer ton compte et utiliser le parrainage.',
  openGraph: {
    title: 'Centre d\'aide — SUTRA',
    description: 'Guides, FAQ et support pour SUTRA.',
    url: 'https://sutra.purama.dev/help',
    images: [{ url: 'https://sutra.purama.dev/api/og', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
}

export default function Layout({ children }: { children: React.ReactNode }) { return children }
