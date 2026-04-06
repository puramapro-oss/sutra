import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { askClaude } from '@/lib/claude'

export const maxDuration = 60

const Schema = z.object({
  scenes: z.array(z.string().min(1)).min(1).max(50),
})

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const json = await req.json().catch(() => ({}))
    const parsed = Schema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 })
    }

    const system = `You are a stock-footage search assistant. For each input scene (in any language), output 3 to 5 ENGLISH search keywords that would find the best matching stock video or photo.

RULES:
1. Reply ONLY with valid JSON, no prose around it.
2. Format: {"keywords": [["kw1","kw2","kw3"], ["kw1","kw2","kw3"]]}
3. One inner array per scene, in the same order.
4. Keywords must be concrete visual nouns or short phrases (e.g. "morning coffee", "city sunrise"), never abstract concepts.
5. Lowercase, no punctuation.`

    const userMsg = `Scenes:\n${parsed.data.scenes.map((s, i) => `${i + 1}. ${s}`).join('\n')}`

    const raw = await askClaude(userMsg, system)
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
    let result: { keywords: string[][] } = { keywords: [] }
    try {
      result = JSON.parse(cleaned) as { keywords: string[][] }
    } catch {
      // Fallback: just take first 3 words of each scene
      result.keywords = parsed.data.scenes.map((s) =>
        s
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 3)
      )
    }

    if (!Array.isArray(result.keywords) || result.keywords.length !== parsed.data.scenes.length) {
      result.keywords = parsed.data.scenes.map(() => [])
    }

    return NextResponse.json({ keywords: result.keywords })
  } catch (error) {
    console.error('[stock/keywords]', error)
    return NextResponse.json({ error: 'Erreur extraction mots-cles', keywords: [] }, { status: 500 })
  }
}
