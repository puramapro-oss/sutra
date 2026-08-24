import { Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

export function GoldCard({
  children,
  className,
  glow = false,
  ...props
}: {
  children: React.ReactNode
  className?: string
  glow?: boolean
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl backdrop-blur-xl border',
        glow
          ? 'bg-amber-500/[0.04] border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.08)]'
          : 'bg-white/[0.03] border-white/[0.06]',
        className
      )}
      {...props}
    >
      {glow && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(245,158,11,0.06),_transparent_70%)] pointer-events-none" />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export function StationHeader({ title, icon: Icon }: { title: string; icon: typeof Users }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-4 w-4 text-amber-400" />
      <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">{title}</h2>
    </div>
  )
}

export function StatSkeleton() {
  return (
    <div className="space-y-3 p-5">
      <Skeleton height={14} width="40%" rounded="md" />
      <Skeleton height={32} width="60%" rounded="md" />
      <Skeleton height={12} width="30%" rounded="md" />
    </div>
  )
}
