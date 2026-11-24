import type { EmailPreferences } from '@/types'

export const EMAIL_SEQUENCES = [
  { type: 'welcome', dayOffset: 0, preference: 'welcome', subject: 'Bienvenue sur SUTRA', message: 'Retrouve ton espace de création et prépare ta première vidéo.', path: '/create' },
  { type: 'tip_day1', dayOffset: 1, preference: 'tips', subject: 'Préparer une vidéo claire et adaptée à son format', message: 'Choisis ton format, prépare ton texte et vérifie le rendu avant de partager.', path: '/guide' },
  { type: 'reminder_day3', dayOffset: 3, preference: 'inactivity', subject: 'Ton espace de création reste disponible', message: 'Tu peux reprendre une idée ou un brouillon à ton rythme.', path: '/dashboard' },
  { type: 'tips_day7', dayOffset: 7, preference: 'tips', subject: 'Les outils pour préparer ta prochaine vidéo', message: 'Retrouve le guide de création et les outils disponibles dans ton espace.', path: '/guide' },
  { type: 'upgrade_day14', dayOffset: 14, preference: 'tips', subject: 'Retrouver les fonctionnalités de ton abonnement', message: 'Consulte les fonctionnalités, les limites et les tarifs affichés dans ton espace avant de choisir.', path: '/settings/abonnement' },
  { type: 'testimonial_day21', dayOffset: 21, preference: 'tips', subject: 'Préparer ton prochain projet vidéo', message: 'Clarifie ton idée, vérifie tes sources et conserve un brouillon avant la production.', path: '/create' },
  { type: 'winback_day30', dayOffset: 30, preference: 'inactivity', subject: 'Reprendre une création quand tu le souhaites', message: 'Tes projets et les outils disponibles se retrouvent dans ton espace SUTRA.', path: '/dashboard' },
] as const satisfies ReadonlyArray<{ type: string; dayOffset: number; preference: keyof EmailPreferences; subject: string; message: string; path: string }>

export type EmailSequence = (typeof EMAIL_SEQUENCES)[number]

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

export function sequenceEmailHtml(sequence: EmailSequence, name: string): string {
  return `<div style="font-family:system-ui;max-width:600px;margin:auto;padding:32px;color:#1f2937;background:#fff">
    <h1>${escapeHtml(sequence.subject)}</h1>
    <p>Bonjour ${escapeHtml(name.slice(0, 200))},</p><p>${escapeHtml(sequence.message)}</p>
    <p><a href="https://sutra.purama.dev${sequence.path}">Ouvrir mon espace SUTRA</a></p>
    <p><a href="https://sutra.purama.dev/settings/notifications">Modifier mes préférences email</a></p>
  </div>`
}
