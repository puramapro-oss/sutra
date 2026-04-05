export interface VisualStyle {
  id: string
  name: string
  description: string
  promptPrefix: string
  color: string
  icon: string
  preview: string
}

export const VISUAL_STYLES: VisualStyle[] = [
  {
    id: 'cinematic',
    name: 'Cinématique',
    description: 'Rendu film hollywoodien, profondeur de champ, éclairage dramatique',
    promptPrefix: 'cinematic, film grain, shallow depth of field, dramatic lighting, 35mm anamorphic',
    color: 'from-amber-500/20 to-orange-500/20',
    icon: '🎬',
    preview: 'cinematic film scene dramatic lighting golden hour',
  },
  {
    id: 'anime',
    name: 'Anime',
    description: 'Style animation japonaise, couleurs vives, traits nets',
    promptPrefix: 'anime style, cel shading, vibrant colors, clean lines, studio ghibli inspired',
    color: 'from-pink-500/20 to-purple-500/20',
    icon: '🎨',
    preview: 'anime style vibrant colorful scene japanese animation',
  },
  {
    id: 'pixel-art',
    name: 'Pixel Art',
    description: 'Rétro 8-bit, pixels visibles, palette limitée',
    promptPrefix: 'pixel art, 8-bit style, limited color palette, retro gaming aesthetic',
    color: 'from-green-500/20 to-emerald-500/20',
    icon: '👾',
    preview: 'pixel art retro 8bit game scene colorful',
  },
  {
    id: 'watercolor',
    name: 'Aquarelle',
    description: "Peinture à l'eau, textures douces, couleurs diffuses",
    promptPrefix: 'watercolor painting style, soft textures, diffused colors, artistic brush strokes',
    color: 'from-blue-500/20 to-cyan-500/20',
    icon: '🖌️',
    preview: 'watercolor painting soft beautiful artistic',
  },
  {
    id: 'neon',
    name: 'Néon',
    description: 'Cyberpunk, lumières néon, nuit urbaine, reflets',
    promptPrefix: 'neon lights, cyberpunk aesthetic, night city, glowing, reflections on wet streets',
    color: 'from-violet-500/20 to-fuchsia-500/20',
    icon: '💜',
    preview: 'neon lights cyberpunk city night glowing purple',
  },
  {
    id: 'vintage',
    name: 'Vintage',
    description: 'Film analogique années 70, grain, couleurs chaudes délavées',
    promptPrefix: 'vintage film, 1970s aesthetic, warm faded colors, film grain, nostalgic',
    color: 'from-yellow-500/20 to-amber-500/20',
    icon: '📷',
    preview: 'vintage 1970s film photography warm faded colors',
  },
  {
    id: 'futuristic',
    name: 'Futuriste',
    description: 'Sci-fi, hologrammes, surfaces métalliques, bleu froid',
    promptPrefix: 'futuristic, sci-fi, holographic displays, metallic surfaces, cold blue lighting',
    color: 'from-cyan-500/20 to-blue-500/20',
    icon: '🚀',
    preview: 'futuristic sci-fi technology holographic blue',
  },
  {
    id: 'still-life',
    name: 'Nature Morte',
    description: 'Composition soignée, éclairage studio, textures détaillées',
    promptPrefix: 'still life photography, studio lighting, detailed textures, composed arrangement, fine art',
    color: 'from-stone-500/20 to-zinc-500/20',
    icon: '🍎',
    preview: 'still life studio photography artistic composition',
  },
  {
    id: 'street-art',
    name: 'Street Art',
    description: 'Graffiti, couleurs explosives, murs urbains, stencil',
    promptPrefix: 'street art, graffiti style, explosive colors, urban walls, stencil art, banksy inspired',
    color: 'from-red-500/20 to-orange-500/20',
    icon: '🎭',
    preview: 'street art graffiti colorful urban wall mural',
  },
  {
    id: 'retro-80s',
    name: 'Rétro 80s',
    description: 'Synthwave, coucher de soleil violet, grille laser, chrome',
    promptPrefix: 'synthwave, 1980s aesthetic, purple sunset, laser grid, chrome, retrowave, outrun',
    color: 'from-fuchsia-500/20 to-violet-500/20',
    icon: '🕹️',
    preview: 'synthwave retrowave 80s neon sunset purple grid',
  },
]

export function applyStyleToPrompt(prompt: string, styleId: string): string {
  const style = VISUAL_STYLES.find((s) => s.id === styleId)
  if (!style) return prompt
  return `${style.promptPrefix}, ${prompt}`
}

export function getStyleById(styleId: string): VisualStyle | undefined {
  return VISUAL_STYLES.find((s) => s.id === styleId)
}
