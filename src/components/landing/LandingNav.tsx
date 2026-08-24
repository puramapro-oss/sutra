import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function LandingNav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 px-4 sm:px-6 pt-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-2xl px-4 sm:px-5 py-2.5 shadow-[0_8px_32px_-12px_rgba(168,85,247,0.25)]">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-fuchsia-500/40 group-hover:shadow-fuchsia-500/60 transition-shadow">
            <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/30 to-transparent" />
            <span className="relative">S</span>
          </span>
          <span className="text-[15px] font-semibold tracking-tight">SUTRA</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-white/60">
          <Link href="/how-it-works" className="hover:text-white transition-colors">Fonctionnement</Link>
          <Link href="/pricing" className="hover:text-white transition-colors">Tarifs</Link>
          <Link href="/ecosystem" className="hover:text-white transition-colors">Écosystème</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden sm:inline-flex text-sm text-white/70 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            Se connecter
          </Link>
          <Link
            href="/signup"
            data-testid="welcome-cta-primary"
            className="group inline-flex items-center gap-1.5 text-sm font-medium bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white px-4 py-2 rounded-lg shadow-[0_8px_24px_-8px_rgba(217,70,239,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(217,70,239,0.85)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            Commencer
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </header>
  )
}
