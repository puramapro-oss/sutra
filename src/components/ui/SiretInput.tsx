'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Building2, Check, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type SiretInfo,
  type VerifyState,
  DEBOUNCE_MS,
  normalizeSiret,
  formatSiretDisplay,
} from './siret-utils'
import { VerifiedSiretCard } from './VerifiedSiretCard'

// ---------------------------------------------------------------------------
// <SiretInput /> — champ SIRET 14 chiffres avec vérification INSEE auto.
//
// UX :
//   - 14 chiffres, espaces tolérés (XXX XXX XXX XXXXX style français) et
//     normalisés à la volée.
//   - Vérification auto quand 14 chiffres saisis, debounce 450ms.
//   - États visuels : idle → checking → valid (card entreprise) / not_found /
//     format_invalid / rate_limited / server_error.
//   - Callback onVerified(info) quand l'API renvoie 200. onChange(raw) expose
//     le SIRET normalisé (14 chiffres sans espace) en continu.
//   - Affiche la card entreprise INSEE (denomination, adresse, APE, état).
//
// Backend : POST /api/verify-siret (rate-limité 20 req/min/IP, cache 24h).
//
// Usage :
//   <SiretInput
//     label="SIRET de votre entreprise"
//     onVerified={(info) => setClientInfo(info)}
//   />
// ---------------------------------------------------------------------------

export type { SiretInfo }

export interface SiretInputProps {
  label?: string
  defaultValue?: string
  required?: boolean
  disabled?: boolean
  className?: string
  onChange?: (normalizedSiret: string) => void
  onVerified?: (info: SiretInfo) => void
  onError?: (code: string) => void
  'data-testid'?: string
}

export function SiretInput({
  label = 'SIRET',
  defaultValue = '',
  required,
  disabled,
  className,
  onChange,
  onVerified,
  onError,
  'data-testid': testId,
}: SiretInputProps) {
  const inputId = useId()
  const [value, setValue] = useState(normalizeSiret(defaultValue))
  const [display, setDisplay] = useState(formatSiretDisplay(normalizeSiret(defaultValue)))
  const [focused, setFocused] = useState(false)
  const [state, setState] = useState<VerifyState>({ kind: 'idle' })
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Propager onChange à chaque mise à jour du digit-only SIRET.
  useEffect(() => {
    onChange?.(value)
  }, [value, onChange])

  // Déclencher la vérification INSEE en debounce.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()

    if (value.length === 0) {
      setState({ kind: 'idle' })
      return
    }
    if (value.length < 14) {
      setState({ kind: 'incomplete', length: value.length })
      return
    }

    setState({ kind: 'checking', siret: value })
    debounceRef.current = setTimeout(() => {
      void verify(value)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  async function verify(siret: string) {
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await fetch('/api/verify-siret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siret }),
        signal: ctrl.signal,
      })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        data?: SiretInfo
        fromCache?: boolean
        error?: string
      }

      if (res.ok && body.ok && body.data) {
        const info = body.data
        setState({ kind: 'valid', info, fromCache: Boolean(body.fromCache) })
        onVerified?.(info)
        return
      }

      const err = body.error ?? 'server_error'
      if (res.status === 404 || err === 'not_found') {
        setState({
          kind: 'error',
          code: 'not_found',
          message: 'SIRET introuvable dans le répertoire INSEE.',
        })
        onError?.('not_found')
      } else if (res.status === 400 || err === 'invalid_format') {
        setState({
          kind: 'error',
          code: 'format_invalid',
          message: 'Format SIRET invalide (14 chiffres attendus).',
        })
        onError?.('format_invalid')
      } else if (res.status === 429 || err === 'rate_limited' || err === 'rate_limited_upstream') {
        setState({
          kind: 'error',
          code: 'rate_limited',
          message: 'Trop de vérifications — réessaie dans une minute.',
        })
        onError?.('rate_limited')
      } else if (res.status === 503 || err === 'missing_api_key') {
        setState({
          kind: 'error',
          code: 'missing_api_key',
          message: 'Vérification temporairement indisponible.',
        })
        onError?.('missing_api_key')
      } else {
        setState({
          kind: 'error',
          code: 'server_error',
          message: 'Impossible de joindre INSEE. Réessaie plus tard.',
        })
        onError?.('server_error')
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setState({
        kind: 'error',
        code: 'server_error',
        message: 'Erreur réseau lors de la vérification.',
      })
      onError?.('server_error')
    }
  }

  const isValid = state.kind === 'valid'
  const isError = state.kind === 'error'
  const isChecking = state.kind === 'checking'

  return (
    <div className={cn('relative w-full', className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-2 block text-xs font-medium text-white/60"
        >
          {label}
          {required && <span className="ml-1 text-red-400">*</span>}
        </label>
      )}

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
          <Building2 className="h-4 w-4" />
        </span>

        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          required={required}
          data-testid={testId ?? 'siret-input'}
          placeholder="123 456 789 00012"
          value={display}
          onChange={(e) => {
            const normalized = normalizeSiret(e.target.value)
            setValue(normalized)
            setDisplay(
              focused ? e.target.value : formatSiretDisplay(normalized),
            )
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            setDisplay(formatSiretDisplay(value))
          }}
          className={cn(
            'w-full rounded-xl border bg-white/[0.03] py-3 pl-11 pr-11 text-sm text-white/90 placeholder-white/30 backdrop-blur-xl transition-all duration-200 outline-none',
            isValid
              ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.12)]'
              : isError
                ? 'border-red-500/50'
                : focused
                  ? 'border-violet-500/60 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                  : 'border-white/[0.06] hover:border-white/[0.12]',
            'focus-visible:ring-0',
          )}
        />

        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
          {isChecking && <Loader2 className="h-4 w-4 animate-spin text-violet-400" />}
          {isValid && <Check className="h-4 w-4 text-emerald-400" />}
          {isError && <AlertCircle className="h-4 w-4 text-red-400" />}
        </span>
      </div>

      {state.kind === 'incomplete' && value.length > 0 && (
        <p className="mt-1.5 pl-1 text-xs text-white/40">
          {state.length} / 14 chiffres
        </p>
      )}

      {isError && (
        <p
          data-testid="siret-input-error"
          className="mt-1.5 pl-1 text-xs text-red-400"
        >
          {state.message}
        </p>
      )}

      {isValid && <VerifiedSiretCard info={state.info} fromCache={state.fromCache} />}
    </div>
  )
}

export default SiretInput
