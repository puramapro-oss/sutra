import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const easeOut = [0.22, 1, 0.36, 1] as const

const steps = [
  {
    n: '01',
    title: 'Donne un sujet',
    desc: "Un thème, une URL, une idée brute. SUTRA comprend ton intention.",
    accent: 'text-violet-300',
  },
  {
    n: '02',
    title: "L'IA construit",
    desc: 'Script, voix, visuels, musique, montage — tout est généré et synchronisé.',
    accent: 'text-fuchsia-300',
  },
  {
    n: '03',
    title: 'Publie partout',
    desc: 'Export optimisé TikTok, Reels, Shorts. Itère en un clic si besoin.',
    accent: 'text-cyan-300',
  },
]

export function LandingHowItWorks() {
  return (
    <section className="relative px-6 py-32">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: easeOut }}
          className="max-w-2xl mb-16"
        >
          <p className="text-xs font-semibold tracking-[0.22em] text-fuchsia-300 uppercase mb-4">
            Comment ça marche
          </p>
          <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            Trois étapes.
            <br />
            <span className="text-white/45">Pas une de plus.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: easeOut }}
              className="relative p-8 rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl overflow-hidden group hover:border-white/[0.16] transition-colors duration-300"
            >
              <div className={cn('text-sm font-mono mb-8 tracking-wider', s.accent)}>{s.n}</div>
              <h3 className="text-xl font-semibold tracking-tight mb-3">{s.title}</h3>
              <p className="text-[15px] text-white/60 leading-relaxed">{s.desc}</p>
              <div className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
