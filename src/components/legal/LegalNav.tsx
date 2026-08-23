import Link from 'next/link'

export default function LegalNav() {
  return (
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
      </div>
    </nav>
  )
}
