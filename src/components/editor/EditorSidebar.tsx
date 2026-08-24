import { Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import type { Video, Scene } from '@/types'

interface EditorSidebarProps {
  video: Video
  scenes: Scene[]
  duration: number
  exportQuality: string
  exporting: boolean
  onExport: () => void
}

export function EditorSidebar({
  video,
  scenes,
  duration,
  exportQuality,
  exporting,
  onExport,
}: EditorSidebarProps) {
  return (
    <div className="lg:col-span-4 space-y-4">
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold text-white mb-3">Informations</h3>
          <div className="space-y-3">
            {[
              ['Format', video.format ?? '16:9'],
              ['Qualite', video.quality ?? '1080p'],
              ['Duree', duration > 0 ? `${Math.round(duration)}s` : '-'],
              ['Scenes', `${scenes.length}`],
              ['Statut', video.status],
              ['Cree le', formatDate(video.created_at)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-white/40">{label}</span>
                <span className="text-white/70">{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold text-white mb-3">Export rapide</h3>
          <p className="text-xs text-white/40 mb-4">
            Qualite selectionnee : {exportQuality}
          </p>
          <Button
            onClick={onExport}
            loading={exporting}
            data-testid="editor-sidebar-export"
            className="w-full"
          >
            <Download className="h-4 w-4" />
            Exporter la video
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
