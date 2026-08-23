import { Settings } from 'lucide-react'

export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'number' | 'toggle'
  value: string | number | boolean
  placeholder?: string
  suffix?: string
}

export interface ConfigSection {
  key: string
  label: string
  icon: typeof Settings
  fields: ConfigField[]
}
