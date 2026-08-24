'use client'

interface SectionCardProps {
  title: string
  children: React.ReactNode
}

export default function SectionCard({ title, children }: SectionCardProps) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5 space-y-4">
      <h3 className="text-sm font-semibold text-white/70">{title}</h3>
      {children}
    </div>
  )
}
