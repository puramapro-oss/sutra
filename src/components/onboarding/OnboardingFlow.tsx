'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Mic, Play, ArrowRight, ArrowLeft, X } from 'lucide-react'
import { NICHES, VOICE_STYLES } from '@/lib/constants'
import { createClient } from '@/lib/supabase'

interface Props {
  userId: string
  onComplete: () => void
}

const SUGGESTED_TOPICS: Record<string, string[]> = {
  'bien-etre': ['5 habitudes matinales qui changent ta vie', 'Meditation guidee de 3 minutes', 'Les bienfaits du froid'],
  tech: ['Les 5 outils IA incontournables en 2026', 'Comment fonctionne GPT ?', 'Les tendances tech a suivre'],
  finance: ['Comment investir avec 100 EUR', 'Les 3 erreurs des debutants en bourse', 'Crypto : par ou commencer ?'],
  motivation: ['La regle des 5 secondes de Mel Robbins', 'Pourquoi tu procrastines', 'Comment rester motive chaque jour'],
  lifestyle: ['Ma routine du soir productive', 'Minimalisme : par ou commencer', '10 astuces organisation'],
  education: ['Apprendre 2x plus vite', 'La methode Feynman expliquee', 'Comment memoriser n\'importe quoi'],
  divertissement: ['Top 10 films que tu n\'as pas vus', 'Les illusions d\'optique les plus folles', 'Faits surprenants sur l\'espace'],
  cuisine: ['Recette en 5 minutes', '3 plats healthy pour la semaine', 'Les erreurs en cuisine a eviter'],
  sport: ['Entrainement HIIT de 10 min', 'Les bases de la musculation', 'Courir sans se blesser'],
  voyage: ['10 destinations sous-estimees', 'Comment voyager pas cher', 'Les plus beaux couchers de soleil'],
  science: ['Pourquoi le ciel est bleu', 'Les mysteres de l\'ocean profond', 'L\'IA expliquee simplement'],
  business: ['Lancer un side hustle', 'Comment negocier son salaire', 'Les secrets du personal branding'],
}

export default function OnboardingFlow({ userId, onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [selectedNiche, setSelectedNiche] = useState<string>('')
  const [selectedVoice, setSelectedVoice] = useState<string>('')
  const supabase = createClient()

  const finish = useCallback(async () => {
    await supabase
      .from('profiles')
      .update({
        preferred_niche: selectedNiche || null,
        preferred_voice_style: selectedVoice || null,
        onboarding_completed: true,
      })
      .eq('id', userId)
    onComplete()
  }, [userId, selectedNiche, selectedVoice, onComplete, supabase])

  const slides = [
    // Step 0: Welcome
    <motion.div key="welcome" className="flex flex-col items-center text-center gap-6 py-8">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.2 }}
        className="h-20 w-20 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-500 flex items-center justify-center"
      >
        <Sparkles className="h-10 w-10 text-white" />
      </motion.div>
      <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
        Bienvenue sur SUTRA
      </h1>
      <p className="text-white/60 max-w-sm">
        Cree des videos professionnelles avec l&apos;IA en quelques minutes. On va configurer ton experience.
      </p>
    </motion.div>,

    // Step 1: Niche selection
    <motion.div key="niche" className="flex flex-col items-center gap-6 py-4">
      <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
        Choisis ta niche
      </h2>
      <p className="text-white/60 text-sm">On adaptera les suggestions de contenu a ton domaine</p>
      <div className="grid grid-cols-3 gap-3 w-full max-w-md">
        {NICHES.map((niche) => (
          <button
            key={niche}
            onClick={() => setSelectedNiche(niche)}
            className={`rounded-xl border px-3 py-3 text-sm capitalize transition-all ${
              selectedNiche === niche
                ? 'border-violet-500 bg-violet-600/20 text-white'
                : 'border-white/[0.06] bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {niche.replace('-', ' ')}
          </button>
        ))}
      </div>
    </motion.div>,

    // Step 2: Topics
    <motion.div key="topics" className="flex flex-col items-center gap-6 py-4">
      <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
        Ton premier contenu
      </h2>
      <p className="text-white/60 text-sm">Voici 3 idees pour demarrer</p>
      <div className="space-y-3 w-full max-w-md">
        {(SUGGESTED_TOPICS[selectedNiche] ?? SUGGESTED_TOPICS['tech'] ?? []).map((topic, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/[0.06] bg-white/5 p-4 text-sm text-white/80 flex items-center gap-3"
          >
            <Play className="h-4 w-4 text-violet-400 shrink-0" />
            {topic}
          </div>
        ))}
      </div>
      <p className="text-xs text-white/30">Tu pourras creer ta premiere video apres cette etape</p>
    </motion.div>,

    // Step 3: Voice
    <motion.div key="voice" className="flex flex-col items-center gap-6 py-4">
      <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
        Choisis ta voix
      </h2>
      <p className="text-white/60 text-sm">La voix qui narrera tes videos</p>
      <div className="grid grid-cols-2 gap-3 w-full max-w-md">
        {VOICE_STYLES.map((voice) => (
          <button
            key={voice.id}
            onClick={() => setSelectedVoice(voice.id)}
            className={`rounded-xl border p-4 text-left transition-all ${
              selectedVoice === voice.id
                ? 'border-violet-500 bg-violet-600/20'
                : 'border-white/[0.06] bg-white/5 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Mic className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-medium text-white">{voice.name}</span>
            </div>
            <span className="text-xs text-white/40 capitalize">{voice.gender === 'male' ? 'Homme' : 'Femme'}</span>
          </button>
        ))}
      </div>
    </motion.div>,

    // Step 4: Ready
    <motion.div key="ready" className="flex flex-col items-center text-center gap-6 py-8">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.2 }}
        className="text-5xl"
      >
        🎬
      </motion.div>
      <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
        Pret a creer !
      </h2>
      <p className="text-white/60 max-w-sm">
        Tout est configure. Lance ta premiere video et decouvre la magie de SUTRA.
      </p>
      <button
        onClick={finish}
        className="rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-8 py-3 text-white font-semibold hover:opacity-90 transition-opacity"
      >
        Creer ma premiere video
      </button>
    </motion.div>,
  ]

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#06050e]/95 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4">
        <button
          onClick={finish}
          className="absolute -top-10 right-0 text-white/30 hover:text-white/60 text-sm flex items-center gap-1"
        >
          Passer <X className="h-3 w-3" />
        </button>

        <div className="rounded-2xl border border-white/[0.06] bg-[#0f0e1a] p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              {slides[step]}
            </motion.div>
          </AnimatePresence>

          {step < 4 && (
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="flex items-center gap-1 text-sm text-white/40 hover:text-white/70 disabled:opacity-0 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Retour
              </button>

              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === step ? 'w-6 bg-violet-500' : 'w-1.5 bg-white/10'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={() => setStep((s) => Math.min(4, s + 1))}
                className="flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                Suivant <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
