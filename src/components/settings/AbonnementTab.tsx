import { ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import Button from '@/components/ui/Button'
import type { Plan, Profile } from '@/types'

interface AbonnementTabProps {
  plan: Plan
  planLabel: string
  limits: {
    videos: number
    quality: string
    voices: number
    autopilot: number
    networks: number
  }
  profile: Profile | null
  openBillingPortal: () => void
}

export default function AbonnementTab({
  plan,
  planLabel,
  limits,
  profile,
  openBillingPortal,
}: AbonnementTabProps) {
  return (
    <Card data-testid="settings-abonnement">
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Plan actuel</h3>
            <Badge variant="premium" className="mt-1">{planLabel}</Badge>
          </div>
          <Button
            variant="secondary"
            onClick={openBillingPortal}
            data-testid="settings-manage-subscription"
          >
            <ExternalLink className="h-4 w-4" />
            Gerer l&apos;abonnement
          </Button>
        </div>

        {/* Usage stats */}
        <div className="space-y-4 pt-4 border-t border-white/[0.06]">
          <h4 className="text-xs font-medium text-white/40">Utilisation ce mois</h4>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-white/50">Videos</span>
                <span className="text-white/70">
                  {profile?.monthly_video_count ?? 0} / {limits.videos === 9999 ? '∞' : limits.videos}
                </span>
              </div>
              <ProgressBar
                value={profile?.monthly_video_count ?? 0}
                max={limits.videos}
                data-testid="usage-videos"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-xl bg-white/[0.02]">
                <p className="text-white/40 text-xs">Qualite max</p>
                <p className="text-white/70 font-medium">{limits.quality}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02]">
                <p className="text-white/40 text-xs">Voix clonees</p>
                <p className="text-white/70 font-medium">{limits.voices === 0 ? 'Non inclus' : limits.voices}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02]">
                <p className="text-white/40 text-xs">Autopilot</p>
                <p className="text-white/70 font-medium">{limits.autopilot === 0 ? 'Non inclus' : `${limits.autopilot} series`}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02]">
                <p className="text-white/40 text-xs">Reseaux</p>
                <p className="text-white/70 font-medium">{limits.networks === 0 ? 'Non inclus' : limits.networks}</p>
              </div>
            </div>
          </div>
        </div>

        {plan !== 'empire' && plan !== 'admin' && (
          <Button
            onClick={() => window.location.assign('/pricing')}
            data-testid="settings-upgrade"
            className="w-full"
          >
            Passer au plan superieur
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
