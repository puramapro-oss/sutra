'use client'

import { lazy, Suspense, useMemo, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/Button'
import { createDurableRequestStore } from '@/lib/durable-request-store'
import { importStoryboardDraft, readStoryboardDraft, STORYBOARD_DRAFT_EVENT, storyboardDraftKey, StoryboardDraftError,
  type ManualStoryboardDraft, type StoryboardCreateDraft } from '@/lib/storyboard-create-draft'

const CinemaExport = lazy(() => import('./CinemaExport'))
interface DraftState {
  packet: StoryboardCreateDraft | null; error: string | null; notice: string | null
  replaceConfirmed: boolean; busy: boolean; cancelling: boolean
}
const errorMessage = (error: unknown) => error instanceof StoryboardDraftError ? error.message : 'Le stockage de cet onglet est indisponible. Aucun brouillon n’a été importé.'

function createDraftStore(userId?: string) {
  const initial: DraftState = { packet: null, error: null, notice: null, replaceConfirmed: false, busy: false, cancelling: false }
  const read = (): DraftState => {
    if (!userId) return initial
    try { return { ...initial, packet: readStoryboardDraft(sessionStorage, userId) } }
    catch (error) { return { ...initial, error: errorMessage(error) } }
  }
  const store = createDurableRequestStore<DraftState, { controller: AbortController }>(initial, read)
  let key: string | null = null
  try { key = userId ? storyboardDraftKey(userId) : null } catch { /* read() reports the invalid owner. */ }
  let subscribed = false
  const refresh = () => {
    const next = read(), current = store.getSnapshot()
    if (JSON.stringify(next.packet) !== JSON.stringify(current.packet) || next.error !== current.error) {
      store.set('replaceConfirmed', false); store.set('notice', null)
      store.set('packet', next.packet); store.set('error', next.error)
    }
  }
  return { ...store, subscribe(listener: () => void) {
    const unsubscribe = store.subscribe(listener)
    // Next can preserve a page across navigation. A returning subscriber must see a new handoff.
    if (subscribed) refresh()
    subscribed = true
    const onStorage = (event: StorageEvent) => { if (!event.key || (key && event.key === key)) refresh() }
    window.addEventListener('storage', onStorage)
    window.addEventListener('pageshow', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener(STORYBOARD_DRAFT_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('pageshow', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener(STORYBOARD_DRAFT_EVENT, refresh)
      unsubscribe()
    }
  } }
}

export default function StoryboardDraftImport({ userId, requestLocked, hasDraft, onImport }: {
  userId?: string; requestLocked: boolean; hasDraft: boolean; onImport: (draft: ManualStoryboardDraft) => void
}) {
  const store = useMemo(() => createDraftStore(userId), [userId])
  const { packet, error, notice, replaceConfirmed } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
  if (!packet) return error ? <p role="alert" className="rounded-xl border border-red-500/20 p-4 text-sm text-red-200">{error}</p> : null
  const needsConsent = hasDraft || packet.importCount > 0
  const handleImport = () => {
    if (!userId) return
    const current = store.getSnapshot()
    if (!current.packet) return
    try {
      const result = importStoryboardDraft(sessionStorage, userId, current.packet,
        { requestLocked, hasDraft, replaceConfirmed: current.replaceConfirmed })
      store.set('replaceConfirmed', false); store.set('packet', result.packet); store.set('error', null)
      onImport(result.draft)
      store.set('notice', 'Descriptions importées en mode manuel. Vérifie les étapes avant de lancer une génération. Le storyboard original reste disponible dans cet onglet.')
    } catch (cause) { store.set('error', errorMessage(cause)) }
  }
  return (
    <section aria-label="Brouillon manuel depuis le storyboard" className="rounded-xl border border-violet-400/25 bg-violet-500/5 p-4 space-y-3">
      <h2 className="font-semibold text-white">Préparer un script manuel depuis ton storyboard</h2>
      <p className="text-sm text-white/75">{packet.source.scenes.length} plans · {packet.source.format} · {packet.source.idea || 'Mon storyboard'}</p>
      <p className="text-sm text-amber-200" id="storyboard-draft-limits">
        Seuls le sujet, le format et les descriptions seront copiés. Chaque description deviendra une ligne de narration et une scène de 5 secondes.
        Les instructions visuelles séparées, les durées et les transitions du storyboard ne seront pas reprises. Aucune génération ne démarre lors de l’import.
      </p>
      {packet.importCount > 0 && <p className="text-sm text-white/70">Ce storyboard a déjà été importé. Une nouvelle importation demande une confirmation.</p>}
      {needsConsent && <label className="flex items-start gap-2 text-sm text-white/80">
        <input type="checkbox" checked={replaceConfirmed} disabled={requestLocked}
          onChange={event => store.set('replaceConfirmed', event.target.checked)} className="mt-1" />
        Je confirme le remplacement du brouillon affiché par les descriptions de ce storyboard.
      </label>}
      <Button onClick={handleImport} disabled={requestLocked || (needsConsent && !replaceConfirmed)} aria-describedby="storyboard-draft-limits" data-testid="import-storyboard-draft-btn">
        {packet.importCount > 0 ? 'Réimporter les descriptions en script manuel' : 'Importer les descriptions en script manuel'}
      </Button>
      {requestLocked && <p role="status" className="text-sm text-amber-200">Une demande est en cours ou sa vérification n’est pas terminée. Reprends son suivi avant d’importer.</p>}
      {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="text-sm text-violet-200">{notice}</p>}
      <details>
        <summary className="cursor-pointer py-2 text-sm font-medium text-violet-200">Conserver le storyboard original complet</summary>
        <p className="text-sm text-white/70">Télécharge le projet pour le conserver après la fermeture de cet onglet.</p>
        <Suspense fallback={<p className="text-sm text-white/70">Préparation de l’export du storyboard…</p>}>
          <CinemaExport title={packet.source.idea} format={packet.source.format} scenes={packet.source.scenes} />
        </Suspense>
      </details>
    </section>
  )
}
