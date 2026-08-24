import { Skeleton } from '@/components/ui/Skeleton'

export default function LibrarySkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton width={240} height={32} rounded="lg" />
          <Skeleton width={120} height={16} rounded="md" className="mt-1" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton width={140} height={40} rounded="xl" />
          <Skeleton width={160} height={40} rounded="xl" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Skeleton width={240} height={40} rounded="xl" />
        <Skeleton width={340} height={40} rounded="xl" />
        <Skeleton width={100} height={40} rounded="xl" />
        <Skeleton width={80} height={40} rounded="xl" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
          >
            <Skeleton height={180} rounded="sm" />
            <div className="p-4 space-y-2">
              <Skeleton width="75%" height={16} rounded="md" />
              <Skeleton width="45%" height={12} rounded="md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
