import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { downloadText } from '@/lib/download-text'
import { createStoryboardBrief, importStoryboardText } from '@/lib/storyboard-exchange'
import type { Scene } from '@/lib/storyboard'
import type { StoryboardDraftSource } from '@/lib/storyboard-create-draft'

interface Props {
  source: StoryboardDraftSource
  busy: boolean
  onImport: (scenes: Scene[]) => void
}

export default function StoryboardExchange({ source, busy, onImport }: Props) {
  const field = useId()
  const [response, setResponse] = useState('')
  const [replace, setReplace] = useState(false)
  const [notice, setNotice] = useState('')
  const [showLauncher, setShowLauncher] = useState(false)
  const [error, setError] = useState('')
  const hasScenes = source.scenes.length > 0
  const canExport = Boolean(source.idea.trim() || hasScenes)

  async function exportBrief(destination: 'chatgpt' | 'motionlab') {
    setNotice('')
    setError('')
    try {
      const brief = createStoryboardBrief(destination, source)
      if (destination === 'chatgpt') {
        try {
          await navigator.clipboard.writeText(brief)
          setNotice('Brief copié. Colle-le dans ChatGPT ou Codex.')
          return
        } catch {
          // A download remains available when the clipboard is denied or unsupported.
          downloadText(brief, 'sutra-brief-chatgpt.txt', 'text/plain;charset=utf-8')
          setNotice('Le presse-papiers est indisponible. Le téléchargement du brief ChatGPT a été lancé.')
        }
      } else {
        downloadText(brief, 'sutra-brief-motionlab.txt', 'text/plain;charset=utf-8')
        setShowLauncher(true)
        setNotice('Téléchargement lancé. Utilise le brief dans Codex avec ton dossier MotionLab.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de préparer ce brief.')
    }
  }

  function importScenes() {
    if (busy || (hasScenes && !replace)) return
    setNotice('')
    setError('')
    try {
      const scenes = importStoryboardText(response, source.format)
      onImport(scenes)
      setReplace(false)
      setResponse('')
      setNotice(scenes.length === 1
        ? 'Un plan importé. Tu peux le modifier dans le storyboard.'
        : `${scenes.length} plans importés. Tu peux les modifier dans le storyboard.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de lire ces plans.')
    }
  }

  return (
    <details className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <summary className="cursor-pointer font-semibold text-white">Travailler avec ChatGPT, Codex ou MotionLab</summary>
      <div className="mt-4 space-y-4">
        <p className="text-sm text-white/75">Le brief reprend ton sujet, le format et tes plans. Tu peux le copier dans ChatGPT ou le donner à Codex dans ton dossier MotionLab.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={!canExport || busy} onClick={() => void exportBrief('chatgpt')}>Copier le brief ChatGPT</Button>
          <Button variant="secondary" size="sm" data-testid="export-motionlab-brief" disabled={!canExport || busy} onClick={() => void exportBrief('motionlab')}>Télécharger le brief MotionLab</Button>
        </div>
        {showLauncher && (
          <div className="space-y-1 text-sm text-white/75">
            <a href="/motion/lancer-motionlab.mjs" download="lancer-motionlab.mjs" data-testid="download-motionlab-launcher" className="text-violet-200 underline">Télécharger le lanceur local pour Codex</a>
            <p>Avec Node.js et Codex installés, lance cette commande dans ton dossier de téléchargements en indiquant le chemin de ton kit.</p>
            <code className="block break-all">{'node lancer-motionlab.mjs "/chemin/vers/MotionLab" sutra-brief-motionlab.txt'}</code>
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor={field} className="block text-sm font-medium text-white">Plans reçus de ChatGPT ou Codex (JSON)</label>
          <textarea id={field} value={response} onChange={event => setResponse(event.target.value)} rows={3}
            className="block w-full rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white"
            placeholder='{"scenes":[…]}' spellCheck={false} />
          {hasScenes && response.trim() && (
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" checked={replace} onChange={event => setReplace(event.target.checked)} />
              Remplacer les plans affichés par les plans importés
            </label>
          )}
          <Button variant="secondary" size="sm" onClick={importScenes} disabled={busy || !response.trim() || (hasScenes && !replace)}>Importer les plans</Button>
        </div>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {notice && <p role="status" className="text-sm text-violet-200">{notice}</p>}
      </div>
    </details>
  )
}
