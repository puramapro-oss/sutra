import Link from 'next/link'

export function BackgroundAndNav() {
  return (
    <>
      <div className="fixed inset-0 z-0">
        <div className="absolute top-[-200px] right-[-100px] w-[600px] h-[600px] rounded-full bg-violet-500/[0.06] blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-100px] left-[-50px] w-[400px] h-[400px] rounded-full bg-fuchsia-500/[0.04] blur-[100px]" />
      </div>

      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#06050e]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              SUTRA
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-white/60 hover:text-white transition-colors">
              Tarifs
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
    </>
  )
}
