import Link from 'next/link'

export default function LegalFooter() {
  return (
    <div className="border-t border-white/[0.06] py-8 text-center flex items-center justify-center gap-6">
      <Link
        href="/legal/terms"
        className="text-sm text-white/40 hover:text-white/60 transition-colors"
      >
        CGU
      </Link>
      <Link
        href="/legal/cookies"
        className="text-sm text-white/40 hover:text-white/60 transition-colors"
      >
        Cookies
      </Link>
      <Link
        href="/"
        className="text-sm text-white/40 hover:text-white/60 transition-colors"
      >
        Accueil
      </Link>
    </div>
  )
}
