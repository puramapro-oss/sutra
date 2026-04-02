'use client'

import { useCallback, useEffect, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'

interface UseCase {
  title: string
  role: string
  content: string
  gradient: string
}

const useCases: UseCase[] = [
  {
    title: 'YouTube & Long Format',
    role: 'Pour les createurs',
    content:
      'Genere des scripts cinematiques, des visuels IA et des voix off realistes. Produis des videos longues sans camera ni studio.',
    gradient: 'from-violet-400 to-purple-500',
  },
  {
    title: 'TikTok & Shorts',
    role: 'Pour les createurs viraux',
    content:
      'Cree des videos verticales percutantes avec hooks puissants, transitions dynamiques et sous-titres animes. Optimise pour l\'engagement.',
    gradient: 'from-fuchsia-400 to-pink-500',
  },
  {
    title: 'E-commerce & Produits',
    role: 'Pour les entrepreneurs',
    content:
      'Genere des videos publicitaires professionnelles pour tes produits avec mise en scene IA et voix off convaincante.',
    gradient: 'from-indigo-400 to-violet-500',
  },
  {
    title: 'Formation & Education',
    role: 'Pour les formateurs',
    content:
      'Transforme tes cours en videos pedagogiques captivantes. Voix off naturelle et illustrations generees par IA.',
    gradient: 'from-purple-400 to-fuchsia-500',
  },
  {
    title: 'Faceless & Automatise',
    role: 'Pour les chaines anonymes',
    content:
      'Lance des chaines faceless sur n\'importe quelle niche. Scripts IA, visuels stock, voix off et publication automatique.',
    gradient: 'from-violet-400 to-indigo-500',
  },
  {
    title: 'Agences & Multi-clients',
    role: 'Pour les agences',
    content:
      'Produis du contenu video pour plusieurs clients simultanement. Templates personnalisables et export multi-format.',
    gradient: 'from-fuchsia-400 to-violet-500',
  },
]

export default function Testimonials() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' })

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'start',
    slidesToScroll: 1,
    breakpoints: {
      '(min-width: 640px)': { slidesToScroll: 1 },
      '(min-width: 1024px)': { slidesToScroll: 1 },
    },
  })

  const autoplay = useCallback(() => {
    if (!emblaApi) return
    const interval = setInterval(() => {
      emblaApi.scrollNext()
    }, 4000)
    return () => clearInterval(interval)
  }, [emblaApi])

  useEffect(() => {
    const cleanup = autoplay()
    return () => cleanup?.()
  }, [autoplay])

  return (
    <section
      data-testid="testimonials-section"
      ref={sectionRef}
      className="relative py-20 sm:py-28 overflow-hidden"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block text-sm font-semibold text-violet-400 uppercase tracking-widest mb-4">
            Cas d&apos;usage
          </span>
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Cree pour{' '}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              chaque niche
            </span>
          </h2>
        </motion.div>

        {/* Carousel */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          ref={emblaRef}
          className="overflow-hidden"
        >
          <div className="flex gap-6">
            {useCases.map((t, i) => (
              <div
                key={i}
                className="flex-[0_0_100%] sm:flex-[0_0_calc(50%-12px)] lg:flex-[0_0_calc(33.333%-16px)] min-w-0"
              >
                <div className="h-full rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-6 sm:p-8 hover:bg-white/[0.06] hover:border-violet-500/20 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${t.gradient} flex items-center justify-center`}>
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs font-medium text-violet-400 uppercase tracking-wider">{t.role}</span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-3">{t.title}</h3>

                  <p className="text-white/60 text-sm leading-relaxed">
                    {t.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-8">
          {useCases.map((_, i) => (
            <button
              key={i}
              aria-label={`Aller au cas d'usage ${i + 1}`}
              onClick={() => emblaApi?.scrollTo(i)}
              className="w-2 h-2 rounded-full bg-white/20 hover:bg-violet-400/60 transition-colors duration-200"
            />
          ))}
        </div>
      </div>
    </section>
  )
}
