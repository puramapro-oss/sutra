import type { Metadata } from 'next'
import DevenirAmbassadeurClient from './DevenirAmbassadeurClient'

export const metadata: Metadata = {
  title: 'Devenir Ambassadeur · SUTRA',
  description:
    'Rejoins le programme Ambassadeur Purama. 9 paliers, jusqu\'à 200 000 € de primes, commissions à vie sur 3 niveaux.',
}

export default function DevenirAmbassadeurPage() {
  return <DevenirAmbassadeurClient />
}
