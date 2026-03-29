import Anthropic from '@anthropic-ai/sdk'
import type { ScriptData, MusicStyle } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function generateScript(params: {
  topic: string
  niche: string
  style: string
  format: string
  duration: string
}): Promise<ScriptData> {
  const systemPrompt = `Tu es le createur de contenu video IA le plus talentueux au monde. Tu crees des scripts captivants, optimises pour l'engagement.

REGLES ABSOLUES :
1. Le HOOK (3 premieres secondes) doit etre IRRESISTIBLE - question choc, fait surprenant, ou provocation
2. Chaque scene dure 5-10 secondes maximum
3. Le rythme ne doit JAMAIS baisser - relance toutes les 15 secondes
4. Termine toujours par un CTA (call-to-action) puissant
5. Ecris en francais naturel, conversationnel, jamais robotique

FORMAT DE REPONSE (JSON strict, aucun texte autour) :
{
  "title": "Titre accrocheur pour la video",
  "description": "Description SEO de 200 mots avec mots-cles naturels",
  "tags": ["tag1", "tag2", "tag3"],
  "narration": "Le texte complet de la voix-off, ecrit naturellement, avec des pauses marquees par des ...",
  "scenes": [
    {
      "visual_prompt": "Detailed English description for visual generation. Cinematic, 4K quality.",
      "duration_seconds": 5,
      "use_stock": false
    }
  ],
  "music_prompt": "English description of ideal background music",
  "music_style": "cinematic",
  "thumbnail_prompt": "Detailed English description for thumbnail generation",
  "estimated_duration": 75
}

IMPORTANT :
- "visual_prompt" est TOUJOURS en anglais
- "narration" est TOUJOURS en francais
- "use_stock" = true seulement pour les plans generiques
- Vise ${params.duration}
- Format video : ${params.format}
- Niche : ${params.niche}
- Style : ${params.style}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Cree une video sur : "${params.topic}"` }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(cleaned) as ScriptData
}

export async function askClaude(prompt: string, system?: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: system ?? 'Tu es un assistant IA pour SUTRA, une plateforme de generation video IA. Reponds en francais.',
    messages: [{ role: 'user', content: prompt }],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

export async function judgeContestEntry(
  title: string,
  description: string,
  videoUrl: string
): Promise<{ score: number; feedback: string; scores_detail: Record<string, number> }> {
  const response = await askClaude(
    `Evalue cette soumission de concours video :
Titre: ${title}
Description: ${description}
URL: ${videoUrl}

Note sur 100 selon 5 criteres (20pts chacun) :
1. Creativite et originalite
2. Qualite technique (image, son, montage)
3. Impact emotionnel / engagement
4. Pertinence du sujet
5. Execution globale

Reponds en JSON strict :
{"score": 85, "feedback": "...", "scores_detail": {"creativite": 18, "technique": 17, "impact": 16, "pertinence": 17, "execution": 17}}`
  )

  return JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim())
}
