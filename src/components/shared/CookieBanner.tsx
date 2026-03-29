'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cookie, X } from 'lucide-react'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [prefs, setPrefs] = useState({ essential: true, analytics: false, marketing: false })

  useEffect(() => {
    const consent = localStorage.getItem('sutra-cookie-consent')
    if (!consent) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem('sutra-cookie-consent', JSON.stringify({ essential: true, analytics: true, marketing: true }))
    setVisible(false)
  }

  function refuse() {
    localStorage.setItem('sutra-cookie-consent', JSON.stringify({ essential: true, analytics: false, marketing: false }))
    setVisible(false)
  }

  function saveCustom() {
    localStorage.setItem('sutra-cookie-consent', JSON.stringify(prefs))
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-[9998] p-4 md:p-6"
        >
          <div className="mx-auto max-w-3xl rounded-2xl border border-white/[0.06] bg-[#0f0e1a]/95 p-6 backdrop-blur-xl shadow-2xl">
            {!showCustomize ? (
              <>
                <div className="flex items-start gap-3 mb-4">
                  <Cookie className="h-5 w-5 text-violet-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-white/70">
                    Nous utilisons des cookies pour ameliorer ton experience. Tu peux accepter, personnaliser ou refuser.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={accept} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors">
                    Accepter tout
                  </button>
                  <button onClick={() => setShowCustomize(true)} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors">
                    Personnaliser
                  </button>
                  <button onClick={refuse} className="rounded-lg px-4 py-2 text-sm text-white/40 hover:text-white/60 transition-colors">
                    Refuser
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Personnaliser les cookies</h3>
                  <button onClick={() => setShowCustomize(false)} className="text-white/40 hover:text-white/60">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-3 mb-4">
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-white/70">Essentiels</span>
                    <div className="h-5 w-9 rounded-full bg-violet-600 opacity-50 cursor-not-allowed" />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-white/70">Analytics</span>
                    <button
                      onClick={() => setPrefs((p) => ({ ...p, analytics: !p.analytics }))}
                      className={`h-5 w-9 rounded-full transition-colors ${prefs.analytics ? 'bg-violet-600' : 'bg-white/10'}`}
                    >
                      <div className={`h-4 w-4 rounded-full bg-white transition-transform mx-0.5 ${prefs.analytics ? 'translate-x-4' : ''}`} />
                    </button>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-white/70">Marketing</span>
                    <button
                      onClick={() => setPrefs((p) => ({ ...p, marketing: !p.marketing }))}
                      className={`h-5 w-9 rounded-full transition-colors ${prefs.marketing ? 'bg-violet-600' : 'bg-white/10'}`}
                    >
                      <div className={`h-4 w-4 rounded-full bg-white transition-transform mx-0.5 ${prefs.marketing ? 'translate-x-4' : ''}`} />
                    </button>
                  </label>
                </div>
                <button onClick={saveCustom} className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors">
                  Sauvegarder mes preferences
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
