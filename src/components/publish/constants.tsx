import {
  PlayCircle,
  Camera,
  Users,
  Briefcase,
} from 'lucide-react'

export const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.88-2.88A2.89 2.89 0 019.49 12.4v-3.5a6.37 6.37 0 00-6.38 6.38 6.37 6.37 0 006.38 6.38 6.37 6.37 0 006.38-6.38V9.42a8.16 8.16 0 004.72 1.49V7.46a4.85 4.85 0 01-1-.77z" />
  </svg>
)

export const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

export const PLATFORMS = [
  { id: 'youtube' as const, label: 'YouTube', icon: PlayCircle, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  { id: 'tiktok' as const, label: 'TikTok', icon: TikTokIcon, color: 'text-white bg-white/10 border-white/20' },
  { id: 'instagram' as const, label: 'Instagram', icon: Camera, color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  { id: 'facebook' as const, label: 'Facebook', icon: Users, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { id: 'x' as const, label: 'X', icon: XIcon, color: 'text-white bg-white/10 border-white/20' },
  { id: 'linkedin' as const, label: 'LinkedIn', icon: Briefcase, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
] as const

export type PlatformId = (typeof PLATFORMS)[number]['id']
