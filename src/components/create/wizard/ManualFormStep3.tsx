import { Mic, Music, FileVideo } from 'lucide-react'
import { SceneStockPicker, type StockResult } from '../StockPicker'
import { UploadZone } from '../CreateHelpers'
import type { MediaMode } from '../MediaModeCards'
import type { VideoFormat } from '@/types'

interface SceneStockState { selected: StockResult | null; fallbackToAI: boolean }

interface Props {
  mediaMode: MediaMode
  keywordsLoading: boolean
  sceneSelections: SceneStockState[]
  script: string
  format: VideoFormat
  sceneKeywords: string[][]
  setSceneSelections: React.Dispatch<React.SetStateAction<SceneStockState[]>>
}

export default function ManualFormStep3({ mediaMode, keywordsLoading, sceneSelections, script, format, sceneKeywords, setSceneSelections }: Props) {
  const formatToOrientation = (f: VideoFormat): 'landscape' | 'portrait' | 'square' => f === '16:9' ? 'landscape' : f === '9:16' ? 'portrait' : 'square'
  
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white font-[var(--font-display)]">Etape 4 — Medias</h2>
      <p className="text-sm text-white/40">{mediaMode === 'ai' ? 'Tu peux uploader tes propres fichiers ou laisser l’IA les generer.' : 'Choisis un media reel par scene. Bouton "Generer IA" comme fallback.'}</p>
      {mediaMode === 'ai' ? (
        <>
          <UploadZone icon={Mic} label="Voix off" accept="audio/*" testId="upload-voice" />
          <UploadZone icon={Music} label="Musique de fond" accept="audio/*" testId="upload-music" />
          <UploadZone icon={FileVideo} label="Clips video" accept="video/*" testId="upload-clips" multiple />
        </>
      ) : keywordsLoading ? (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-6 text-center text-white/60 text-sm">Extraction des mots-cles par l&apos;IA...</div>
      ) : sceneSelections.length === 0 ? (
        <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-6 text-center text-sm text-amber-200">Ecris d&apos;abord ton script (etape precedente) pour generer les recherches stock.</div>
      ) : (
        <div className="space-y-3" data-testid="stock-pickers">
          {sceneSelections.map((sel, i) => {
            const sceneText = script.split('\n').map((l) => l.trim()).filter(Boolean)[i] ?? ''
            return (
              <SceneStockPicker
                key={i}
                sceneIndex={i}
                sceneText={sceneText}
                keywords={sceneKeywords[i] ?? []}
                orientation={formatToOrientation(format)}
                selected={sel.selected}
                fallbackToAI={sel.fallbackToAI}
                allowFallback={mediaMode === 'mixed' || mediaMode === 'stock'}
                onSelect={(r) => setSceneSelections((prev) => prev.map((s, j) => j === i ? { selected: r, fallbackToAI: false } : s))}
                onFallbackAI={() => setSceneSelections((prev) => prev.map((s, j) => j === i ? { selected: null, fallbackToAI: !s.fallbackToAI } : s))}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
