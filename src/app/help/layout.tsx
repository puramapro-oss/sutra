import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Centre d\'aide',
  description: 'Guides, FAQ et support pour SUTRA. Apprends a creer des videos IA, gerer ton compte et utiliser le parrainage.',
}

export default function Layout({ children }: { children: React.ReactNode }) { return children }
