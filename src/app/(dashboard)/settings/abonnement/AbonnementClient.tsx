'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pause, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react'

type Profile = {
  plan: string
  status: string
  subscription_started_at: string | null
  stripe_subscription_id: string | null
}
type Subscription = {
  plan: string
  status: string
  started_at: string
  ends_at: string | null
  cancelled_at: string | null
} | null

type Step = 0 | 1 | 2 | 3
const REASONS = [
  'Trop cher',
  "Pas assez de gains",
  "J'utilise une autre app",
  'Autre raison',
]

export function AbonnementClient({
  profile,
  subscription,
  pendingPrimeEuros,
  filleulsCount,
}: {
  profile: Profile
  subscription: Subscription
  pendingPrimeEuros: number
  filleulsCount: number
}) {
  const [step, setStep] = useState<Step>(0)
  const [reason, setReason] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const plan = subscription?.plan ?? profile.plan
  const isActive = profile.status === 'active'
  const startedAt = profile.subscription_started_at
    ? new Date(profile.subscription_started_at)
    : null
  const endsAt = subscription?.ends_at ? new Date(subscription.ends_at) : null

  const handlePause = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/stripe/subscription/pause', { method: 'POST' })
      if (!res.ok) throw new Error('Erreur pause')
      window.location.reload()
    } catch {
      alert("Impossible de mettre en pause pour le moment. Contacte le support.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/stripe/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) throw new Error('Erreur résiliation')
      setDone(true)
    } catch {
      alert("Impossible de résilier maintenant. Contacte le support.")
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center">
        <div className="glass-card p-8">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Résiliation enregistrée</h1>
          <p className="text-white/70">
            On espère te revoir. Ton compte reste actif jusqu'au{' '}
            <strong>{endsAt?.toLocaleDateString('fr-FR') ?? 'la fin de la période en cours'}</strong>.
          </p>
          <Link href="/dashboard" className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-[var(--color-accent)] font-semibold">
            Retour au dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Mon abonnement</h1>
        <p className="text-white/60 mt-1">Gère ton plan, mets en pause ou résilie.</p>
      </header>

      <section className="glass-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm text-white/60">Plan actuel</div>
            <div className="text-2xl font-bold capitalize mt-1">{plan}</div>
            <div className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${
              isActive ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-white/70'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-white/50'}`} />
              {profile.status === 'active' ? 'Actif' : profile.status === 'past_due' ? 'En retard' : profile.status === 'cancelled' ? 'Résilié' : 'Inactif'}
            </div>
          </div>

          {startedAt && (
            <div className="text-right text-sm">
              <div className="text-white/60">Abonné depuis le</div>
              <div className="font-semibold">{startedAt.toLocaleDateString('fr-FR')}</div>
            </div>
          )}
        </div>

        <div className="mt-5 pt-5 border-t border-white/10 text-xs text-white/55">
          Accès immédiat activé conformément à l'art. L221-28 3° du Code de la consommation.
          La résiliation prend effet en fin de période de facturation. Les données sont conservées 3 ans (RGPD).
        </div>
      </section>

      {!isActive && (
        <div className="glass-card p-6 text-center">
          <p className="text-white/70 mb-4">Aucun abonnement actif actuellement.</p>
          <Link href="/pricing" className="inline-block px-5 py-2.5 rounded-xl bg-[var(--color-accent)] font-semibold">
            Voir les plans
          </Link>
        </div>
      )}

      {isActive && step === 0 && (
        <section className="glass-card p-6 space-y-3">
          <h2 className="font-semibold">Actions</h2>
          <Link
            href="/api/stripe/portal"
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition text-left"
          >
            <RefreshCw className="w-5 h-5 text-white/70" />
            <div className="flex-1">
              <div className="font-medium">Changer de plan ou moyen de paiement</div>
              <div className="text-xs text-white/55">Portail Stripe sécurisé</div>
            </div>
          </Link>
          <button
            onClick={handlePause}
            disabled={submitting}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition text-left"
          >
            <Pause className="w-5 h-5 text-white/70" />
            <div className="flex-1">
              <div className="font-medium">Mettre en pause 1 mois</div>
              <div className="text-xs text-white/55">Tu gardes ton streak, tes multiplicateurs et tes filleuls</div>
            </div>
          </button>
          <button
            onClick={() => setStep(1)}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-400/5 border border-red-400/20 hover:bg-red-400/10 transition text-left"
          >
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <div className="flex-1">
              <div className="font-medium text-red-200">Résilier mon abonnement</div>
              <div className="text-xs text-white/55">Fin d'accès à la date de fin de période</div>
            </div>
          </button>
        </section>
      )}

      {isActive && step === 1 && (
        <section className="glass-card p-6 border-red-400/30 space-y-4">
          <h2 className="text-xl font-bold">Avant de partir...</h2>
          <p className="text-sm text-white/70">Voici ce que tu vas perdre :</p>
          <ul className="space-y-2 text-sm">
            {pendingPrimeEuros > 0 && (
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">→</span>
                <span><strong>{pendingPrimeEuros.toFixed(2)} €</strong> de prime en attente (tranches 2 et 3 annulées)</span>
              </li>
            )}
            {filleulsCount > 0 && (
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">→</span>
                <span>Tes commissions récurrentes sur <strong>{filleulsCount} filleul{filleulsCount > 1 ? 's' : ''}</strong></span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">→</span>
              <span>Ton streak et tes multiplicateurs cumulés</span>
            </li>
          </ul>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep(0)} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 font-medium">
              Annuler
            </button>
            <button onClick={() => setStep(2)} className="flex-1 py-2.5 rounded-xl bg-red-400/20 text-red-200 hover:bg-red-400/30 font-medium">
              Continuer
            </button>
          </div>
        </section>
      )}

      {isActive && step === 2 && (
        <section className="glass-card p-6 border-amber-400/30 space-y-4">
          <Pause className="w-10 h-10 text-amber-400" />
          <h2 className="text-xl font-bold">Et si tu mettais en pause 1 mois ?</h2>
          <p className="text-sm text-white/75">
            Tu gardes ton accès complet pendant 1 mois sans facturation. Tu gardes aussi ton streak, tes multiplicateurs et tes filleuls.
            Tu peux reprendre quand tu veux.
          </p>
          <div className="flex gap-3 pt-2">
            <button onClick={handlePause} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-amber-400/20 text-amber-200 hover:bg-amber-400/30 font-medium disabled:opacity-50">
              Mettre en pause
            </button>
            <button onClick={() => setStep(3)} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 font-medium">
              Résilier quand même
            </button>
          </div>
        </section>
      )}

      {isActive && step === 3 && (
        <section className="glass-card p-6 space-y-4">
          <h2 className="text-xl font-bold">Qu'est-ce qui t'a fait partir ?</h2>
          <p className="text-sm text-white/70">
            Ton retour nous aide à améliorer SUTRA pour tous. Une seule réponse suffit.
          </p>
          <div className="space-y-2">
            {REASONS.map((r) => (
              <label key={r} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                reason === r ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/50' : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
              }`}>
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-full border-2 ${reason === r ? 'border-[var(--color-accent)] bg-[var(--color-accent)]' : 'border-white/40'}`} />
                <span>{r}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep(0)} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 font-medium">
              Garder mon abonnement
            </button>
            <button
              onClick={handleCancel}
              disabled={submitting || !reason}
              className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold disabled:opacity-50"
            >
              {submitting ? '...' : 'Confirmer la résiliation'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
