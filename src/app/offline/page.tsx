'use client'

import { WifiOff } from 'lucide-react'

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-[#06050e] text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-8">
          <WifiOff className="w-10 h-10 text-violet-400" />
        </div>

        <h1
          className="text-2xl sm:text-3xl font-bold text-white mb-4"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Tu es hors ligne
        </h1>

        <p className="text-white/50 text-sm leading-relaxed mb-8">
          SUTRA necessite une connexion Internet pour generer des videos.
          Verifie ta connexion et reessaie.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors active:scale-[0.97]"
          data-testid="offline-retry"
        >
          Reessayer
        </button>
      </div>
    </main>
  )
}
