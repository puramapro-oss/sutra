'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Video,
  Film,
  Share2,
  Trophy,
  Users,
  Wallet,
  HelpCircle,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Palette,
  Zap,
  Gift,
  BarChart3,
} from 'lucide-react'

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 25, stiffness: 300 } },
}

interface GuideSection {
  icon: React.ElementType
  title: string
  description: string
  color: string
  steps?: string[]
}

const sections: GuideSection[] = [
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

const colorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
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

export default function GuidePage() {
  const relaunchTutorial = useCallback(() => {
    localStorage.removeItem('sutra_tutorial_dismissed')
    window.dispatchEvent(new Event('sutra-relaunch-tutorial'))
    window.location.href = '/dashboard'
  }, [])

  return (
    <div className="min-h-dvh bg-[#06050e]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#06050e]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors"
            data-testid="guide-back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Retour</span>
          </Link>
          <button
            onClick={relaunchTutorial}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/20 text-violet-300 text-sm font-medium rounded-xl transition-colors"
            data-testid="guide-relaunch"
          >
            <RotateCcw className="w-4 h-4" />
            Relancer le tuto
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm mb-6">
            <Sparkles className="w-4 h-4" />
            Guide complet
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Tout savoir sur{' '}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              SUTRA
            </span>
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Decouvre chaque fonctionnalite et deviens un pro de la creation video IA.
          </p>
        </motion.div>

        {/* Quick stats */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3 mb-12"
        >
          {[
            { icon: Zap, label: 'Generation IA', value: '< 3 min' },
            { icon: Gift, label: 'Essai gratuit', value: '5 videos' },
            { icon: Share2, label: 'Reseaux', value: '3 plateformes' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="text-center p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]"
            >
              <stat.icon className="w-5 h-5 text-violet-400 mx-auto mb-2" />
              <div className="text-lg font-semibold text-white">{stat.value}</div>
              <div className="text-xs text-white/40">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Sections */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {sections.map((section, i) => {
            const colors = colorMap[section.color] ?? colorMap.slate
            const Icon = section.icon

            return (
              <motion.div
                key={i}
                variants={fadeUp}
                className={`rounded-2xl border ${colors.border} ${colors.bg} p-6 shadow-lg ${colors.glow}`}
                data-testid={`guide-section-${i}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl ${colors.bg} border ${colors.border} shrink-0`}>
                    <Icon className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      {section.title}
                    </h2>
                    {section.description && (
                      <p className="text-sm text-white/50 leading-relaxed mb-3">
                        {section.description}
                      </p>
                    )}
                    {section.steps && (
                      <ol className="space-y-2">
                        {section.steps.map((step, j) => (
                          <li key={j} className="flex items-start gap-3 text-sm">
                            <span className={`w-5 h-5 rounded-full ${colors.bg} border ${colors.border} flex items-center justify-center shrink-0 text-xs ${colors.text} font-medium mt-0.5`}>
                              {j + 1}
                            </span>
                            <span className="text-white/60 leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center py-12"
        >
          <Link
            href="/create"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-violet-500/20"
            data-testid="guide-cta"
          >
            <Video className="w-5 h-5" />
            Creer ma premiere video
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
