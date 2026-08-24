export type InputMode = 'text' | 'csv'
export type BatchItemStatus = 'pending' | 'generating' | 'done' | 'error'

export interface BatchItem {
  id: string
  topic: string
  format: '16:9' | '9:16' | '1:1'
  quality: '720p' | '1080p' | '4k'
  style: string
  status: BatchItemStatus
  videoId?: string
  error?: string
}

export interface GlobalConfig {
  format: '16:9' | '9:16' | '1:1'
  quality: '720p' | '1080p' | '4k'
  voice: string
  engine: string
}
