import { motion } from 'framer-motion'
import { Play, Calendar, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import type { VideoRecord } from '@/lib/analytics'
import { formatDuration } from '@/lib/analytics'

interface TopVideosProps {
  videos: VideoRecord[]
}

export default function TopVideos({ videos }: TopVideosProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.4 }}
    >
      <h2 className="text-lg font-semibold text-white mb-4">Top videos</h2>
      <Card className="bg-white/[0.02] border-white/[0.06]" data-testid="top-videos">
        <CardContent className="p-0 divide-y divide-white/[0.04]">
          {videos.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-8">Aucune video creee</p>
          ) : (
            videos.map((video, i) => (
              <div
                key={video.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
                data-testid={`top-video-${i}`}
              >
                <div className="w-12 h-8 rounded-md bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Play className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {video.title ?? video.script_data?.title ?? 'Sans titre'}
                  </p>
                  <p className="text-xs text-white/40 flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    {formatDate(video.created_at)}
                    {video.duration != null && (
                      <>
                        <span className="text-white/20 mx-1">|</span>
                        <Clock className="w-3 h-3" />
                        {formatDuration(video.duration)}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {video.format && (
                    <Badge variant="default" size="sm">
                      {video.format}
                    </Badge>
                  )}
                  {video.quality && (
                    <Badge variant="premium" size="sm">
                      {video.quality}
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
