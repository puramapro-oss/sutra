'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatRelativeDate } from '@/lib/utils'
import type { ScheduledPost } from '@/types'

interface PastPostsListProps {
  posts: ScheduledPost[]
}

export default function PastPostsList({ posts }: PastPostsListProps) {
  if (posts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-white/15 mx-auto mb-2" />
          <p className="text-sm text-white/30">Aucune publication passee</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {posts.map((post) => (
        <Card key={post.id}>
          <CardContent className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {post.status === 'published' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              )}
              <span className="text-sm text-white/70">{post.video_id.slice(0, 8)}...</span>
              <Badge variant={post.status === 'published' ? 'success' : 'error'} size="sm">
                {post.platform}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/30">{formatRelativeDate(post.created_at)}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
