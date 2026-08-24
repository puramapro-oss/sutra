import type { Profil, Situation } from '@/types/financer'

export const PROFILS = [
  { id: 'particulier' as Profil, label: 'Particulier', icon: '👤' },
  { id: 'entreprise' as Profil, label: 'Entreprise', icon: '🏢' },
  { id: 'association' as Profil, label: 'Association', icon: '🤝' },
  { id: 'etudiant' as Profil, label: 'Etudiant', icon: '🎓' },
]

export const SITUATIONS = [
  { id: 'salarie' as Situation, label: 'Salarie' },
  { id: 'demandeur_emploi' as Situation, label: "Demandeur d'emploi" },
  { id: 'independant' as Situation, label: 'Independant' },
  { id: 'auto_entrepreneur' as Situation, label: 'Auto-entrepreneur' },
  { id: 'retraite' as Situation, label: 'Retraite' },
  { id: 'rsa' as Situation, label: 'Beneficiaire RSA' },
  { id: 'cej' as Situation, label: "Contrat d'Engagement Jeune" },
  { id: 'etudiant' as Situation, label: 'Etudiant' },
]

export const REGIONS = [
  'Auvergne-Rhone-Alpes',
  'Bourgogne-Franche-Comte',
  'Bretagne',
  'Centre-Val de Loire',
  'Corse',
  'Grand Est',
  'Hauts-de-France',
  'Ile-de-France',
  'Normandie',
  'Nouvelle-Aquitaine',
  'Occitanie',
  'Pays de la Loire',
  "Provence-Alpes-Cote d'Azur",
]
