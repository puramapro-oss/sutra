'use client'

import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

export function EditorLoadingState() {
  return (
    <div className="space-y-6" data-testid="editor-loading">
      <div className="flex items-center gap-4">
        <Skeleton width={40} height={40} rounded="lg" />
        <Skeleton width={300} height={28} rounded="lg" />
      </div>
      <Skeleton width="100%" height={400} rounded="xl" />
      <Skeleton width="100%" height={80} rounded="xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Skeleton width="100%" height={300} rounded="xl" />
        </div>
        <Skeleton width="100%" height={300} rounded="xl" />
      </div>
    </div>
  )
}

export function EditorNotFoundState() {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <EmptyState
        icon={AlertCircle}
        title="Video introuvable"
        description="Cette video n&apos;existe pas ou a ete supprimee."
        action={{
          label: 'Retour au dashboard',
          onClick: () => router.push('/dashboard'),
        }}
      />
    </div>
  )
}
