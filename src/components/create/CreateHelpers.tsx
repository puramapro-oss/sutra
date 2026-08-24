'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

export function OptionSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-sm font-medium text-white/70 mb-3">{title}</p>
      {children}
    </div>
  )
}

export function OptionCard({
  selected,
  onClick,
  disabled,
  children,
  'data-testid': testId,
}: {
  selected: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  'data-testid'?: string
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all duration-200 text-center',
        selected
          ? 'bg-violet-600/15 border-violet-500/40 text-white shadow-sm shadow-violet-500/10'
          : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:border-white/[0.12] hover:text-white/70',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  )
}

export function UploadZone({
  icon: Icon,
  label,
  accept,
  testId,
  multiple,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  accept: string
  testId: string
  multiple?: boolean
}) {
  const [fileName, setFileName] = useState<string | null>(null)

  return (
    <label
      data-testid={testId}
      className={cn(
        'flex items-center gap-4 p-4 rounded-xl border border-dashed cursor-pointer transition-all duration-200',
        fileName
          ? 'bg-violet-500/5 border-violet-500/30'
          : 'bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15]'
      )}
    >
      <div className="h-10 w-10 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-white/40" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/70">{label}</p>
        <p className="text-xs text-white/30 truncate">
          {fileName ?? 'Clique pour uploader ou glisse un fichier'}
        </p>
      </div>
      <Upload className="h-4 w-4 text-white/20 shrink-0" />
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = e.target.files
          if (files && files.length > 0) {
            setFileName(
              files.length === 1
                ? files[0].name
                : `${files.length} fichiers`
            )
          }
        }}
      />
    </label>
  )
}

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/40">{label}</span>
      <span className="text-white/80 font-medium">{value}</span>
    </div>
  )
}

export function CreateSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <Skeleton width="240px" height={32} rounded="lg" className="mx-auto" />
        <Skeleton width="320px" height={16} rounded="md" className="mx-auto" />
      </div>
      <div className="flex justify-center">
        <Skeleton width={280} height={48} rounded="xl" />
      </div>
      <Skeleton width="100%" height={120} rounded="xl" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={80} rounded="xl" />
        ))}
      </div>
      <Skeleton width="100%" height={48} rounded="xl" />
    </div>
  )
}
