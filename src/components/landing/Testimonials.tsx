'use client'

import { useCallback, useEffect, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Star } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'

interface Testimonial {
  name: string
  role: string
  content: string
  rating: number
  gradient: string
}

const testimonials: Testimonial[] = [
  {
    name: 'Julien M.',
    role: 'Createur YouTube',
    content:
      'SUTRA a completement transforme mon workflow. Je produis 10x plus de contenu sans sacrifier la qualite. Mes abonnes ne voient meme pas la difference avec mes videos tournees en studio.',
    rating: 5,
    gradient: 'from-violet-400 to-purple-500',
  },
  {
    name: 'Sarah L.',
    role: 'Coach bien-etre',
    content:
      'En tant que coach, je n\'avais ni le temps ni le budget pour creer des videos. Avec SUTRA, je publie 3 videos par semaine et mon audience a explose.',
    rating: 5,
    gradient: 'from-fuchsia-400 to-pink-500',
  },
  {
    name: 'Thomas R.',
    role: 'Entrepreneur e-commerce',
    content:
      'Les videos produit generees par SUTRA convertissent mieux que celles de mon ancien videaste freelance. Et ca me coute une fraction du prix.',
    rating: 5,
    gradient: 'from-indigo-400 to-violet-500',
  },
  {
    name: 'Amina K.',
    role: 'TikTokeuse',
    content:
      'Je genere des videos virales en boucle. L\'IA comprend parfaitement les codes de TikTok. 3 de mes videos SUTRA ont depasse le million de vues.',
    rating: 5,
    gradient: 'from-purple-400 to-fuchsia-500',
  },
  {
    name: 'Marc D.',
    role: 'Formateur en ligne',
    content:
      'J\'utilise SUTRA pour creer mes modules de formation. La qualite des voix est bluffante et le rendu final est ultra professionnel.',
    rating: 4,
    gradient: 'from-violet-400 to-indigo-500',
  },
  {
    name: 'Lea P.',
    role: 'Agence marketing',
    content:
      'On produit les videos de 12 clients differents avec SUTRA. Le gain de temps est enorme et nos clients sont ravis du resultat.',
    rating: 5,
    gradient: 'from-fuchsia-400 to-violet-500',
  },
]

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i < rating
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-white/20'
          }`}
        />
      ))}
    </div>
  )
}

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
            Temoignages
          </span>
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Ils creent avec{' '}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              SUTRA
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
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="flex-[0_0_100%] sm:flex-[0_0_calc(50%-12px)] lg:flex-[0_0_calc(33.333%-16px)] min-w-0"
              >
                <div className="h-full rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-6 sm:p-8 hover:bg-white/[0.06] hover:border-violet-500/20 transition-all duration-300">
                  <StarRating rating={t.rating} />

                  <p className="text-white/70 text-sm leading-relaxed mt-4 mb-6">
                    &ldquo;{t.content}&rdquo;
                  </p>

                  <div className="flex items-center gap-3 mt-auto">
                    <div
                      className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center text-white font-bold text-sm`}
                    >
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {t.name}
                      </p>
                      <p className="text-xs text-white/40">{t.role}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-8">
          {testimonials.map((_, i) => (
            <button
              key={i}
              aria-label={`Aller au temoignage ${i + 1}`}
              onClick={() => emblaApi?.scrollTo(i)}
              className="w-2 h-2 rounded-full bg-white/20 hover:bg-violet-400/60 transition-colors duration-200"
            />
          ))}
        </div>
      </div>
    </section>
  )
}
