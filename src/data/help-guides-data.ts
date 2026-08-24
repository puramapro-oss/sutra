import { Video, Palette, Send, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface GuideStep {
  title: string
  content: string
}

export interface DetailedGuide {
  id: string
  title: string
  icon: LucideIcon
  iconColor: string
  bgColor: string
  borderColor: string
  steps: GuideStep[]
}

export const detailedGuides: DetailedGuide[] = [
  {
    id: 'guide-premiere-video',
    title: 'Creer ta premiere video',
    icon: Video,
    iconColor: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
    steps: [
      {
        title: 'Etape 1 — Choisis ton sujet.',
        content:
          'Depuis le dashboard, clique sur "Creer une video". Decris ton sujet en une ou deux phrases. Par exemple : "5 astuces pour mieux dormir" ou "Les tendances mode ete 2026". Plus tu es precis, meilleur sera le resultat.',
      },
      {
        title: 'Etape 2 — Configure les options.',
        content:
          'Choisis le format (16:9 pour YouTube, 9:16 pour TikTok), la qualite (selon ton plan), et la voix. Tu peux ecouter un apercu de chaque voix avant de choisir.',
      },
      {
        title: 'Etape 3 — Genere.',
        content:
          'Clique sur "Generer". Notre pipeline IA travaille en 5 etapes : script, voix, visuels, musique, montage. Tu suis la progression en temps reel. La generation prend 3 a 8 minutes.',
      },
      {
        title: 'Etape 4 — Revise et publie.',
        content:
          'Une fois ta video prete, tu peux la previsualiser, la telecharger, ou la publier directement depuis SUTRA. Avec le plan Creator+, tu accedes a SUTRA Studio pour modifier chaque element.',
      },
    ],
  },
  {
    id: 'guide-styles',
    title: 'Les styles de videos disponibles',
    icon: Palette,
    iconColor: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    steps: [
      {
        title: 'Cinematique.',
        content:
          'Style narratif inspiré des documentaires Netflix. Visuels immersifs, musique orchestrale, narration posée. Parfait pour les sujets sérieux, historiques ou inspirants.',
      },
      {
        title: 'Dynamique.',
        content:
          'Rythme rapide, transitions percutantes, musique énergique. Idéal pour TikTok, les tops 5/10, et les sujets tendance.',
      },
      {
        title: 'Educatif.',
        content:
          'Structure claire avec introduction, points clés et conclusion. Graphiques et schémas animés. Parfait pour les tutoriels et les explications.',
      },
      {
        title: 'Motivationnel.',
        content:
          'Visuels inspirants, musique épique, narration puissante. Pour les contenus développement personnel et motivation.',
      },
      {
        title: 'Lo-fi / Chill.',
        content:
          'Ambiance relaxante, visuels doux, musique lo-fi. Pour les contenus lifestyle, bien-être et méditation.',
      },
      {
        title: 'Corporate.',
        content:
          'Ton professionnel, visuels sobres, structure business. Pour les présentations, pitchs et contenus B2B.',
      },
    ],
  },
  {
    id: 'guide-publier',
    title: 'Publier et partager',
    icon: Send,
    iconColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    steps: [
      {
        title: 'Telecharger.',
        content:
          'Depuis ta bibliotheque, clique sur une video puis "Telecharger". Tu obtiens un fichier MP4 haute qualite que tu peux utiliser partout.',
      },
      {
        title: 'Publier directement.',
        content:
          'Avec la fonction Publier (plan Creator+), connecte tes comptes YouTube, TikTok et Instagram. SUTRA publie ta video en un clic avec le titre, la description et les hashtags optimises par IA.',
      },
      {
        title: 'Planifier.',
        content:
          "Programme tes publications a l'avance. Choisis la date et l'heure, et SUTRA publie automatiquement au moment optimal. L'Autopilot (plan Empire) planifie et genere des series entieres.",
      },
      {
        title: 'Partager.',
        content:
          'Chaque video a un lien de partage unique. Tu peux aussi exporter le script, les sous-titres (SRT), ou le storyboard separement.',
      },
    ],
  },
  {
    id: 'guide-parrainage',
    title: 'Parrainage et Wallet',
    icon: Users,
    iconColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    steps: [
      {
        title: 'Ton code de parrainage.',
        content:
          'Chaque compte SUTRA recoit un code unique (format SUTRA-XXXXX). Tu le trouves dans la page Parrainage. Partage-le ou utilise ton lien personnalise.',
      },
      {
        title: 'Avantages filleul.',
        content:
          "Ton filleul obtient -50% sur son premier mois d'abonnement payant. Le code s'applique automatiquement a l'inscription.",
      },
      {
        title: 'Tes commissions.',
        content:
          "Tu recois 50% du premier paiement de chaque filleul + 10% recurrent chaque mois tant qu'il est abonne. Tous les 10 filleuls, tu debloques un bonus de 30%.",
      },
      {
        title: 'Paliers.',
        content:
          '6 niveaux de parrainage : Bronze (5 filleuls), Argent (10), Or (25), Platine (50), Diamant (75), Legende (100). Chaque palier debloque des avantages supplementaires.',
      },
      {
        title: 'Wallet et retrait.',
        content:
          'Tous tes gains (parrainage + concours) sont credites sur ton wallet SUTRA. Tu peux retirer a partir de 5 EUR par virement bancaire IBAN. Les retraits sont traites sous 48h.',
      },
      {
        title: 'Places concours.',
        content:
          'Chaque inscription te donne 1 place pour les tirages au sort. Chaque parrainage donne +1 place au parrain ET au filleul. Plus tu parraines, plus tu as de chances de gagner.',
      },
    ],
  },
]
