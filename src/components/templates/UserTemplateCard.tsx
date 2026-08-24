import { motion } from 'framer-motion'
import { Layout, Play, Trash2, Square } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { FORMAT_ICONS } from '@/lib/template-helpers'
import type { UserTemplate } from '@/types'

interface UserTemplateCardProps {
  template: UserTemplate
  index: number
  onApply: (template: UserTemplate) => void
  onDelete: (id: string) => void
}

export function UserTemplateCard({ template, index, onApply, onDelete }: UserTemplateCardProps) {
  const FormatIcon = FORMAT_ICONS[template.format] ?? Square

  return (
    <motion.div
      key={template.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card hover data-testid={`user-template-${template.id}`}>
        <div className="h-1 w-full bg-gradient-to-r from-emerald-500/30 to-teal-500/30 rounded-t-2xl" />
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start justify-between mb-2">
            <Layout className="h-5 w-5 text-emerald-400/50" />
            <Badge variant="default" size="sm" className="gap-1">
              <FormatIcon className="h-2.5 w-2.5" />
              {template.format}
            </Badge>
          </div>
          <h3 className="text-sm font-medium text-white mb-1 line-clamp-1">
            {template.name}
          </h3>
          {template.description && (
            <p className="text-[11px] text-white/30 line-clamp-2 mb-3">
              {template.description}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onApply(template)}
              data-testid={`use-user-template-${template.id}`}
              className="flex-1 justify-center"
            >
              <Play className="h-3.5 w-3.5" />
              Utiliser
            </Button>
            <button
              onClick={() => onDelete(template.id)}
              data-testid={`delete-user-template-${template.id}`}
              className="p-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
