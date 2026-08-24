export type ProductionStep = 'idea' | 'script' | 'video' | 'voice' | 'music' | 'assembly' | 'thumbnail'

export interface StepConfig {
  id: ProductionStep
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

export type TemplateId = 'youtube' | 'tiktok' | 'reel' | 'docu' | 'tuto'

export interface Template {
  id: TemplateId
  label: string
  format: '16:9' | '9:16' | '1:1'
  duration: string
  description: string
}

export type StepStatus = 'pending' | 'generating' | 'done' | 'error'
