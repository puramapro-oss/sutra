import {
  Zap,
  Music,
  Video,
  Image,
  Database,
  CreditCard,
  Mail,
  Server,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ServiceHealth {
  name: string
  key: string
  status: 'operational' | 'degraded' | 'down'
  latency_ms: number
  last_checked: string
  uptime_30d: number
}

export const SERVICE_ICONS: Record<string, typeof Server> = {
  claude: Zap,
  elevenlabs: Music,
  runpod: Video,
  suno: Music,
  shotstack: Video,
  pexels: Image,
  supabase: Database,
  stripe: CreditCard,
  resend: Mail,
}

export const SERVICE_LABELS: Record<string, string> = {
  claude: 'Claude AI',
  elevenlabs: 'ElevenLabs',
  runpod: 'RunPod',
  suno: 'Suno',
  shotstack: 'Shotstack',
  pexels: 'Pexels',
  supabase: 'Supabase',
  stripe: 'Stripe',
  resend: 'Resend',
}

export const STATUS_CONFIG = {
  operational: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    dot: 'bg-emerald-500',
    label: 'Operationnel',
  },
  degraded: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    dot: 'bg-amber-500',
    label: 'Degrade',
  },
  down: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    dot: 'bg-red-500',
    label: 'Hors service',
  },
}

export function GoldCard({
  children,
  className,
  ...props
}: {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl backdrop-blur-xl border bg-white/[0.03] border-white/[0.06]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
