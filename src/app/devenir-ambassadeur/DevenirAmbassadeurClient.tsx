'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Sparkles,
  Crown,
  TrendingUp,
  Gift,
  Users,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { AMBASSADOR_TIERS } from '@/lib/ambassador'
import { cn } from '@/lib/utils'

export default function DevenirAmbassadeurClient() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [instagram, setInstagram] = useState('')
  const [youtube, setYoutube] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [motivation, setMotivation] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/partner/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          social_links: { instagram, youtube, tiktok },
          motivation,
          canal: 'ambassadeur',
        }),
      })
      if (res.ok) {
        setSuccess(true)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data?.error ?? 'Une erreur est survenue. Réessaie dans un instant.')
      }
    } catch {
      setError('Connexion impossible. Vérifie ton réseau et réessaie.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card max-w-md w-full p-8 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-300" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Candidature reçue !</h1>
          <p className="text-white/70 text-sm mb-6">
            Merci {name}. On étudie ta candidature et on te répond sous 48h par email.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-colors"
          >
            Retour à l&apos;accueil
          </Link>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="min-h-screen py-12 md:py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10 md:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-200 text-xs font-semibold mb-4">
            <Crown className="h-3.5 w-3.5" />
            Programme Ambassadeur Purama
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 font-[var(--font-display)]">
            Gagne à vie en partageant SUTRA
          </h1>
          <p className="text-white/70 text-base md:text-lg max-w-2xl mx-auto">
            9 paliers. Jusqu&apos;à <strong className="text-amber-200">200 000 €</strong> de prime.
            Commissions <strong className="text-violet-200">50% / 15% / 7%</strong> sur 3 niveaux
            pour toujours.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3 mb-10">
          {AMBASSADOR_TIERS.map((tier, i) => (
            <motion.div
              key={tier.level}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={cn(
                'glass-card p-4 text-center',
                i >= 6 && 'border-amber-400/40 bg-amber-500/[0.04]'
              )}
            >
              <div className="text-xs text-white/50 mb-1">{tier.display}</div>
              <div className="text-xl font-bold text-white tabular-nums">
                {tier.prime_eur.toLocaleString('fr-FR')} €
              </div>
              <div className="text-[11px] text-white/40 mt-1">
                {tier.filleuls_required.toLocaleString('fr-FR')} filleuls
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-10">
          <Benefit
            icon={Users}
            title="3 niveaux à vie"
            text="50% N1 · 15% N2 · 7% N3. Commission versée tant que ton filleul est abonné."
          />
          <Benefit
            icon={Gift}
            title="Primes à chaque palier"
            text="De 200 € (Bronze) à 200 000 € (Éternel). Versement automatique au palier atteint."
          />
          <Benefit
            icon={TrendingUp}
            title="Outils fournis"
            text="Lien unique, QR code, page perso, kit créateur, Academy, dashboard temps réel."
          />
        </div>

        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="glass-card p-6 md:p-8"
        >
          <h2 className="text-xl md:text-2xl font-bold text-white mb-1">
            Postuler maintenant
          </h2>
          <p className="text-sm text-white/60 mb-6">
            1 minute. Réponse sous 48h par email.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <Field label="Prénom &amp; nom" required>
              <input
                data-testid="input-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-violet-400/60 transition-colors"
              />
            </Field>
            <Field label="Email" required>
              <input
                data-testid="input-email"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="toi@exemple.com"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-violet-400/60 transition-colors"
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <Field label="Instagram">
              <input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@pseudo"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-violet-400/60 transition-colors"
              />
            </Field>
            <Field label="YouTube">
              <input
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                placeholder="@chaine"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-violet-400/60 transition-colors"
              />
            </Field>
            <Field label="TikTok">
              <input
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value)}
                placeholder="@pseudo"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-violet-400/60 transition-colors"
              />
            </Field>
          </div>

          <Field label="Pourquoi toi ? (facultatif)">
            <textarea
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              rows={3}
              placeholder="Raconte ta communauté, tes projets, ton envie de faire équipe."
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-violet-400/60 transition-colors resize-none"
            />
          </Field>

          {error && (
            <div className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <button
            data-testid="submit-ambassador"
            type="submit"
            disabled={loading || !name || !email}
            className="mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-[#0A0A0F] text-sm font-semibold hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Envoyer ma candidature
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </motion.form>
      </div>
    </main>
  )
}

function Benefit({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Sparkles
  title: string
  text: string
}) {
  return (
    <div className="glass-card p-5">
      <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mb-3">
        <Icon className="h-5 w-5 text-violet-200" />
      </div>
      <h3 className="font-semibold text-white text-sm mb-1">{title}</h3>
      <p className="text-xs text-white/60 leading-relaxed">{text}</p>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: React.ReactNode
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-white/70 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  )
}
