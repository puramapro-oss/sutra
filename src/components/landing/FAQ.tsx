'use client'

import { useState, useRef } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FAQItem {
  question: string
  answer: string
}

const faqs: FAQItem[] = [
  {
    question: 'Qu\'est-ce que SUTRA exactement ?',
    answer:
      'SUTRA est une plateforme de generation de videos par IA. Tu donnes un sujet ou une idee, et notre pipeline IA genere automatiquement le script, la voix off, les visuels, la musique et le montage final. Le resultat : une video prete a publier en quelques minutes.',
  },
  {
    question: 'Comment fonctionne la creation de video ?',
    answer:
      'Le processus est simple : tu decris ton sujet, choisis un style et un ton. Notre IA genere d\'abord un script optimise, puis une voix off naturelle, des visuels uniques pour chaque scene, une musique originale, et assemble le tout en une video finale avec sous-titres et transitions.',
  },
  {
    question: 'Quelle est la qualite des videos ?',
    answer:
      'La qualite depend de ton plan : 720p pour Free et Starter, 1080p pour Createur, et 4K pour Empire. Les visuels sont generes par IA de pointe, les voix sont ultra-realistes, et le montage est professionnel. Tu peux aussi affiner chaque element dans SUTRA Studio.',
  },
  {
    question: 'Les voix sont-elles vraiment realistes ?',
    answer:
      'Oui, nous utilisons la technologie de synthese vocale la plus avancee du marche. Plus de 30 voix naturelles sont disponibles, avec emotions et intonations. A partir du plan Createur, tu peux meme cloner ta propre voix pour un rendu encore plus personnel.',
  },
  {
    question: 'Combien coute SUTRA ?',
    answer:
      'SUTRA propose un plan gratuit avec 2 videos par mois. Les plans payants commencent a 9 EUR/mois (Starter), 29 EUR/mois (Createur, le plus populaire) et 99 EUR/mois (Empire). Une reduction de 20% est disponible avec la facturation annuelle.',
  },
  {
    question: 'Puis-je annuler mon abonnement a tout moment ?',
    answer:
      'Absolument. Tu peux annuler ton abonnement a tout moment depuis tes parametres. Aucun engagement, aucun frais cache. Tu conserves l\'acces a ton plan jusqu\'a la fin de la periode en cours.',
  },
  {
    question: 'Mes donnees sont-elles protegees ?',
    answer:
      'Oui. SUTRA est conforme au RGPD. Tes donnees sont hebergees en Europe, chiffrees en transit et au repos. Tu peux exporter ou supprimer tes donnees a tout moment. Nous ne vendons jamais tes informations.',
  },
  {
    question: 'Comment contacter le support ?',
    answer:
      'Notre support est accessible via le chat integre dans l\'app, par email, ou via notre systeme de tickets. Les plans Createur et Empire beneficient d\'un support prioritaire avec un temps de reponse garanti.',
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

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      data-testid="faq-section"
      id="faq"
      ref={ref}
      className="relative py-20 sm:py-28"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="inline-block text-sm font-semibold text-violet-400 uppercase tracking-widest mb-4">
            FAQ
          </span>
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Questions{' '}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              frequentes
            </span>
          </h2>
        </motion.div>

        {/* Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="space-y-3"
        >
          {faqs.map((faq, i) => (
            <FAQAccordionItem
              key={i}
              item={faq}
              isOpen={openIndex === i}
              onToggle={() =>
                setOpenIndex((prev) => (prev === i ? null : i))
              }
            />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
