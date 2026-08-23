import { cn } from '@/lib/utils'

export default function GoldCard({
  children,
  className,
  ...props
}: {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl backdrop-blur-xl border bg-white/[0.03] border-white/[0.06]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
