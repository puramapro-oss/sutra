import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Hors ligne',
  description: 'Tu es actuellement hors ligne. Verifie ta connexion internet.',
}

export default function Layout({ children }: { children: React.ReactNode }) { return children }
