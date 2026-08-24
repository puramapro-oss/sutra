import type { Aide, Profil, Situation } from '@/types/financer'

export function formatMontant(n: number): string {
  return n.toLocaleString('fr-FR', {
    maximumFractionDigits: 0,
  })
}

export function getBadge(
  aide: Aide,
  profil: Profil,
  situation: Situation
): { label: string; color: string } {
  const profilMatch = aide.profil_eligible.includes(profil)
  const situationMatch =
    !situation || aide.situation_eligible.includes(situation)
  if (profilMatch && situationMatch) {
    return {
      label: 'Probable',
      color: 'text-green-400 bg-green-500/10 border-green-500/20',
    }
  }
  if (profilMatch || situationMatch) {
    return {
      label: 'Possible',
      color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    }
  }
  return {
    label: 'A verifier',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  }
}
