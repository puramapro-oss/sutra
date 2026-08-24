import { motion } from 'framer-motion'
import { Star, ThumbsUp, Eye, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn, formatRelativeDate } from '@/lib/utils'
import GoldCard from '@/components/admin/GoldCard'
import { Submission } from '@/hooks/useAdminContest'

interface AdminContestSubmissionsProps {
  submissions: Submission[]
  loading: boolean
  judgingId: string | null
  onJudge: (submissionId: string) => void
}

export function AdminContestSubmissions({
  submissions,
  loading,
  judgingId,
  onJudge,
}: AdminContestSubmissionsProps) {
  return (
    <GoldCard className="p-5" data-testid="admin-contest-submissions">
      <div className="flex items-center gap-2 mb-4">
        <Star className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
          Soumissions
        </h3>
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={72} width="100%" rounded="lg" />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Star className="h-10 w-10 text-white/10 mb-3" />
          <p className="text-sm text-white/30">Aucune soumission</p>
          <p className="text-xs text-white/15 mt-1">Les soumissions apparaitront ici quand les utilisateurs participeront</p>
        </div>
      ) : (
        <div className="space-y-2">
          {submissions.map((sub, idx) => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3"
              data-testid={`admin-submission-${sub.id}`}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400">
                  {(sub.user_name ?? sub.user_email)[0]?.toUpperCase() ?? 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white/90 truncate">
                    {sub.video_title}
                  </p>
                  <p className="text-xs text-white/30 truncate">
                    {sub.user_name ?? sub.user_email} &mdash; {formatRelativeDate(sub.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 ml-4">
                <div className="text-center">
                  <p className="text-xs text-white/30">IA</p>
                  <p className={cn(
                    'text-sm font-bold',
                    sub.ai_score !== null
                      ? sub.ai_score >= 80 ? 'text-emerald-400' : sub.ai_score >= 50 ? 'text-amber-400' : 'text-red-400'
                      : 'text-white/20'
                  )}>
                    {sub.ai_score !== null ? `${sub.ai_score}/100` : '--'}
                  </p>
                </div>

                <div className="text-center">
                  <p className="text-xs text-white/30">Votes</p>
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3 text-blue-400" />
                    <span className="text-sm font-bold text-blue-400">{sub.community_votes}</span>
                  </div>
                </div>

                <Badge
                  variant={sub.status === 'judged' ? 'success' : sub.status === 'pending' ? 'warning' : 'default'}
                  size="sm"
                >
                  {sub.status === 'judged' ? 'Evalue' : sub.status === 'pending' ? 'En attente' : sub.status}
                </Badge>

                {sub.ai_score === null && (
                  <button
                    onClick={() => onJudge(sub.id)}
                    disabled={judgingId === sub.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                    data-testid={`admin-judge-${sub.id}`}
                  >
                    {judgingId === sub.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    Evaluer
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </GoldCard>
  )
}
