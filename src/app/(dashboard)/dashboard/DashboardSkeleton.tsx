import { Skeleton } from '@/components/ui/Skeleton'

export function DashboardSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <Skeleton width="280px" height={32} rounded="lg" />
        <Skeleton width="220px" height={16} rounded="md" className="mt-2" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <Skeleton width={40} height={40} rounded="xl" />
              <Skeleton width={60} height={24} rounded="lg" />
            </div>
            <div className="space-y-1.5">
              <Skeleton width="60%" height={28} rounded="md" />
              <Skeleton width="40%" height={14} rounded="md" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Skeleton width={200} height={48} rounded="xl" />
        <Skeleton width={180} height={48} rounded="xl" />
      </div>

      <div>
        <Skeleton width={160} height={24} rounded="md" className="mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
            >
              <Skeleton height={120} rounded="sm" />
              <div className="p-4 space-y-2">
                <Skeleton width="80%" height={16} rounded="md" />
                <Skeleton width="50%" height={12} rounded="md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
