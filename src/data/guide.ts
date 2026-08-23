import {
  LayoutDashboard,
  Video,
  Film,
  Share2,
  Trophy,
  Users,
  Wallet,
  HelpCircle,
  Palette,
  BarChart3,
} from 'lucide-react'

export interface GuideSection {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  color: string
  steps?: string[]
}

export const sections: GuideSection[] = [
  {
    icon: LayoutDashboard,
    title: 'Ton Dashboard',
    description: 'Le tableau de bord te donne une vue complete de ton activite : videos creees ce mois-ci, credits disponibles, et tes dernieres creations.',
    color: 'violet',
  },
  {
    icon: Video,
    title: 'Comment creer ta premiere video',
    description: 'En quelques clics, SUTRA genere une video complete avec script, voix, musique et visuels.',
    color: 'cyan',
    steps: [
      'Clique sur "Creer" dans le menu',
      'Decris ton idee en quelques mots (ex: "Une video motivationnelle sur le sport")',
      'Choisis un style et un format (YouTube, TikTok, Instagram...)',
      'SUTRA genere le script, la voix off, la musique et les visuels',
      'Previsualise, modifie si besoin, puis telecharge ou publie',
    ],
  },
  {
    icon: Palette,
    title: 'Les styles disponibles',
    description: 'SUTRA propose plusieurs styles pour tes videos, chacun avec son ambiance unique.',
    color: 'purple',
    steps: [
      'Cinematique : plans larges, narration profonde, ideal pour le storytelling',
      'Dynamique : montage rapide, parfait pour les reseaux sociaux',
      'Educatif : structure claire, ideal pour les tutoriels',
      'Motivationnel : musique inspirante, images fortes',
      'Lo-fi : ambiance relaxante, parfait pour les compilations',
    ],
  },
  {
    icon: Film,
    title: 'Ta bibliotheque',
    description: 'Toutes tes videos sont rangees dans la bibliotheque. Tu peux les filtrer, les rechercher, les re-editer ou les supprimer.',
    color: 'blue',
  },
  {
    icon: Share2,
    title: 'Publier et partager',
    description: 'Publie tes videos directement sur tes reseaux sociaux depuis SUTRA, ou programme-les a l\'avance.',
    color: 'emerald',
    steps: [
      'Connecte tes comptes (YouTube, TikTok, Instagram)',
      'Selectionne la video a publier',
      'Ajoute un titre, une description et des tags',
      'Publie instantanement ou programme une date',
    ],
  },
  {
    icon: Users,
    title: 'Gagner avec le parrainage',
    description: 'Invite tes amis et gagne des commissions sur chaque abonnement souscrit.',
    color: 'pink',
    steps: [
      'Copie ton lien de parrainage depuis l\'onglet Parrainage',
      'Ton ami s\'inscrit et beneficie de -50% sur son premier mois',
      'Tu gagnes 50% de son premier paiement + 10% des suivants',
      'Atteins des paliers pour debloquer des bonus (30% tous les 10 filleuls)',
    ],
  },
  {
    icon: Trophy,
    title: 'Les concours et classements',
    description: 'Participe aux concours de creation pour remporter des reductions et des prix exclusifs.',
    color: 'amber',
    steps: [
      'Concours hebdomadaire : soumets ta meilleure video de la semaine',
      'L\'IA juge chaque creation sur 5 criteres (100 points max)',
      'Top 10 gagne des parts du prize pool (2% du CA hebdo)',
      'Concours mensuel : prize pool de 5% du CA du mois',
    ],
  },
  {
    icon: BarChart3,
    title: 'Le classement',
    description: 'Compare tes performances avec les autres createurs. Monte dans le classement en participant aux concours et en creant des videos de qualite.',
    color: 'teal',
  },
  {
    icon: Wallet,
    title: 'Gerer ton wallet',
    description: 'Tes gains de parrainage et concours s\'accumulent dans ton wallet.',
    color: 'green',
    steps: [
      'Consulte ton solde dans l\'onglet Wallet',
      'Demande un retrait a partir de 10 euros',
      'Retrait par virement bancaire (IBAN)',
      'Maximum 1 retrait par jour, entre 10 et 1000 euros',
    ],
  },
  {
    icon: HelpCircle,
    title: 'FAQ rapide',
    description: '',
    color: 'slate',
    steps: [
      'Combien de videos puis-je creer ? Selon ton plan : 5 (Free) a illimite (Empire)',
      'Puis-je modifier une video apres generation ? Oui, via l\'editeur integre',
      'Comment changer mon plan ? Dans Parametres > Abonnement',
      'Les paiements sont-ils securises ? Oui, via Stripe (carte, PayPal, Link)',
      'Comment contacter le support ? Via le Centre d\'aide ou l\'email de support',
    ],
  },
]

export const colorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-400', glow: 'shadow-violet-500/10' },
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', glow: 'shadow-cyan-500/10' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', glow: 'shadow-purple-500/10' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', glow: 'shadow-blue-500/10' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
  pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/20', text: 'text-pink-400', glow: 'shadow-pink-500/10' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', glow: 'shadow-amber-500/10' },
  teal: { bg: 'bg-teal-500/10', border: 'border-teal-500/20', text: 'text-teal-400', glow: 'shadow-teal-500/10' },
  green: { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400', glow: 'shadow-green-500/10' },
  slate: { bg: 'bg-white/5', border: 'border-white/10', text: 'text-white/70', glow: 'shadow-white/5' },
}
