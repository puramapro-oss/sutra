'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { Sprout, Loader2 } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import dynamic from 'next/dynamic'

const Confetti = dynamic(() => import('@/components/shared/Confetti'), { ssr: false })

interface Segment {
  index: number
  label: string
  seeds: number
  badge: string | null
}

interface Spin {
  segment_index: number
  seeds_won: number
  badge_won: string | null
  created_at?: string
  spin_date?: string
}

interface DharmaResponse {
  segments: Segment[]
  today_spin: Spin | null
  can_spin: boolean
  history: Spin[]
}

const SEGMENT_COLORS = [
  'bg-emerald-500/20',
  'bg-cyan-500/20',
  'bg-sky-500/20',
  'bg-blue-500/20',
  'bg-indigo-500/20',
  'bg-violet-500/20',
  'bg-fuchsia-500/20',
  'bg-pink-500/20',
  'bg-rose-500/20',
  'bg-orange-500/20',
  'bg-amber-500/20',
  'bg-yellow-500/20',
]

export default function DharmaPage() {
  const [state, setState] = useState<DharmaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const [lastSpin, setLastSpin] = useState<Spin | null>(null)
  const controls = useAnimation()
  const rotationRef = useRef(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/karma/games/dharma', { cache: 'no-store' })
      if (res.status === 401) return
      const data = await res.json()
      setState(data)
    } catch {
      toast.error('Impossible de charger la roue.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const segmentAngle = 360 / 12

  const spinToSegment = useCallback(async (segmentIndex: number) => {
    // On veut que la flèche (en haut) pointe vers le segment d'index segmentIndex.
    // Les segments sont dessinés de l'index 0 (haut) dans le sens horaire.
    const target = -segmentIndex * segmentAngle
    const fullRotations = 6
    const finalRotation = rotationRef.current + fullRotations * 360 + (target - (rotationRef.current % 360))
    rotationRef.current = finalRotation

    await controls.start({
      rotate: finalRotation,
      transition: { duration: 4.2, ease: [0.17, 0.67, 0.12, 0.99] },
    })
  }, [controls, segmentAngle])

  const handleSpin = async () => {
    if (!state?.can_spin || spinning) return
    setSpinning(true)
    try {
      const res = await fetch('/api/karma/games/dharma', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erreur')
        setSpinning(false)
        return
      }

      await spinToSegment(data.segment_index)
      setLastSpin({
        segment_index: data.segment_index,
        seeds_won: data.seeds_won,
        badge_won: data.badge_won,
      })
      setCelebrate(true)
      setTimeout(() => setCelebrate(false), 3500)
      toast.success(`+${data.seeds_won} graines 🌱 ${data.label}`)
      await load()
    } catch {
      toast.error('Erreur réseau.')
    } finally {
      setSpinning(false)
    }
  }

  const segments = useMemo(() => state?.segments ?? [], [state])
  const todaySpin = state?.today_spin ?? lastSpin

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 pb-20 lg:pb-10">
      <Confetti active={celebrate} duration={3000} />

      <div>
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Link href="/karma" className="hover:text-white">KARMA</Link>
          <span>·</span>
          <span className="text-white/80">Roue du Dharma</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold text-white">Roue du Dharma</h1>
        <p className="mt-1 text-sm text-white/60">
          Un tour par jour. Chaque rotation offre des graines 🌱.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col items-center gap-6 rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-xl">
            <div className="relative h-[320px] w-[320px] sm:h-[400px] sm:w-[400px]">
              {/* Flèche indicatrice en haut */}
              <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/3">
                <div className="h-0 w-0 border-x-[14px] border-t-[20px] border-x-transparent border-t-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              </div>

              <motion.div
                animate={controls}
                className="relative h-full w-full rounded-full border-2 border-white/10 shadow-[0_0_40px_rgba(52,211,153,0.15)]"
                style={{ transformOrigin: 'center' }}
                data-testid="dharma-wheel"
              >
                <svg viewBox="0 0 200 200" className="h-full w-full">
                  <defs>
                    {SEGMENT_COLORS.map((_, i) => (
                      <linearGradient key={i} id={`grad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={`hsl(${(i * 30) % 360}, 70%, 55%)`} stopOpacity="0.5" />
                        <stop offset="100%" stopColor={`hsl(${(i * 30 + 40) % 360}, 70%, 45%)`} stopOpacity="0.7" />
                      </linearGradient>
                    ))}
                  </defs>
                  {segments.map((seg, i) => {
                    const startAngle = (i * segmentAngle - 90 - segmentAngle / 2) * (Math.PI / 180)
                    const endAngle = ((i + 1) * segmentAngle - 90 - segmentAngle / 2) * (Math.PI / 180)
                    const x1 = 100 + 98 * Math.cos(startAngle)
                    const y1 = 100 + 98 * Math.sin(startAngle)
                    const x2 = 100 + 98 * Math.cos(endAngle)
                    const y2 = 100 + 98 * Math.sin(endAngle)
                    const textAngle = i * segmentAngle - 90
                    const textRad = textAngle * (Math.PI / 180)
                    const tx = 100 + 62 * Math.cos(textRad)
                    const ty = 100 + 62 * Math.sin(textRad)
                    return (
                      <g key={seg.index}>
                        <path
                          d={`M 100,100 L ${x1},${y1} A 98,98 0 0,1 ${x2},${y2} Z`}
                          fill={`url(#grad-${i})`}
                          stroke="rgba(255,255,255,0.15)"
                          strokeWidth="0.5"
                        />
                        <text
                          x={tx}
                          y={ty}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="white"
                          fontSize="7"
                          fontWeight="600"
                          transform={`rotate(${textAngle + 90}, ${tx}, ${ty})`}
                        >
                          {seg.label}
                        </text>
                        <text
                          x={tx}
                          y={ty + 8}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="rgba(255,255,255,0.7)"
                          fontSize="5"
                          transform={`rotate(${textAngle + 90}, ${tx}, ${ty + 8})`}
                        >
                          +{seg.seeds}
                        </text>
                      </g>
                    )
                  })}
                  <circle cx="100" cy="100" r="14" fill="#0A0A0F" stroke="rgba(52,211,153,0.4)" strokeWidth="1.5" />
                </svg>
              </motion.div>
            </div>

            <button
              type="button"
              onClick={handleSpin}
              disabled={!state?.can_spin || spinning}
              data-testid="dharma-spin-button"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-8 py-3 text-base font-semibold text-black transition hover:shadow-[0_0_32px_rgba(52,211,153,0.4)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {spinning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  La roue tourne…
                </>
              ) : state?.can_spin ? (
                <>
                  <Sprout className="h-4 w-4" />
                  Faire tourner
                </>
              ) : (
                'Reviens demain'
              )}
            </button>
          </div>

          <aside className="space-y-4">
            {todaySpin && (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-5">
                <p className="text-xs uppercase tracking-wider text-emerald-200/70">Tirage du jour</p>
                <p className="mt-2 font-mono text-2xl font-bold text-white">
                  +{todaySpin.seeds_won} 🌱
                </p>
                {todaySpin.badge_won && (
                  <p className="mt-1 text-sm text-amber-200">Badge : {todaySpin.badge_won}</p>
                )}
                <p className="mt-2 text-xs text-white/50">
                  {segments.find(s => s.index === todaySpin.segment_index)?.label}
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-xs uppercase tracking-wider text-white/50">7 derniers tirages</p>
              <ul className="mt-3 space-y-2 text-sm">
                {(state?.history ?? []).length === 0 ? (
                  <li className="text-white/40">Aucun tirage encore.</li>
                ) : (
                  state?.history.map((h, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-white/80">
                      <span className="text-xs text-white/50">{h.spin_date}</span>
                      <span className="font-mono text-white">+{h.seeds_won} 🌱</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
