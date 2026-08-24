import type { DetailedGuide } from '@/data/help-guides-data'

interface GuideSectionProps {
  guide: DetailedGuide
}

export default function GuideSection({ guide }: GuideSectionProps) {
  const Icon = guide.icon

  return (
    <div id={guide.id} className="space-y-4 scroll-mt-24">
      <div className="flex items-center gap-3">
        <div
          className={`h-10 w-10 rounded-xl ${guide.bgColor} border ${guide.borderColor} flex items-center justify-center`}
        >
          <Icon className={`h-5 w-5 ${guide.iconColor}`} />
        </div>
        <h3 className="text-lg font-bold text-white">{guide.title}</h3>
      </div>
      <div className="space-y-3 text-sm text-white/60 leading-relaxed">
        {guide.steps.map((step, i) => (
          <p key={i}>
            <strong className="text-white/80">{step.title}</strong> {step.content}
          </p>
        ))}
      </div>
    </div>
  )
}
