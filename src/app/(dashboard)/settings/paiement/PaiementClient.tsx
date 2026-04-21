'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadConnectAndInitialize } from '@stripe/connect-js'
import type { StripeConnectInstance } from '@stripe/connect-js'
import {
  ConnectAccountOnboarding,
  ConnectAccountManagement,
  ConnectPayouts,
  ConnectBalances,
  ConnectNotificationBanner,
  ConnectComponentsProvider,
} from '@stripe/react-connect-js'
import { CheckCircle, AlertTriangle, Wallet, ArrowDownCircle, Info } from 'lucide-react'

type ConnectAccount = {
  stripeAccountId: string
  payoutsEnabled: boolean
  chargesEnabled: boolean
  detailsSubmitted: boolean
  onboardingCompleted: boolean
  requirementsCurrentlyDue: string[]
  requirementsPastDue: string[]
}

type WithdrawOk = {
  transferId: string
  amountEur: number
  estimatedFeesEur: number
  netEstimatedEur: number
  tipMessage: string | null
  principalAfter: number
}

type WithdrawErr = { error: string; code?: string; [k: string]: unknown }

const MIN_WITHDRAWAL = 20
const RECOMMENDED_WITHDRAWAL = 50

export function PaiementClient({
  publishableKey,
  connectAccount,
  wallet,
}: {
  publishableKey: string
  connectAccount: ConnectAccount | null
  wallet: { balance: number; principal: number }
}) {
  const [account, setAccount] = useState<ConnectAccount | null>(connectAccount)
  const [initState, setInitState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; instance: StripeConnectInstance }
    | { status: 'error'; message: string }
  >({ status: 'idle' })
  const [principal, setPrincipal] = useState(wallet.principal)
  const [withdraw, setWithdraw] = useState<{
    status: 'idle' | 'loading'
    amount: number
    result?: WithdrawOk
    error?: string
  }>({ status: 'idle', amount: Math.max(MIN_WITHDRAWAL, Math.min(RECOMMENDED_WITHDRAWAL, Math.floor(wallet.principal))) })

  const hasAccount = account !== null
  const ready = Boolean(account?.onboardingCompleted && account?.payoutsEnabled)

  const fetchClientSecret = useMemo(
    () => async () => {
      const res = await fetch('/api/connect/onboard', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(err.error ?? 'Connect session failed')
      }
      const data = (await res.json()) as {
        accountId: string
        clientSecret: string
        payoutsEnabled: boolean
        onboardingCompleted: boolean
      }
      setAccount((prev) => ({
        stripeAccountId: data.accountId,
        payoutsEnabled: data.payoutsEnabled,
        chargesEnabled: prev?.chargesEnabled ?? false,
        detailsSubmitted: prev?.detailsSubmitted ?? false,
        onboardingCompleted: data.onboardingCompleted,
        requirementsCurrentlyDue: prev?.requirementsCurrentlyDue ?? [],
        requirementsPastDue: prev?.requirementsPastDue ?? [],
      }))
      return data.clientSecret
    },
    [],
  )

  useEffect(() => {
    if (!publishableKey) {
      setInitState({ status: 'error', message: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY manquant' })
      return
    }
    setInitState({ status: 'loading' })
    let cancelled = false
    void (async () => {
      try {
        const instance = await loadConnectAndInitialize({
          publishableKey,
          fetchClientSecret,
          appearance: {
            overlays: 'dialog',
            variables: {
              colorPrimary: '#7C3AED',
              colorBackground: '#0A0A0F',
              colorText: '#E5E7EB',
              colorSecondaryText: '#9CA3AF',
              colorBorder: 'rgba(255,255,255,0.08)',
              buttonPrimaryColorBackground: '#7C3AED',
              buttonPrimaryColorText: '#FFFFFF',
              formBackgroundColor: 'rgba(255,255,255,0.02)',
              borderRadius: '12px',
              fontFamily: 'DM Sans, system-ui, sans-serif',
            },
          },
          locale: 'fr-FR',
        })
        if (!cancelled) setInitState({ status: 'ready', instance })
      } catch (err) {
        if (!cancelled) {
          setInitState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Erreur init Stripe Connect',
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [publishableKey, fetchClientSecret])

  async function onWithdrawSubmit() {
    setWithdraw((w) => ({ ...w, status: 'loading', error: undefined, result: undefined }))
    try {
      const res = await fetch('/api/wallet/withdraw/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_eur: withdraw.amount }),
      })
      const json = (await res.json()) as WithdrawOk | WithdrawErr
      if (!res.ok || 'error' in json) {
        setWithdraw((w) => ({
          ...w,
          status: 'idle',
          error: 'error' in json ? json.error : 'Erreur inconnue',
        }))
        return
      }
      setWithdraw((w) => ({ ...w, status: 'idle', result: json }))
      setPrincipal(json.principalAfter)
    } catch (err) {
      setWithdraw((w) => ({
        ...w,
        status: 'idle',
        error: err instanceof Error ? err.message : 'Erreur réseau',
      }))
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 lg:px-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Paiements & Retraits</h1>
        <p className="text-sm text-white/60">
          Configure ton compte de retrait, gère tes virements et retire tes gains vers ton IBAN.
        </p>
      </header>

      <section
        data-testid="wallet-summary"
        className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-[#7C3AED]" />
            <div>
              <p className="text-xs uppercase tracking-wider text-white/50">Solde Principal</p>
              <p className="text-2xl font-bold text-white">{principal.toFixed(2)}€</p>
            </div>
          </div>
          <p className="text-xs text-white/40">
            Seuil minimum retrait&nbsp;: <span className="font-mono text-white/70">{MIN_WITHDRAWAL}€</span>
          </p>
        </div>
      </section>

      {initState.status === 'error' ? (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
            <div>
              <p className="font-semibold text-red-300">Stripe Connect indisponible</p>
              <p className="mt-1 text-sm text-red-200/80">{initState.message}</p>
            </div>
          </div>
        </section>
      ) : initState.status !== 'ready' ? (
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center text-white/60">
          Chargement de Stripe Connect…
        </section>
      ) : (
        <ConnectComponentsProvider connectInstance={initState.instance}>
          <ConnectNotificationBanner />

          {!account?.onboardingCompleted ? (
            <section
              data-testid="connect-onboarding"
              className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6"
            >
              <h2 className="mb-2 text-xl font-semibold text-white">
                Active tes retraits en quelques minutes
              </h2>
              <p className="mb-6 text-sm text-white/60">
                Fournis ton identité et ton IBAN français à Stripe pour débloquer les retraits vers
                ta banque. Tes données restent chez Stripe, pas chez SUTRA.
              </p>
              <ConnectAccountOnboarding
                onExit={() => {
                  // Refresh le statut quand le user sort de l'iframe
                  void fetch('/api/connect/onboard').then(async (r) => {
                    if (!r.ok) return
                    const j = (await r.json()) as {
                      exists: boolean
                      accountId?: string
                      payoutsEnabled: boolean
                      onboardingCompleted: boolean
                      requirementsCurrentlyDue: string[]
                      requirementsPastDue: string[]
                      chargesEnabled?: boolean
                      detailsSubmitted?: boolean
                    }
                    if (j.exists && j.accountId) {
                      setAccount({
                        stripeAccountId: j.accountId,
                        payoutsEnabled: j.payoutsEnabled,
                        chargesEnabled: j.chargesEnabled ?? false,
                        detailsSubmitted: j.detailsSubmitted ?? false,
                        onboardingCompleted: j.onboardingCompleted,
                        requirementsCurrentlyDue: j.requirementsCurrentlyDue ?? [],
                        requirementsPastDue: j.requirementsPastDue ?? [],
                      })
                    }
                  })
                }}
              />
            </section>
          ) : (
            <>
              <section
                data-testid="connect-ready"
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                  <p className="text-sm text-emerald-200">
                    Compte de retrait activé — tu peux retirer vers ton IBAN.
                  </p>
                </div>
              </section>

              <section
                data-testid="withdraw-form"
                className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6"
              >
                <div className="mb-4 flex items-center gap-3">
                  <ArrowDownCircle className="h-5 w-5 text-[#06B6D4]" />
                  <h2 className="text-xl font-semibold text-white">Retirer mes gains</h2>
                </div>

                <label className="block text-sm text-white/70">
                  Montant (€)
                  <input
                    type="number"
                    min={MIN_WITHDRAWAL}
                    max={Math.max(MIN_WITHDRAWAL, Math.floor(principal))}
                    step={1}
                    value={withdraw.amount}
                    onChange={(e) =>
                      setWithdraw((w) => ({ ...w, amount: Number(e.target.value) }))
                    }
                    className="mt-2 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 font-mono text-white placeholder-white/30 focus:border-[#7C3AED] focus:outline-none"
                    disabled={withdraw.status === 'loading' || !ready}
                  />
                </label>

                {withdraw.amount < RECOMMENDED_WITHDRAWAL && withdraw.amount >= MIN_WITHDRAWAL && (
                  <p className="mt-3 flex items-start gap-2 text-xs text-amber-300/90">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Astuce&nbsp;: retire à partir de {RECOMMENDED_WITHDRAWAL}€ pour payer moins de
                    frais (frais fixes absorbés). Frais prélevés par Stripe, pas par Purama.
                  </p>
                )}

                <button
                  type="button"
                  data-testid="withdraw-submit"
                  onClick={onWithdrawSubmit}
                  disabled={
                    withdraw.status === 'loading' ||
                    withdraw.amount < MIN_WITHDRAWAL ||
                    withdraw.amount > principal ||
                    !ready
                  }
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {withdraw.status === 'loading' ? 'En cours…' : `Retirer ${withdraw.amount}€`}
                </button>

                {withdraw.error && (
                  <p
                    data-testid="withdraw-error"
                    className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300"
                  >
                    {withdraw.error}
                  </p>
                )}
                {withdraw.result && (
                  <div
                    data-testid="withdraw-success"
                    className="mt-4 space-y-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-200"
                  >
                    <p className="font-semibold">Retrait envoyé 🎉</p>
                    <p className="text-xs text-emerald-200/80">
                      Transfer ID : <span className="font-mono">{withdraw.result.transferId}</span>
                    </p>
                    <p className="text-xs text-emerald-200/80">
                      Net estimé : {withdraw.result.netEstimatedEur.toFixed(2)}€ (frais ~
                      {withdraw.result.estimatedFeesEur.toFixed(2)}€)
                    </p>
                    {withdraw.result.tipMessage && (
                      <p className="text-xs text-amber-300/80">{withdraw.result.tipMessage}</p>
                    )}
                  </div>
                )}
              </section>

              <section
                data-testid="connect-balances"
                className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6"
              >
                <h2 className="mb-4 text-lg font-semibold text-white">Solde Stripe Connect</h2>
                <ConnectBalances />
              </section>

              <section
                data-testid="connect-payouts"
                className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6"
              >
                <h2 className="mb-4 text-lg font-semibold text-white">Historique des retraits</h2>
                <ConnectPayouts />
              </section>

              <section
                data-testid="connect-management"
                className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6"
              >
                <h2 className="mb-4 text-lg font-semibold text-white">Gestion du compte</h2>
                <ConnectAccountManagement />
              </section>
            </>
          )}
        </ConnectComponentsProvider>
      )}

      {!hasAccount && (
        <p className="text-xs text-white/40">
          Compte Connect créé automatiquement lors de la première visite.
        </p>
      )}
    </div>
  )
}
