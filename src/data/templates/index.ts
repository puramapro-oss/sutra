export * from './types'
export * from './categories'
export { pubProduitTemplates } from './pub-produit'
export { ugcTemplates } from './ugc'
export { storiesReelsTemplates } from './stories-reels'
export { youtubeFacelessTemplates } from './youtube-faceless'
export { documentaireTemplates } from './documentaire'
export { tutorielTemplates } from './tutoriel'
export { presentationTemplates } from './presentation'
export { clipMusicalTemplates } from './clip-musical'
export { teaserTemplates } from './teaser'
export { avantApresTemplates } from './avant-apres'

import type { PresetTemplate } from './types'
import { pubProduitTemplates } from './pub-produit'
import { ugcTemplates } from './ugc'
import { storiesReelsTemplates } from './stories-reels'
import { youtubeFacelessTemplates } from './youtube-faceless'
import { documentaireTemplates } from './documentaire'
import { tutorielTemplates } from './tutoriel'
import { presentationTemplates } from './presentation'
import { clipMusicalTemplates } from './clip-musical'
import { teaserTemplates } from './teaser'
import { avantApresTemplates } from './avant-apres'

export const PRESET_TEMPLATES: PresetTemplate[] = [
  ...pubProduitTemplates,
  ...ugcTemplates,
  ...storiesReelsTemplates,
  ...youtubeFacelessTemplates,
  ...documentaireTemplates,
  ...tutorielTemplates,
  ...presentationTemplates,
  ...clipMusicalTemplates,
  ...teaserTemplates,
  ...avantApresTemplates,
]
