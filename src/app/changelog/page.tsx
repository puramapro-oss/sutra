import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, Bug, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Changelog — Nouveautes SUTRA',
  description:
    'Decouvre les dernieres mises a jour, nouvelles fonctionnalites et corrections de SUTRA, la plateforme de generation video IA.',
  openGraph: {
    title: 'Changelog — Nouveautes SUTRA',
    description: 'Les dernieres mises a jour de SUTRA.',
    url: 'https://sutra.purama.dev/changelog',
  },
  alternates: {
    canonical: 'https://sutra.purama.dev/changelog',
  },
}

type BadgeType = 'new' | 'fix' | 'improvement'

interface ChangelogEntry {
  date: string
  badge: BadgeType
  title: string
  description: string
}

const badgeConfig: Record<BadgeType, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: 'Nouveau', color: 'bg-green-500/10 text-green-400 border-green-500/20', icon: Sparkles },
  fix: { label: 'Correction', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: Bug },
  improvement: { label: 'Amelioration', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: TrendingUp },
}

const entries: ChangelogEntry[] = [
  {
    date: '2026-03-29',
    badge: 'new',
    title: 'Lancement de SUTRA',
    description:
      'SUTRA est officiellement lance. Genere des videos completes par IA : script, voix off, visuels, musique et montage, le tout en quelques minutes. Plans Free, Starter, Createur et Empire disponibles.',
  },
  {
    date: '2026-03-29',
    badge: 'new',
    title: 'Pipeline video IA',
    description:
      'Notre pipeline de generation video est entierement automatise : Claude genere le script, ElevenLabs produit la voix off, l\'IA cree les visuels scene par scene, Suno compose la musique originale, et Shotstack assemble le montage final.',
  },
  {
    date: '2026-03-29',
    badge: 'new',
    title: 'Sutra Studio',
    description:
      'L\'editeur visuel integre permet de modifier chaque scene de ta video : ajuster le script, changer les visuels, repositionner les sous-titres, modifier les transitions et re-generer des elements individuellement. Disponible a partir du plan Createur.',
  },
]

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function ChangelogPage() {
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
              href="/help"
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Aide
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

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block text-sm font-semibold text-violet-400 uppercase tracking-widest mb-4">
            Changelog
          </span>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-orbitron)' }}
          >
            Quoi de{' '}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              neuf
            </span>{' '}
            ?
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Toutes les mises a jour, nouvelles fonctionnalites et
            ameliorations de SUTRA.
          </p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 sm:left-6 top-0 bottom-0 w-px bg-white/[0.06]" />

          <div className="space-y-10">
            {entries.map((entry, i) => {
              const badge = badgeConfig[entry.badge]
              const BadgeIcon = badge.icon

              return (
                <div key={i} className="relative pl-12 sm:pl-16">
                  {/* Dot */}
                  <div className="absolute left-2.5 sm:left-4.5 top-1 w-3 h-3 rounded-full bg-violet-500 border-2 border-[#06050e]" />

                  {/* Date */}
                  <time className="block text-xs text-white/30 mb-2 font-mono">
                    {formatDate(entry.date)}
                  </time>

                  {/* Card */}
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6">
                    <div className="flex items-start gap-3 mb-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-semibold',
                          badge.color
                        )}
                      >
                        <BadgeIcon className="w-3 h-3" />
                        {badge.label}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white mb-2">
                      {entry.title}
                    </h3>
                    <p className="text-sm text-white/50 leading-relaxed">
                      {entry.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
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
