'use client'

import { Calendar, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import type { ScheduledPost } from '@/types'

interface ScheduledPostsTableProps {
  posts: ScheduledPost[]
}

export default function ScheduledPostsTable({ posts }: ScheduledPostsTableProps) {
  if (posts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Calendar className="h-8 w-8 text-white/15 mx-auto mb-2" />
          <p className="text-sm text-white/30">Aucune publication programmee</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="scheduled-table">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Video</th>
              <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Plateforme</th>
              <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Date</th>
              <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-white/[0.04] last:border-0">
                <td className="px-4 py-3 text-sm text-white/70">{post.video_id.slice(0, 8)}...</td>
                <td className="px-4 py-3">
                  <Badge variant="info" size="sm">{post.platform}</Badge>
                </td>
                <td className="px-4 py-3 text-sm text-white/50">
                  {formatDate(post.scheduled_at)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="warning" size="sm">
                    <Clock className="h-3 w-3 mr-1" />
                    Programmee
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
