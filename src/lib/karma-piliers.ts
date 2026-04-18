// 7 Piliers créatifs SUTRA (adaptation KARMA "piliers de liberté" au domaine vidéo)
export const PILIERS = [
  { key: 'mental',      label: 'Mental',      emoji: '🧠', description: 'Clarté d\'intention, focus, gestion du doute créatif.' },
  { key: 'corps',       label: 'Corps',       emoji: '🫁', description: 'Respiration, pauses, rituel physique avant création.' },
  { key: 'social',      label: 'Social',      emoji: '🤝', description: 'Collaborations, feedback donné, interactions communauté.' },
  { key: 'impact',      label: 'Impact',      emoji: '🌍', description: 'Vues, partages, résonance hors plateforme.' },
  { key: 'vision',      label: 'Vision',      emoji: '👁️', description: 'Ambition créative, prise de risque, signature visuelle.' },
  { key: 'consistance', label: 'Consistance', emoji: '🔥', description: 'Streak, régularité, assiduité sur la durée.' },
  { key: 'innovation',  label: 'Innovation',  emoji: '✨', description: 'Nouveaux templates, nouvelles voix, expérimentations.' },
] as const

export type PilierKey = typeof PILIERS[number]['key']

export const PILIER_ORDER: PilierKey[] = PILIERS.map(p => p.key)
