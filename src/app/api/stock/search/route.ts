import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { searchStock } from '@/lib/stock'

export const maxDuration = 30

const SearchSchema = z.object({
  query: z.string().min(1).max(200),
  orientation: z.enum(['landscape', 'portrait', 'square']).optional().default('landscape'),
  type: z.enum(['video', 'photo', 'any']).optional().default('any'),
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
    const parsed = SearchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parametres invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const results = await searchStock(parsed.data)
    return NextResponse.json({ results, count: results.length })
  } catch (error) {
    console.error('[stock/search]', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recherche stock', results: [] },
      { status: 500 }
    )
  }
}
