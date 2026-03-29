import { cn } from '@/lib/utils'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number
  height?: string | number
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

export function Skeleton({
  width,
  height,
  rounded = 'lg',
  className,
  style,
  ...props
}: SkeletonProps) {
  const roundedMap = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
  } as const

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-white/[0.04]',
        roundedMap[rounded],
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
      {...props}
    >
      <div
        className="absolute inset-0 animate-[shimmer_1.5s_ease-in-out_infinite]"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.06) 40%, rgba(139,92,246,0.10) 50%, rgba(139,92,246,0.06) 60%, transparent 100%)',
          backgroundSize: '200% 100%',
        }}
      />
    </div>
  )
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 ? '60%' : '100%'}
          rounded="md"
        />
      ))}
    </div>
  )
}

export default Skeleton
