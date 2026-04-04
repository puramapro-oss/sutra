'use client'

import { useState, useRef } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  Send,
  CheckCircle2,
  AlertCircle,
  Video,
  Mic,
  Palette,
  Wand2,
  CreditCard,
  Users,
  Shield,
  Zap,
  BookOpen,
  MessageCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface FAQItem {
  question: string
  answer: string
  category: string
}

const faqs: FAQItem[] = [
  {
    category: 'general',
    question: "Qu'est-ce que SUTRA ?",
    answer:
      "SUTRA est une plateforme de generation de videos par intelligence artificielle. Tu donnes un sujet, et notre pipeline IA genere automatiquement le script, la voix off, les visuels, la musique et le montage final. Le resultat : une video prete a publier en quelques minutes.",
  },
  {
    category: 'general',
    question: 'Comment ca marche concretement ?',
    answer:
      "C'est simple : 1) Tu decris ton sujet ou idee. 2) Notre IA genere un script optimise. 3) Une voix off naturelle est creee. 4) Des visuels uniques sont generes pour chaque scene. 5) Une musique originale est composee. 6) Le tout est assemble en une video finale avec sous-titres et transitions professionnelles.",
  },
  {
    category: 'creation',
    question: 'Quelle est la qualite des videos generees ?',
    answer:
      "La qualite depend de ton plan : 720p pour Free et Starter, 1080p pour Createur, et 4K pour Empire. Les visuels sont generes par IA de pointe, les voix sont ultra-realistes, et le montage est professionnel. Tu peux aussi affiner chaque element dans SUTRA Studio.",
  },
  {
    category: 'creation',
    question: 'Combien de temps prend la generation ?',
    answer:
      "La generation complete d'une video prend generalement entre 3 et 8 minutes selon la duree et la complexite. Tu recois une notification des que ta video est prete. Tu peux suivre la progression en temps reel depuis ton dashboard.",
  },
  {
    category: 'creation',
    question: 'Puis-je modifier la video apres generation ?',
    answer:
      "Oui, avec SUTRA Studio (disponible a partir du plan Createur), tu peux modifier le script, changer les visuels scene par scene, ajuster la musique, repositionner les sous-titres, et re-generer des elements individuels. C'est un editeur complet integre.",
  },
  {
    category: 'voix',
    question: 'Les voix sont-elles vraiment realistes ?',
    answer:
      "Oui, nous utilisons la technologie de synthese vocale la plus avancee du marche. Plus de 30 voix naturelles sont disponibles, avec emotions et intonations. A partir du plan Createur, tu peux meme cloner ta propre voix pour un rendu encore plus personnel.",
  },
  {
    category: 'voix',
    question: 'Comment fonctionne le clonage de voix ?',
    answer:
      "Le clonage de voix te permet de creer une replique numerique de ta propre voix. Il suffit de fournir un echantillon audio de quelques minutes. Notre IA analyse ta voix et cree un modele qui peut ensuite lire n'importe quel texte avec ton timbre, ton rythme et tes intonations. Disponible a partir du plan Createur.",
  },
  {
    category: 'abonnement',
    question: 'Combien coute SUTRA ?',
    answer:
      "SUTRA propose un plan gratuit avec 2 videos par mois. Les plans payants : Starter a 9 EUR/mois (10 videos), Createur a 29 EUR/mois (50 videos, le plus populaire), et Empire a 99 EUR/mois (videos illimitees, 4K). -20% avec la facturation annuelle.",
  },
  {
    category: 'abonnement',
    question: 'Puis-je annuler mon abonnement a tout moment ?',
    answer:
      "Absolument. Tu peux annuler ton abonnement a tout moment depuis tes parametres. Aucun engagement, aucun frais cache. Tu conserves l'acces a ton plan jusqu'a la fin de la periode en cours.",
  },
  {
    category: 'abonnement',
    question: 'Comment fonctionne le parrainage ?',
    answer:
      "Le parrainage SUTRA est tres genereux : ton filleul obtient -50% sur son premier mois, tu recois 50% de son premier paiement + 10% recurrent chaque mois tant qu'il est abonne. Tous les 10 filleuls, tu debloques un bonus de 30%. Les gains sont verses sur ton wallet SUTRA et retirables a partir de 50 EUR.",
  },
  {
    category: 'technique',
    question: 'Mes donnees sont-elles protegees ?',
    answer:
      "Oui. SUTRA est conforme au RGPD. Tes donnees sont hebergees en Europe, chiffrees en transit et au repos. Tu peux exporter ou supprimer tes donnees a tout moment depuis tes parametres. Nous ne vendons jamais tes informations personnelles.",
  },
  {
    category: 'technique',
    question: "Qu'est-ce que l'Autopilot ?",
    answer:
      "L'Autopilot te permet de creer des series de videos automatiques. Tu definis un theme, une frequence de publication, et SUTRA genere et publie automatiquement tes videos selon ton calendrier. Ideal pour maintenir une presence constante sans effort. Disponible a partir du plan Createur (1 serie) et Empire (5 series).",
  },
  {
    category: 'abonnement',
    question: 'Comment fonctionne le wallet et les retraits ?',
    answer:
      "Tes gains de parrainage et de concours sont credites automatiquement sur ton wallet SUTRA. Tu peux retirer tes gains a partir de 5 EUR par virement bancaire (IBAN). Les retraits sont traites sous 48 heures ouvrees. Tu consultes ton solde et l'historique complet depuis la page Wallet.",
  },
  {
    category: 'general',
    question: 'Quels formats de video sont disponibles ?',
    answer:
      "SUTRA propose 3 formats : 16:9 (horizontal, ideal pour YouTube), 9:16 (vertical, parfait pour TikTok et Reels Instagram), et 1:1 (carre, pour les fils LinkedIn et Facebook). Tu choisis le format avant la generation, et notre IA adapte automatiquement le cadrage et les sous-titres.",
  },
  {
    category: 'creation',
    question: 'Puis-je utiliser mes propres images ou videos ?',
    answer:
      "Pour le moment, SUTRA genere tous les visuels par IA ou utilise des stocks HD (Pexels). L'import d'images personnalisees sera disponible prochainement. Tu peux cependant influencer le style visuel via le prompt, le choix de niche et les preferences de ton profil.",
  },
  {
    category: 'technique',
    question: 'Comment participer aux concours et au classement ?',
    answer:
      "Chaque utilisateur inscrit recoit automatiquement des places pour le tirage au sort hebdomadaire et mensuel. Plus tu parraines, plus tu as de places. Pour le classement mensuel Purama Impact, tu soumets ta meilleure video creee sur SUTRA. Notre IA l'evalue sur 5 criteres (Amour, Impact, Creativite, Qualite, Inspiration) et le top 10 se partage 3% du CA du mois.",
  },
]

const categories = [
  { id: 'all', label: 'Tout', icon: BookOpen },
  { id: 'general', label: 'General', icon: Zap },
  { id: 'creation', label: 'Creation', icon: Video },
  { id: 'voix', label: 'Voix', icon: Mic },
  { id: 'abonnement', label: 'Abonnement', icon: CreditCard },
  { id: 'technique', label: 'Technique', icon: Shield },
]

const gettingStartedSteps = [
  {
    icon: Wand2,
    title: 'Cree ton compte',
    description:
      "Inscris-toi gratuitement en quelques secondes. Aucune carte bancaire requise pour le plan Free.",
  },
  {
    icon: Palette,
    title: 'Configure ton profil',
    description:
      "Choisis ta niche, ton style prefere et ta voix. SUTRA s'adapte a tes preferences pour des resultats optimaux.",
  },
  {
    icon: Video,
    title: 'Genere ta premiere video',
    description:
      "Donne un sujet ou une idee, choisis un format, et laisse l'IA faire le reste. Ta video sera prete en quelques minutes.",
  },
  {
    icon: Users,
    title: 'Publie et partage',
    description:
      "Publie directement sur TikTok, YouTube, Instagram depuis SUTRA. Partage ton lien de parrainage pour gagner des commissions.",
  },
]

function FAQAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FAQItem
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={cn(
        'rounded-xl border transition-all duration-300',
        isOpen
          ? 'bg-white/[0.04] border-violet-500/20'
          : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left"
        aria-expanded={isOpen}
        data-testid={`faq-toggle-${item.question.slice(0, 20).replace(/\s/g, '-').toLowerCase()}`}
      >
        <span className="text-sm sm:text-base font-medium text-white/90">
          {item.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0"
        >
          <ChevronDown
            className={cn(
              'w-5 h-5 transition-colors',
              isOpen ? 'text-violet-400' : 'text-white/30'
            )}
          />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 sm:px-6 pb-5 sm:pb-6">
              <p className="text-sm text-white/50 leading-relaxed">
                {item.answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ContactForm() {
  const [formState, setFormState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormState('loading')
    setErrorMsg('')

    const form = e.currentTarget
    const data = new FormData(form)
    const body = {
      name: data.get('name') as string,
      email: data.get('email') as string,
      subject: data.get('subject') as string,
      message: data.get('message') as string,
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error ?? 'Erreur lors de l\'envoi')
      }

      setFormState('success')
      form.reset()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur inconnue')
      setFormState('error')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
      data-testid="contact-form"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="contact-name" className="block text-sm font-medium text-white/70 mb-1.5">
            Nom
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={50}
            data-testid="contact-name-input"
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm"
            placeholder="Ton nom"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="block text-sm font-medium text-white/70 mb-1.5">
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            data-testid="contact-email-input"
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm"
            placeholder="ton@email.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact-subject" className="block text-sm font-medium text-white/70 mb-1.5">
          Sujet
        </label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          required
          minLength={3}
          maxLength={100}
          data-testid="contact-subject-input"
          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm"
          placeholder="Quel est le sujet ?"
        />
      </div>

      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-white/70 mb-1.5">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          data-testid="contact-message-input"
          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm resize-none"
          placeholder="Decris ton probleme ou ta question..."
        />
      </div>

      {formState === 'success' && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3"
        >
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Message envoye avec succes. Nous te repondrons rapidement.
        </motion.div>
      )}

      {formState === 'error' && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {errorMsg || 'Erreur lors de l\'envoi. Reessaie plus tard.'}
        </motion.div>
      )}

      <button
        type="submit"
        disabled={formState === 'loading'}
        data-testid="contact-submit"
        className={cn(
          'w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97] flex items-center justify-center gap-2',
          'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40',
          formState === 'loading' && 'opacity-70 cursor-not-allowed'
        )}
      >
        {formState === 'loading' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        {formState === 'loading' ? 'Envoi...' : 'Envoyer'}
      </button>
    </form>
  )
}

export default function HelpPage() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const faqRef = useRef<HTMLDivElement>(null)
  const guideRef = useRef<HTMLDivElement>(null)
  const contactRef = useRef<HTMLDivElement>(null)
  const faqInView = useInView(faqRef, { once: true, margin: '-80px' })
  const guideInView = useInView(guideRef, { once: true, margin: '-80px' })
  const contactInView = useInView(contactRef, { once: true, margin: '-80px' })

  const filteredFaqs =
    activeCategory === 'all'
      ? faqs
      : faqs.filter((f) => f.category === activeCategory)

  return (
    <main className="min-h-screen bg-[#06050e] text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#06050e]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-orbitron)' }}
            data-testid="header-logo"
          >
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              SUTRA
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/signup"
              className="text-sm px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
            >
              Commencer
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="relative py-16 sm:py-24">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-violet-500/[0.04] blur-[120px] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <span className="inline-block text-sm font-semibold text-violet-400 uppercase tracking-widest mb-4">
            Centre d&apos;aide
          </span>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-orbitron)' }}
          >
            Comment pouvons-nous{' '}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              t&apos;aider
            </span>{' '}
            ?
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto mb-6">
            Retrouve les reponses a tes questions, un guide pour demarrer, et
            notre formulaire de contact.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3 max-w-md mx-auto">
            <MessageCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              Utilise le chatbot en bas a droite pour une aide instantanee
            </span>
          </div>
        </div>
      </section>

      {/* Getting started */}
      <section ref={guideRef} className="relative py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={guideInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2
              className="text-2xl sm:text-3xl font-bold text-white mb-3"
              style={{ fontFamily: 'var(--font-orbitron)' }}
            >
              Guide de demarrage
            </h2>
            <p className="text-white/50">
              4 etapes pour creer ta premiere video
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {gettingStartedSteps.map((step, i) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={guideInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
                  className="relative rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-6 hover:border-white/[0.12] transition-all duration-300"
                >
                  <div className="absolute -top-3 -left-1 w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-xs font-bold text-white">
                    {i + 1}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-violet-400" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-white/50 leading-relaxed">
                    {step.description}
                  </p>
                </motion.div>
              )
            })}
          </div>

          <div className="text-center mt-8">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors active:scale-[0.97]"
            >
              Commencer maintenant
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Detailed guides */}
      <section className="relative py-16 sm:py-20 border-t border-white/[0.04]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-16">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3" style={{ fontFamily: 'var(--font-orbitron)' }}>
              Guides complets
            </h2>
            <p className="text-white/50">Tout ce que tu dois savoir pour maitriser SUTRA</p>
          </div>

          {/* Guide 1: Créer ta première vidéo */}
          <div id="guide-premiere-video" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Video className="h-5 w-5 text-violet-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Creer ta premiere video</h3>
            </div>
            <div className="space-y-3 text-sm text-white/60 leading-relaxed">
              <p><strong className="text-white/80">Etape 1 — Choisis ton sujet.</strong> Depuis le dashboard, clique sur &quot;Creer une video&quot;. Decris ton sujet en une ou deux phrases. Par exemple : &quot;5 astuces pour mieux dormir&quot; ou &quot;Les tendances mode ete 2026&quot;. Plus tu es precis, meilleur sera le resultat.</p>
              <p><strong className="text-white/80">Etape 2 — Configure les options.</strong> Choisis le format (16:9 pour YouTube, 9:16 pour TikTok), la qualite (selon ton plan), et la voix. Tu peux ecouter un apercu de chaque voix avant de choisir.</p>
              <p><strong className="text-white/80">Etape 3 — Genere.</strong> Clique sur &quot;Generer&quot;. Notre pipeline IA travaille en 5 etapes : script, voix, visuels, musique, montage. Tu suis la progression en temps reel. La generation prend 3 a 8 minutes.</p>
              <p><strong className="text-white/80">Etape 4 — Revise et publie.</strong> Une fois ta video prete, tu peux la previsualiser, la telecharger, ou la publier directement depuis SUTRA. Avec le plan Creator+, tu accedes a SUTRA Studio pour modifier chaque element.</p>
            </div>
          </div>

          {/* Guide 2: Styles de vidéos */}
          <div id="guide-styles" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Palette className="h-5 w-5 text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Les styles de videos disponibles</h3>
            </div>
            <div className="space-y-3 text-sm text-white/60 leading-relaxed">
              <p><strong className="text-white/80">Cinematique.</strong> Style narratif inspiré des documentaires Netflix. Visuels immersifs, musique orchestrale, narration posée. Parfait pour les sujets sérieux, historiques ou inspirants.</p>
              <p><strong className="text-white/80">Dynamique.</strong> Rythme rapide, transitions percutantes, musique énergique. Idéal pour TikTok, les tops 5/10, et les sujets tendance.</p>
              <p><strong className="text-white/80">Educatif.</strong> Structure claire avec introduction, points clés et conclusion. Graphiques et schémas animés. Parfait pour les tutoriels et les explications.</p>
              <p><strong className="text-white/80">Motivationnel.</strong> Visuels inspirants, musique épique, narration puissante. Pour les contenus développement personnel et motivation.</p>
              <p><strong className="text-white/80">Lo-fi / Chill.</strong> Ambiance relaxante, visuels doux, musique lo-fi. Pour les contenus lifestyle, bien-être et méditation.</p>
              <p><strong className="text-white/80">Corporate.</strong> Ton professionnel, visuels sobres, structure business. Pour les présentations, pitchs et contenus B2B.</p>
            </div>
          </div>

          {/* Guide 3: Publier et partager */}
          <div id="guide-publier" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Send className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Publier et partager</h3>
            </div>
            <div className="space-y-3 text-sm text-white/60 leading-relaxed">
              <p><strong className="text-white/80">Telecharger.</strong> Depuis ta bibliotheque, clique sur une video puis &quot;Telecharger&quot;. Tu obtiens un fichier MP4 haute qualite que tu peux utiliser partout.</p>
              <p><strong className="text-white/80">Publier directement.</strong> Avec la fonction Publier (plan Creator+), connecte tes comptes YouTube, TikTok et Instagram. SUTRA publie ta video en un clic avec le titre, la description et les hashtags optimises par IA.</p>
              <p><strong className="text-white/80">Planifier.</strong> Programme tes publications a l&apos;avance. Choisis la date et l&apos;heure, et SUTRA publie automatiquement au moment optimal. L&apos;Autopilot (plan Empire) planifie et genere des series entieres.</p>
              <p><strong className="text-white/80">Partager.</strong> Chaque video a un lien de partage unique. Tu peux aussi exporter le script, les sous-titres (SRT), ou le storyboard separement.</p>
            </div>
          </div>

          {/* Guide 4: Parrainage & Wallet */}
          <div id="guide-parrainage" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Parrainage et Wallet</h3>
            </div>
            <div className="space-y-3 text-sm text-white/60 leading-relaxed">
              <p><strong className="text-white/80">Ton code de parrainage.</strong> Chaque compte SUTRA recoit un code unique (format SUTRA-XXXXX). Tu le trouves dans la page Parrainage. Partage-le ou utilise ton lien personnalise.</p>
              <p><strong className="text-white/80">Avantages filleul.</strong> Ton filleul obtient -50% sur son premier mois d&apos;abonnement payant. Le code s&apos;applique automatiquement a l&apos;inscription.</p>
              <p><strong className="text-white/80">Tes commissions.</strong> Tu recois 50% du premier paiement de chaque filleul + 10% recurrent chaque mois tant qu&apos;il est abonne. Tous les 10 filleuls, tu debloques un bonus de 30%.</p>
              <p><strong className="text-white/80">Paliers.</strong> 6 niveaux de parrainage : Bronze (5 filleuls), Argent (10), Or (25), Platine (50), Diamant (75), Legende (100). Chaque palier debloque des avantages supplementaires.</p>
              <p><strong className="text-white/80">Wallet et retrait.</strong> Tous tes gains (parrainage + concours) sont credites sur ton wallet SUTRA. Tu peux retirer a partir de 5 EUR par virement bancaire IBAN. Les retraits sont traites sous 48h.</p>
              <p><strong className="text-white/80">Places concours.</strong> Chaque inscription te donne 1 place pour les tirages au sort. Chaque parrainage donne +1 place au parrain ET au filleul. Plus tu parraines, plus tu as de chances de gagner.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section ref={faqRef} className="relative py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={faqInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-8"
          >
            <h2
              className="text-2xl sm:text-3xl font-bold text-white mb-3"
              style={{ fontFamily: 'var(--font-orbitron)' }}
            >
              Questions{' '}
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                frequentes
              </span>
            </h2>
          </motion.div>

          {/* Category filter */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={faqInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-wrap items-center justify-center gap-2 mb-8"
          >
            {categories.map((cat) => {
              const CatIcon = cat.icon
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id)
                    setOpenIndex(0)
                  }}
                  data-testid={`faq-category-${cat.id}`}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    activeCategory === cat.id
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                      : 'bg-white/[0.04] text-white/50 border border-white/[0.06] hover:border-white/[0.12]'
                  )}
                >
                  <CatIcon className="w-3.5 h-3.5" />
                  {cat.label}
                </button>
              )
            })}
          </motion.div>

          {/* Accordion */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={faqInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="space-y-3"
          >
            {filteredFaqs.map((faq, i) => (
              <FAQAccordionItem
                key={`${activeCategory}-${i}`}
                item={faq}
                isOpen={openIndex === i}
                onToggle={() =>
                  setOpenIndex((prev) => (prev === i ? null : i))
                }
              />
            ))}
            {filteredFaqs.length === 0 && (
              <div className="text-center py-12 text-white/40 text-sm">
                Aucune question dans cette categorie.
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Contact */}
      <section ref={contactRef} className="relative py-16 sm:py-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={contactInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-10"
          >
            <h2
              className="text-2xl sm:text-3xl font-bold text-white mb-3"
              style={{ fontFamily: 'var(--font-orbitron)' }}
            >
              Contacte-nous
            </h2>
            <p className="text-white/50">
              Tu n&apos;as pas trouve ta reponse ? Ecris-nous directement.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={contactInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8"
          >
            <ContactForm />
          </motion.div>
        </div>
      </section>

      {/* Footer link */}
      <div className="border-t border-white/[0.06] py-8 text-center">
        <Link
          href="/"
          className="text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          Retour a l&apos;accueil
        </Link>
      </div>
    </main>
  )
}
