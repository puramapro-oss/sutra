export type Phase = 'idle' | 'inhale' | 'hold' | 'exhale'

export const PHASE_DURATIONS: Record<Exclude<Phase, 'idle'>, number> = {
  inhale: 4,
  hold: 7,
  exhale: 8,
}

export const PHASE_LABELS: Record<Phase, string> = {
  idle: 'Pret ?',
  inhale: 'Inspire...',
  hold: 'Retiens...',
  exhale: 'Expire...',
}

export const PHASE_COLORS: Record<Phase, string> = {
  idle: 'from-violet-500/20 to-cyan-500/20',
  inhale: 'from-cyan-400/30 to-emerald-400/30',
  hold: 'from-violet-400/30 to-purple-400/30',
  exhale: 'from-indigo-400/30 to-blue-400/30',
}

export const SESSION_DURATION = 180 // 3 minutes
export const XP_REWARD = 50
