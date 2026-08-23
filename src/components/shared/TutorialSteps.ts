export interface TutorialStep {
  selector: string
  title: string
  description: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    selector: '[data-testid="sidebar-dashboard"], [data-testid="mobile-dashboard"]',
    title: 'Bienvenue sur SUTRA',
    description: 'Ton dashboard te donne un apercu complet : videos creees, credits restants et activite recente.',
    position: 'right',
  },
  {
    selector: '[data-testid="sidebar-create"], [data-testid="mobile-create"]',
    title: 'Creer une video',
    description: 'Decris ton idee, choisis un style et SUTRA genere une video complete avec voix, musique et visuels.',
    position: 'right',
  },
  {
    selector: '[data-testid="sidebar-library"], [data-testid="mobile-library"]',
    title: 'Tes videos',
    description: 'Retrouve toutes tes creations ici. Tu peux les modifier, telecharger ou publier en un clic.',
    position: 'right',
  },
  {
    selector: '[data-testid="sidebar-publish"], [data-testid="mobile-publish"]',
    title: 'Publier',
    description: 'Partage tes videos sur YouTube, TikTok et Instagram directement depuis SUTRA.',
    position: 'right',
  },
  {
    selector: '[data-testid="sidebar-contest"]',
    title: 'Concours',
    description: 'Participe aux concours hebdomadaires et mensuels pour gagner des reductions et des prix.',
    position: 'right',
  },
  {
    selector: '[data-testid="sidebar-referral"]',
    title: 'Parrainage',
    description: 'Invite tes amis et gagne des commissions sur leurs abonnements. -50% pour eux, des gains pour toi.',
    position: 'right',
  },
  {
    selector: '[data-testid="sidebar-settings"], [data-testid="mobile-profile"]',
    title: 'Profil et Reglages',
    description: 'Personnalise ton experience : theme, preferences de voix, qualite video et notifications.',
    position: 'right',
  },
]
