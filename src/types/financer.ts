export interface Aide {
  id: string
  nom: string
  type_aide: string
  profil_eligible: string[]
  situation_eligible: string[]
  montant_max: number
  taux_remboursement: number
  url_officielle: string
  description: string
  region: string
  handicap_only: boolean
  cumulable: boolean
}

export type Profil = 'particulier' | 'entreprise' | 'association' | 'etudiant' | ''

export type Situation =
  | 'salarie'
  | 'demandeur_emploi'
  | 'independant'
  | 'auto_entrepreneur'
  | 'retraite'
  | 'rsa'
  | 'cej'
  | 'etudiant'
  | ''
