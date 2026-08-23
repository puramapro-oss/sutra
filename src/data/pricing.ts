import { Sparkles, Crown, Zap, Rocket } from 'lucide-react'

export interface PlanFeature {
  text: string
  included: boolean
}

export interface Plan {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  monthlyPrice: number
  annualPrice: number
  description: string
  features: PlanFeature[]
  popular?: boolean
  cta: string
  href: string
}

export const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    icon: Zap,
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'Decouvre SUTRA sans engagement',
    features: [
      { text: '2 videos / mois', included: true },
      { text: 'Qualite 720p', included: true },
      { text: '3 templates', included: true },
      { text: 'Voix standard', included: true },
      { text: 'Filigrane SUTRA', included: true },
      { text: 'Voix clonees', included: false },
      { text: 'SUTRA Studio', included: false },
      { text: 'Publication directe', included: false },
    ],
    cta: 'Commencer gratuitement',
    href: '/signup',
  },
  {
    id: 'starter',
    name: 'Starter',
    icon: Sparkles,
    monthlyPrice: 9,
    annualPrice: 86,
    description: 'Pour les createurs qui demarrent',
    features: [
      { text: '10 videos / mois', included: true },
      { text: 'Qualite 720p', included: true },
      { text: '10 templates', included: true },
      { text: 'Voix premium', included: true },
      { text: 'Sans filigrane', included: true },
      { text: '1 reseau social', included: true },
      { text: 'Voix clonees', included: false },
      { text: 'SUTRA Studio', included: false },
    ],
    cta: 'Commencer',
    href: '/signup?plan=starter',
  },
  {
    id: 'creator',
    name: 'Createur',
    icon: Rocket,
    monthlyPrice: 29,
    annualPrice: 278,
    description: 'Pour les createurs serieux',
    popular: true,
    features: [
      { text: '50 videos / mois', included: true },
      { text: 'Qualite 1080p', included: true },
      { text: 'Templates illimites', included: true },
      { text: '3 voix clonees', included: true },
      { text: 'SUTRA Studio complet', included: true },
      { text: '3 reseaux sociaux', included: true },
      { text: '1 Autopilot', included: true },
      { text: 'Support prioritaire', included: true },
    ],
    cta: 'Choisir Createur',
    href: '/signup?plan=creator',
  },
  {
    id: 'empire',
    name: 'Empire',
    icon: Crown,
    monthlyPrice: 99,
    annualPrice: 950,
    description: 'Pour les empires de contenu',
    features: [
      { text: 'Videos illimitees', included: true },
      { text: 'Qualite 4K', included: true },
      { text: 'Templates illimites', included: true },
      { text: 'Voix illimitees', included: true },
      { text: 'SUTRA Studio + Export', included: true },
      { text: 'Reseaux illimites', included: true },
      { text: '5 Autopilots', included: true },
      { text: 'Support VIP 24/7', included: true },
    ],
    cta: 'Choisir Empire',
    href: '/signup?plan=empire',
  },
]
