'use client'

import { useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { BookOpen, MessageCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { faqs } from '@/data/faq-data'
import { categories, gettingStartedSteps } from '@/data/help-data'
import { detailedGuides } from '@/data/help-guides-data'
import FAQAccordionItem from '@/components/help/FAQAccordionItem'
import ContactForm from '@/components/help/ContactForm'
import GuideSection from '@/components/help/GuideSection'

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
            style={{ fontFamily: 'var(--font-display)' }}
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
            style={{ fontFamily: 'var(--font-display)' }}
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
              style={{ fontFamily: 'var(--font-display)' }}
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

          <div className="text-center mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors active:scale-[0.97]"
            >
              Commencer maintenant
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/guide"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm font-medium transition-colors"
              data-testid="help-guide-link"
            >
              <BookOpen className="w-4 h-4" />
              Guide interactif complet
            </Link>
          </div>
        </div>
      </section>

      {/* Detailed guides */}
      <section className="relative py-16 sm:py-20 border-t border-white/[0.04]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-16">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3" style={{ fontFamily: 'var(--font-display)' }}>
              Guides complets
            </h2>
            <p className="text-white/50">Tout ce que tu dois savoir pour maitriser SUTRA</p>
          </div>

          {detailedGuides.map((guide) => (
            <GuideSection key={guide.id} guide={guide} />
          ))}
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
              style={{ fontFamily: 'var(--font-display)' }}
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
              style={{ fontFamily: 'var(--font-display)' }}
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
