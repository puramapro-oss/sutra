import { Check } from 'lucide-react'
import { PLATFORM_INFO } from '@/lib/zernio'
import { cn } from '@/lib/utils'
import { accountLabel, isAccountAvailable, MAX_SELECTED_ACCOUNTS, type SocialAccount } from './accounts'

interface AccountSelectionProps {
  accounts: SocialAccount[]
  selectedAccountIds: readonly string[]
  onToggle: (accountId: string) => void
  disabled?: boolean
  testIdPrefix: string
}

export function AccountSelection({ accounts, selectedAccountIds, onToggle, disabled = false, testIdPrefix }: AccountSelectionProps) {
  const selected = new Set(selectedAccountIds)
  const available = accounts.filter(account => isAccountAvailable(account))
  const unavailable = selectedAccountIds.filter(id => !available.some(account => account.id === id))
  return (
    <div className="space-y-3">
      <p className="text-xs text-white/70">{selected.size} compte{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}. Les nouveaux comptes restent désélectionnés.</p>
      {available.length === 0 && <p className="text-sm text-white/70">Aucun compte connecté disponible. Connecte un compte dans les paramètres sociaux.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {available.map(account => {
          const info = PLATFORM_INFO[account.platform]
          const checked = selected.has(account.id)
          return (
            <button key={account.id} type="button" aria-pressed={checked}
              aria-label={`${info.label} : ${accountLabel(account)}`}
              data-testid={`${testIdPrefix}-${account.id}`}
              disabled={disabled || (!checked && selected.size >= MAX_SELECTED_ACCOUNTS)}
              onClick={() => onToggle(account.id)}
              className={cn('flex min-w-0 items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors disabled:opacity-50', checked ? 'bg-violet-500/15 border-violet-500/50 text-white' : 'bg-white/[0.02] border-white/[0.08] text-white/70 hover:border-white/20')}>
              <span aria-hidden>{info.icon}</span>
              <span className="min-w-0 flex-1"><span className="block font-medium">{info.label}</span><span className="block break-words text-xs">{accountLabel(account)}</span></span>
              {checked && <Check className="h-4 w-4 shrink-0 text-violet-300" aria-hidden />}
            </button>
          )
        })}
      </div>
      {selected.size >= MAX_SELECTED_ACCOUNTS && <p role="status" className="text-xs text-amber-200">Limite de {MAX_SELECTED_ACCOUNTS} comptes par publication atteinte.</p>}
      {unavailable.length > 0 && <div className="space-y-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3" role="alert">
        <p className="text-sm text-amber-200">Certains comptes choisis ne sont plus disponibles. Reconnecte-les ou retire-les avant d’enregistrer.</p>
        {unavailable.map((id, index) => {
          const account = accounts.find(item => item.id === id)
          const label = account ? `${PLATFORM_INFO[account.platform].label} : ${accountLabel(account)}` : `Compte indisponible ${index + 1}`
          return <div key={id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/80">
            <span className="break-words">{label}</span>
            <button type="button" disabled={disabled} onClick={() => onToggle(id)} data-testid={`${testIdPrefix}-remove-${id}`} aria-label={`Retirer ${label}`} className="underline disabled:opacity-50">Retirer</button>
          </div>
        })}
      </div>}
    </div>
  )
}
