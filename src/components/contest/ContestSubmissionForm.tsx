'use client'

import { Star, Video, Send } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Video as VideoType } from '@/types'

interface ContestSubmissionFormProps {
  hasSubmitted: boolean
  videos: VideoType[]
  selectedVideoId: string
  setSelectedVideoId: (id: string) => void
  submissionTitle: string
  setSubmissionTitle: (title: string) => void
  submissionDesc: string
  setSubmissionDesc: (desc: string) => void
  submitting: boolean
  onSubmit: () => void
}

export default function ContestSubmissionForm({
  hasSubmitted,
  videos,
  selectedVideoId,
  setSelectedVideoId,
  submissionTitle,
  setSubmissionTitle,
  submissionDesc,
  setSubmissionDesc,
  submitting,
  onSubmit,
}: ContestSubmissionFormProps) {
  return (
    <Card data-testid="contest-submit">
      <CardContent>
        <h2 className="text-sm font-semibold text-white/60 mb-4">Participer</h2>
        {hasSubmitted ? (
          <div className="py-6 text-center">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
              <Star className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-sm text-white/70">Tu as deja participe a ce concours !</p>
            <p className="text-xs text-white/30 mt-1">Les resultats seront annonces a la fin du concours.</p>
          </div>
        ) : videos.length === 0 ? (
          <EmptyState
            icon={Video}
            title="Aucune video disponible"
            description="Cree et genere une video pour pouvoir participer."
            action={{ label: 'Creer une video', onClick: () => window.location.assign('/create') }}
          />
        ) : (
          <div className="space-y-4">
            {/* Video selector */}
            <div>
              <label className="text-xs font-medium text-white/40 mb-2 block">Selectionne une video</label>
              <select
                value={selectedVideoId}
                onChange={(e) => setSelectedVideoId(e.target.value)}
                data-testid="contest-video-select"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 outline-none appearance-none cursor-pointer focus:border-violet-500/60 transition-colors"
              >
                <option value="" className="bg-[#0c0b14]">Choisis une video...</option>
                {videos.map((v) => (
                  <option key={v.id} value={v.id} className="bg-[#0c0b14]">
                    {v.title ?? 'Sans titre'} ({v.quality})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Titre de la participation"
              value={submissionTitle}
              onChange={(e) => setSubmissionTitle(e.target.value)}
              placeholder="Un titre accrocheur..."
              data-testid="contest-title-input"
            />

            <div>
              <label className="text-xs font-medium text-white/40 mb-2 block">Description (optionnel)</label>
              <textarea
                value={submissionDesc}
                onChange={(e) => setSubmissionDesc(e.target.value)}
                data-testid="contest-desc-input"
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder-white/30 outline-none resize-none focus:border-violet-500/60 transition-colors"
                placeholder="Decris ta video et pourquoi elle devrait gagner..."
              />
            </div>

            <Button
              onClick={onSubmit}
              loading={submitting}
              data-testid="contest-submit-btn"
            >
              <Send className="h-4 w-4" />
              Soumettre ma participation
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
