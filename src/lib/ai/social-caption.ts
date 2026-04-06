import { askClaude } from '@/lib/claude'
import type { SocialPlatform } from '@/lib/zernio'

const IS_DEV = process.env.NODE_ENV !== 'production'

export type CaptionStyle = 'engaging' | 'professional' | 'casual' | 'educational' | 'humorous'

export interface CaptionGenerationRequest {
  videoTitle: string
  videoDescription: string
  platform: SocialPlatform
  style?: CaptionStyle
  language?: string
  maxHashtags?: number
  includeCta?: boolean
  tone?: string
}

export interface GeneratedCaption {
  caption: string
  hashtags: string[]
  platform: SocialPlatform
}

export const PLATFORM_CHAR_LIMITS: Record<SocialPlatform, number> = {
  tiktok: 2200,
  youtube: 5000,
  instagram: 2200,
  facebook: 63206,
  x: 280,
  linkedin: 3000,
  pinterest: 500,
  reddit: 40000,
  threads: 500,
  snapchat: 250,
  tumblr: 4096,
  mastodon: 500,
  bluesky: 300,
  vimeo: 5000,
}

export const PLATFORM_HASHTAG_LIMITS: Record<SocialPlatform, { min: number; max: number }> = {
  tiktok: { min: 3, max: 10 },
  youtube: { min: 3, max: 15 },
  instagram: { min: 5, max: 30 },
  facebook: { min: 1, max: 5 },
  x: { min: 1, max: 3 },
  linkedin: { min: 3, max: 8 },
  pinterest: { min: 2, max: 10 },
  reddit: { min: 0, max: 2 },
  threads: { min: 0, max: 3 },
  snapchat: { min: 0, max: 3 },
  tumblr: { min: 5, max: 20 },
  mastodon: { min: 1, max: 5 },
  bluesky: { min: 0, max: 3 },
  vimeo: { min: 3, max: 10 },
}

const STYLE_DESCRIPTIONS: Record<CaptionStyle, string> = {
  engaging: 'accrocheur, emotionnel, question ouverte qui pousse a commenter',
  professional: 'professionnel, expert, vocabulaire soigne et argumente',
  casual: 'detendu, amical, comme une conversation entre potes',
  educational: 'pedagogique, clair, structure en points cles',
  humorous: 'drole, leger, jeux de mots et punchlines',
}

const LANGUAGE_LABELS: Record<string, string> = {
  fr: 'francais',
  en: 'english',
  es: 'espanol',
  de: 'deutsch',
  it: 'italiano',
  pt: 'portugues',
}

function sanitizeHashtag(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^#+/, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
  return cleaned ? `#${cleaned}` : ''
}

function extractJsonBlock(text: string): string {
  const cleaned = text.replace(/```json\s*|\s*```/g, '').trim()
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1)
  }
  return cleaned
}

function fallbackCaption(req: CaptionGenerationRequest): GeneratedCaption {
  const limit = PLATFORM_CHAR_LIMITS[req.platform]
  const base = `${req.videoTitle}\n\n${req.videoDescription}`.slice(0, Math.max(50, limit - 50))
  return {
    caption: base,
    hashtags: [],
    platform: req.platform,
  }
}

export async function generateSocialCaption(
  req: CaptionGenerationRequest
): Promise<GeneratedCaption> {
  const platform = req.platform
  const charLimit = PLATFORM_CHAR_LIMITS[platform]
  const hashtagRange = PLATFORM_HASHTAG_LIMITS[platform]
  const style: CaptionStyle = req.style ?? 'engaging'
  const language = req.language ?? 'fr'
  const languageLabel = LANGUAGE_LABELS[language] ?? language
  const maxHashtags = Math.min(
    req.maxHashtags ?? hashtagRange.max,
    hashtagRange.max
  )
  const minHashtags = Math.min(hashtagRange.min, maxHashtags)
  const includeCta = req.includeCta ?? true
  const toneExtra = req.tone ? ` Ton additionnel: ${req.tone}.` : ''

  const systemPrompt = `Tu es un expert en viralite sur ${platform}. Ton objectif: maximiser vues, likes, partages, commentaires et sauvegardes.

REGLES ABSOLUES:
- Ecris en ${languageLabel}
- Style: ${STYLE_DESCRIPTIONS[style]}.${toneExtra}
- Respecte STRICTEMENT la limite de caracteres: ${charLimit} pour ${platform}
- Le hook (1ere phrase) doit etre IRRESISTIBLE
- ${includeCta ? "Termine par un call-to-action puissant (commente, partage, abonne-toi...)" : 'Pas de call-to-action explicite'}
- Hashtags viraux et pertinents pour ${platform}: entre ${minHashtags} et ${maxHashtags}
- Hashtags en minuscules, sans accents, sans espaces, sans caracteres speciaux
- Pas d'emojis excessifs (2-5 max bien places)
- Reponds UNIQUEMENT avec du JSON valide, rien avant, rien apres

FORMAT DE REPONSE (JSON strict):
{
  "caption": "Le texte complet de la legende, sans les hashtags",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}`

  const userPrompt = `Genere une legende virale pour ${platform} basee sur cette video:

Titre: ${req.videoTitle}
Description: ${req.videoDescription}

Rappels:
- Limite: ${charLimit} caracteres pour la legende
- ${minHashtags}-${maxHashtags} hashtags viraux
- Langue: ${languageLabel}
- Style: ${style}

Reponds UNIQUEMENT avec le JSON.`

  try {
    const raw = await askClaude(userPrompt, systemPrompt)
    const jsonText = extractJsonBlock(raw)
    const parsed = JSON.parse(jsonText) as { caption?: unknown; hashtags?: unknown }

    const caption = typeof parsed.caption === 'string' ? parsed.caption.slice(0, charLimit) : ''
    const rawTags = Array.isArray(parsed.hashtags) ? parsed.hashtags : []
    const hashtags = rawTags
      .map((t) => (typeof t === 'string' ? sanitizeHashtag(t) : ''))
      .filter((t): t is string => t.length > 1)
      .slice(0, maxHashtags)

    if (!caption) {
      return fallbackCaption(req)
    }

    return {
      caption,
      hashtags,
      platform,
    }
  } catch (err) {
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.error('[social-caption:generate]', err instanceof Error ? err.message : err)
    }
    return fallbackCaption(req)
  }
}

export async function generateMultiPlatformCaptions(
  videoTitle: string,
  videoDescription: string,
  platforms: SocialPlatform[],
  options: {
    style?: CaptionStyle
    language?: string
    maxHashtags?: number
    includeCta?: boolean
  } = {}
): Promise<Record<SocialPlatform, GeneratedCaption>> {
  const results = await Promise.all(
    platforms.map((platform) =>
      generateSocialCaption({
        videoTitle,
        videoDescription,
        platform,
        style: options.style,
        language: options.language,
        maxHashtags: options.maxHashtags,
        includeCta: options.includeCta,
      })
    )
  )

  const map = {} as Record<SocialPlatform, GeneratedCaption>
  platforms.forEach((platform, i) => {
    map[platform] = results[i]
  })
  return map
}
