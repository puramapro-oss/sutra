import { cn } from '@/lib/utils'

export default function GoldCard({
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
        glow ? 'bg-amber-500/[0.04] border-amber-500/20' : 'bg-white/[0.03] border-white/[0.06]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
