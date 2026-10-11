export type StockSource = 'pexels' | 'pixabay' | 'unsplash' | 'coverr'
export type StockType = 'video' | 'photo'
export type StockOrientation = 'landscape' | 'portrait' | 'square'
export type StockQuality = '1080p' | '4k'

export interface StockResult {
  id: string
  source: StockSource
  type: StockType
  url: string
  thumbnail: string
  width: number
  height: number
  quality: StockQuality
  duration?: number
  author?: string
  pageUrl?: string
}

export interface StockSearchOptions {
  query: string
  orientation?: StockOrientation
  type?: StockType | 'any'
}

// Internal API types
export interface PexelsVideoFile {
  id: number
  quality: string
  link: string
  width: number
  height: number
}

export interface PexelsVideo {
  id: number
  url: string
  width: number
  height: number
  duration: number
  user: { name: string }
  image: string
  video_files: PexelsVideoFile[]
}

export interface PexelsPhoto {
  id: number
  url: string
  width: number
  height: number
  photographer: string
  src: { original: string; large2x: string; large: string }
}

export interface UnsplashPhoto {
  id: string
  width: number
  height: number
  urls: { full: string; regular: string; raw: string }
  user: { name: string }
  links: { html: string }
}

export interface CoverrVideo {
  id: string
  title: string
  poster: string
  max_width: number
  max_height: number
  urls: { mp4: string; mp4_download: string; mp4_preview: string }
}
