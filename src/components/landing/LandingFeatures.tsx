import { motion } from 'framer-motion'
import { PenLine, Mic, Clapperboard, Music2, Zap, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const easeOut = [0.22, 1, 0.36, 1] as const

const features = [
  {
    icon: PenLine,
    title: 'Script rédigé',
    desc: "Une IA narrative conçoit l'accroche, le rythme et la chute. Zéro page blanche.",
    accent: 'from-violet-500/30 to-violet-500/0',
    iconColor: 'text-violet-300',
  },
  {
    icon: Mic,
    title: 'Voix humaine',
    desc: 'Voix IA naturelle multi-langues, intonation ajustée à ton sujet.',
    accent: 'from-fuchsia-500/30 to-fuchsia-500/0',
    iconColor: 'text-fuchsia-300',
  },
  {
    icon: Clapperboard,
    title: 'Visuels calés',
    desc: 'Plans générés ou stock premium, synchronisés au montage par IA.',
    accent: 'from-pink-500/30 to-pink-500/0',
    iconColor: 'text-pink-300',
  },
  {
    icon: Music2,
    title: 'Musique adaptative',
    desc: 'Ambiance sonore choisie selon le ton — énergique, posé, cinématique.',
    accent: 'from-cyan-500/30 to-cyan-500/0',
    iconColor: 'text-cyan-300',
  },
  {
    icon: Zap,
    title: 'Prêt en minutes',
    desc: 'Export 1080p vertical ou horizontal, optimisé TikTok, Reels, YouTube Shorts.',
    accent: 'from-amber-500/30 to-amber-500/0',
    iconColor: 'text-amber-300',
  },
  {
    icon: Wand2,
    title: 'Itérations magiques',
    desc: 'Ajuste une phrase, change un plan, regénère. Ta vidéo évolue en temps réel.',
    accent: 'from-emerald-500/30 to-emerald-500/0',
    iconColor: 'text-emerald-300',
  },
]

export function LandingFeatures() {
  return (
    <section className="relative px-6 py-32 sm:py-40">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: easeOut }}
          className="max-w-2xl mb-16"
        >
          <p className="text-xs font-semibold tracking-[0.22em] text-fuchsia-300 uppercase mb-4">
            Tout-en-un
          </p>
          <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            Un studio complet,
            <br />
            <span className="text-white/45">piloté par l&apos;IA.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: easeOut }}
              className="group relative p-7 rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl hover:border-white/[0.16] hover:bg-white/[0.04] transition-all duration-300 overflow-hidden"
            >
              <div className={cn('absolute -top-1/2 -right-1/4 w-2/3 h-2/3 rounded-full opacity-0 group-hover:opacity-100 blur-3xl transition-opacity duration-500 bg-gradient-to-br pointer-events-none', f.accent)} />
              <div className="relative">
                <div className={cn('w-11 h-11 rounded-xl bg-gradient-to-br border border-white/[0.10] flex items-center justify-center mb-5 shadow-inner', f.accent)}>
                  <f.icon className={cn('w-5 h-5', f.iconColor)} />
                </div>
                <h3 className="text-lg font-semibold tracking-tight mb-2">{f.title}</h3>
                <p className="text-[15px] text-white/60 leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
