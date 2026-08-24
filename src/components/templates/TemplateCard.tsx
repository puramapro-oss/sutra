import { motion } from 'framer-motion'
import { Clock, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { FORMAT_ICONS, FORMAT_LABELS } from '@/lib/template-helpers'
import type { PresetTemplate } from '@/data/template-data'
import type { VideoFormat } from '@/types'

interface TemplateCardProps {
  template: PresetTemplate
  index: number
  onApply: (template: PresetTemplate) => void
}

export function TemplateCard({ template, index, onApply }: TemplateCardProps) {
  const FormatIcon = FORMAT_ICONS[template.format as VideoFormat]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.03, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Card hover data-testid={`template-${template.id}`}>
        <div className={cn('h-1 w-full bg-gradient-to-r rounded-t-2xl', template.color)} />

        <CardContent className="pt-4 pb-3">
          <div className="flex items-start justify-between mb-3">
            <span className="text-2xl">{template.icon}</span>
            <Badge variant="default" size="sm" className="gap-1">
              <FormatIcon className="h-2.5 w-2.5" />
              {template.format}
            </Badge>
          </div>

          <h3 className="text-sm font-semibold text-white mb-1 line-clamp-1">
            {template.name}
          </h3>

          <p className="text-[11px] sm:text-xs text-white/35 line-clamp-2 mb-3 min-h-[2.5em]">
            {template.description}
          </p>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-1 text-[10px] text-white/25">
              <Clock className="h-3 w-3" />
              {template.duration}
            </div>
            <div className="text-[10px] text-white/20">{FORMAT_LABELS[template.format as VideoFormat]}</div>
          </div>

          <Button
            size="sm"
            onClick={() => onApply(template)}
            data-testid={`use-template-${template.id}`}
            className="w-full justify-center"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Utiliser
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}
