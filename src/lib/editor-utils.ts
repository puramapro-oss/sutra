export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function canUseQuality(
  currentPlan: string,
  minPlan: string
): boolean {
  const order = ['free', 'starter', 'creator', 'empire', 'admin']
  return order.indexOf(currentPlan) >= order.indexOf(minPlan)
}
