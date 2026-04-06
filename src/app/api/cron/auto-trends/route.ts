/**
 * CRON quotidien (6h)
 * Detecte les tendances pour chaque user actif (via Tavily) et stocke
 * en memoire des "trends" expirant a +7 jours.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { recordMemory, type AutoTheme } from '@/lib/sutra-auto'

export const maxDuration = 180
const CRON_SECRET = process.env.CRON_SECRET
const TAVILY_API_KEY = process.env.TAVILY_API_KEY

interface TavilyResult {
  title?: string
  content?: string
}

async function searchTrends(niche: string): Promise<string[]> {
  if (!TAVILY_API_KEY) return []
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: `latest viral video trends ${niche} ${new Date().getFullYear()}`,
        search_depth: 'basic',
        max_results: 5,
        include_answer: false,
      }),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { results?: TavilyResult[] }
    return (data.results ?? [])
      .map((r) => `${r.title ?? ''}: ${(r.content ?? '').slice(0, 200)}`)
      .filter(Boolean)
  } catch {
    return []
  }
}

export async function GET(request: Request) {
  if (CRON_SECRET && request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: configs } = await supabase
    .from('sutra_auto_config')
    .select('user_id')
    .eq('is_active', true)

  let total_trends = 0

  for (const c of configs ?? []) {
    const { data: themes } = await supabase
      .from('sutra_auto_themes')
      .select('theme')
      .eq('user_id', c.user_id)
      .eq('is_active', true)
      .limit(5)

    const niches = ((themes ?? []) as Pick<AutoTheme, 'theme'>[]).map((t) => t.theme)
    if (!niches.length) niches.push('content creation')

    for (const niche of niches.slice(0, 3)) {
      const trends = await searchTrends(niche)
      for (const trend of trends.slice(0, 3)) {
        await recordMemory({
          userId: c.user_id,
          type: 'trend',
          content: `[${niche}] ${trend}`,
          importance: 0.7,
          expiresInDays: 7,
        })
        total_trends++
      }
    }
  }

  return NextResponse.json({ status: 'ok', total_trends })
}
