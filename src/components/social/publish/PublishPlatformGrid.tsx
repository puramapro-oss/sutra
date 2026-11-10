import { Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { AccountSelection } from '@/components/settings/social/AccountSelection'
import { MAX_SELECTED_ACCOUNTS, type SocialAccount } from '@/components/settings/social/accounts'

export interface PublishPlatformGridProps {
  accounts: SocialAccount[]
  selectedAccountIds: Set<string>
  onToggleAccount: (accountId: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  accountsLoading: boolean
  accountsError: string | null
  selectionLocked?: boolean
  onRetryFetch: () => void
}

export function PublishPlatformGrid({
  accounts,
  selectedAccountIds,
  onToggleAccount,
  onSelectAll,
  onDeselectAll,
  accountsLoading,
  accountsError,
  selectionLocked = false,
  onRetryFetch,
}: PublishPlatformGridProps) {
  const allSelected = selectedAccountIds.size > 0 && selectedAccountIds.size === accounts.length
  const clearSelection = allSelected || (accounts.length > MAX_SELECTED_ACCOUNTS && selectedAccountIds.size > 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">Comptes de destination</h3>
        <button
          type="button"
          data-testid="publish-toggle-all"
          disabled={selectionLocked || accountsLoading || !!accountsError || accounts.length === 0 || (!clearSelection && accounts.length > MAX_SELECTED_ACCOUNTS)}
          onClick={clearSelection ? onDeselectAll : onSelectAll}
          className="text-xs text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50"
        >
          {clearSelection ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>
      </div>

      {accountsLoading && (
        <div role="status" className="flex items-center justify-center gap-2 py-8 text-white/70">
          Vérification des comptes…
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {accountsError && (
        <div role="alert" className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{accountsError}</p>
            <button type="button" onClick={onRetryFetch} className="mt-1 underline hover:text-red-300">
              Réessayer
            </button>
          </div>
        </div>
      )}

      <Link href="/settings/social" className="inline-block text-xs text-violet-300 underline">Connecter ou vérifier mes comptes</Link>
      {accounts.length > MAX_SELECTED_ACCOUNTS && <p className="text-xs text-white/70">Choisis jusqu’à {MAX_SELECTED_ACCOUNTS} comptes pour cet envoi.</p>}
      {!accountsLoading && !accountsError && (
        <AccountSelection accounts={accounts} selectedAccountIds={[...selectedAccountIds]}
          onToggle={onToggleAccount} disabled={selectionLocked} testIdPrefix="publish-account" />
      )}
    </div>
  )
}
