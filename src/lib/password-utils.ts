export function getPasswordStrength(password: string): {
  score: number
  label: string
  color: string
} {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score, label: 'Faible', color: 'bg-red-500' }
  if (score <= 2) return { score, label: 'Moyen', color: 'bg-orange-500' }
  if (score <= 3) return { score, label: 'Bon', color: 'bg-yellow-500' }
  return { score, label: 'Excellent', color: 'bg-emerald-500' }
}
