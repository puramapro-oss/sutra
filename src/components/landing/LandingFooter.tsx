import Link from 'next/link'

export function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.06] px-6 py-12 mt-12">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-fuchsia-500/30">S</span>
          <span className="text-sm font-medium">SUTRA</span>
          <span className="text-xs text-white/50 ml-1">by Purama</span>
        </div>
        <nav className="flex items-center gap-6 text-xs text-white/60">
          <Link href="/pricing" className="hover:text-white/95 transition-colors">Tarifs</Link>
          <Link href="/aide" className="hover:text-white/95 transition-colors">Aide</Link>
          <Link href="/mentions-legales" className="hover:text-white/95 transition-colors">Mentions légales</Link>
          <Link href="/confidentialite" className="hover:text-white/95 transition-colors">Confidentialité</Link>
        </nav>
      </div>
    </footer>
  )
}
