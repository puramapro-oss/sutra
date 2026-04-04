import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Statut des services',
  description: 'Etat en temps reel des services SUTRA : API, Supabase, Stripe, ElevenLabs.',
}

export default function Layout({ children }: { children: React.ReactNode }) { return children }
