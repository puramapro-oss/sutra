import {
  Type,
  DollarSign,
  Users,
  Trophy,
  Megaphone,
  Mail,
} from 'lucide-react'
import { ConfigSection } from './types'

export const DEFAULT_CONFIG: ConfigSection[] = [
  {
    key: 'landing',
    label: 'Page d\'accueil',
    icon: Type,
    fields: [
      { key: 'hero_title', label: 'Titre hero', type: 'text', value: 'Cree des videos virales avec l\'IA', placeholder: 'Titre principal de la landing...' },
      { key: 'hero_subtitle', label: 'Sous-titre hero', type: 'text', value: 'De l\'idee a la publication en 3 minutes', placeholder: 'Sous-titre accrocheur...' },
    ],
  },
  {
    key: 'plans',
    label: 'Prix des plans',
    icon: DollarSign,
    fields: [
      { key: 'starter_monthly', label: 'Starter (mensuel)', type: 'number', value: 9.99, suffix: 'EUR/mois' },
      { key: 'starter_yearly', label: 'Starter (annuel)', type: 'number', value: 6.69, suffix: 'EUR/mois' },
      { key: 'creator_monthly', label: 'Creator (mensuel)', type: 'number', value: 29.99, suffix: 'EUR/mois' },
      { key: 'creator_yearly', label: 'Creator (annuel)', type: 'number', value: 20.09, suffix: 'EUR/mois' },
      { key: 'empire_monthly', label: 'Empire (mensuel)', type: 'number', value: 79.99, suffix: 'EUR/mois' },
      { key: 'empire_yearly', label: 'Empire (annuel)', type: 'number', value: 53.59, suffix: 'EUR/mois' },
    ],
  },
  {
    key: 'limits',
    label: 'Limites par plan',
    icon: Users,
    fields: [
      { key: 'free_videos', label: 'Free (videos/mois)', type: 'number', value: 2 },
      { key: 'starter_videos', label: 'Starter (videos/mois)', type: 'number', value: 15 },
      { key: 'creator_videos', label: 'Creator (videos/mois)', type: 'number', value: 60 },
      { key: 'empire_videos', label: 'Empire (videos/mois)', type: 'number', value: 999 },
    ],
  },
  {
    key: 'referral',
    label: 'Commissions parrainage',
    icon: Users,
    fields: [
      { key: 'filleul_discount', label: 'Reduction filleul', type: 'number', value: 50, suffix: '%' },
      { key: 'first_payment_commission', label: 'Commission 1er paiement', type: 'number', value: 50, suffix: '%' },
      { key: 'recurring_commission', label: 'Commission recurrente', type: 'number', value: 10, suffix: '%' },
      { key: 'own_discount', label: 'Reduction propre abo', type: 'number', value: 10, suffix: '%' },
      { key: 'milestone_bonus', label: 'Bonus palier (/10)', type: 'number', value: 30, suffix: '%' },
    ],
  },
  {
    key: 'contest',
    label: 'Concours & Tirages',
    icon: Trophy,
    fields: [
      { key: 'weekly_prize_pool', label: 'Pool hebdo (% CA)', type: 'number', value: 2, suffix: '%' },
      { key: 'monthly_prize_pool', label: 'Pool mensuel (% CA)', type: 'number', value: 5, suffix: '%' },
    ],
  },
  {
    key: 'announcement',
    label: 'Banniere d\'annonce',
    icon: Megaphone,
    fields: [
      { key: 'banner_text', label: 'Texte de la banniere', type: 'text', value: '', placeholder: 'Annonce visible par tous les utilisateurs...' },
      { key: 'banner_active', label: 'Banniere active', type: 'toggle', value: false },
    ],
  },
  {
    key: 'emails',
    label: 'Sujets emails',
    icon: Mail,
    fields: [
      { key: 'email_welcome', label: 'Bienvenue', type: 'text', value: 'Bienvenue sur SUTRA !', placeholder: 'Sujet email...' },
      { key: 'email_subscription', label: 'Abonnement', type: 'text', value: 'Votre abonnement SUTRA est actif', placeholder: 'Sujet email...' },
      { key: 'email_commission', label: 'Commission', type: 'text', value: 'Nouvelle commission creditee', placeholder: 'Sujet email...' },
      { key: 'email_weekly_recap', label: 'Recap hebdo', type: 'text', value: 'Votre semaine SUTRA en resume', placeholder: 'Sujet email...' },
    ],
  },
]
