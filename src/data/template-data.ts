// Re-exports from modular template files for backward compatibility
export type { PresetTemplate } from './templates/types'
export { CATEGORIES } from './templates/categories'
export { PRESET_TEMPLATES } from './templates'

// Named exports for individual template categories
export {
  pubProduitTemplates,
  ugcTemplates,
  storiesReelsTemplates,
  youtubeFacelessTemplates,
  documentaireTemplates,
  tutorielTemplates,
  presentationTemplates,
  clipMusicalTemplates,
  teaserTemplates,
  avantApresTemplates,
} from './templates'
