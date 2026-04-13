import type { Metadata } from 'next'
import Link from 'next/link'
import AppWelcome from '@/components/landing/AppWelcome'

export const metadata: Metadata = {
  title: 'SUTRA — Genere des videos IA en quelques minutes',
  description:
    'SUTRA est la plateforme de generation de videos par IA. Donne un sujet, recois une video prete a publier avec script, voix, visuels et musique. Zero effort.',
  keywords: [
    'video IA',
    'generation video',
    'intelligence artificielle',
    'creation contenu',
    'video automatique',
    'TikTok',
    'YouTube',
    'createur contenu',
    'SUTRA',
    'Purama',
  ],
  openGraph: {
    title: 'SUTRA — Genere des videos IA en quelques minutes',
    description:
      'Donne un sujet. Recois une video prete a publier. Script, voix, visuels, musique — tout est genere par IA.',
    url: 'https://sutra.purama.dev',
    siteName: 'SUTRA by Purama',
    type: 'website',
    locale: 'fr_FR',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'SUTRA — Generation de videos par IA',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SUTRA — Genere des videos IA en quelques minutes',
    description:
      'Donne un sujet. Recois une video prete a publier. Zero effort.',
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
