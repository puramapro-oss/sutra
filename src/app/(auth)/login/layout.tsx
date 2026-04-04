import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Connecte-toi a SUTRA pour generer des videos par IA.',
}

export default function Layout({ children }: { children: React.ReactNode }) { return children }
