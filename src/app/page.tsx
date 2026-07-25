import type { Metadata } from 'next'
import Link from 'next/link'
import AppWelcome from '@/components/landing/AppWelcome'

export const metadata: Metadata = {
  title: 'SUTRA — Génère des vidéos IA en quelques minutes',
  description:
    'SUTRA est la plateforme de génération de vidéos par IA. Donne un sujet, reçois une vidéo prête à publier avec script, voix, visuels et musique. Zéro effort.',
  keywords: [
    'vidéo IA',
    'génération vidéo',
    'intelligence artificielle',
    'création contenu',
    'vidéo automatique',
    'TikTok',
    'YouTube',
    'créateur contenu',
    'SUTRA',
    'Purama',
  ],
  openGraph: {
    title: 'SUTRA — Génère des vidéos IA en quelques minutes',
    description:
      'Donne un sujet. Reçois une vidéo prête à publier. Script, voix, visuels, musique — tout est généré par IA.',
    url: 'https://sutra.purama.dev',
    siteName: 'SUTRA by Purama',
    type: 'website',
    locale: 'fr_FR',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'SUTRA — Génération de vidéos par IA',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SUTRA — Génère des vidéos IA en quelques minutes',
    description:
      'Donne un sujet. Reçois une vidéo prête à publier. Zéro effort.',
    images: ['/api/og'],
  },
  alternates: {
    canonical: 'https://sutra.purama.dev',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function LandingPage() {
  return <AppWelcome />
}
