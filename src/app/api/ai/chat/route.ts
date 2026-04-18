import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { buildMuseSystem, NAMA_MUSE_SYSTEM_PROMPT } from '@/lib/nama-muse'

const PLAN_LIMITS: Record<string, { maxTokens: number; model: string }> = {
  free: { maxTokens: 2048, model: process.env.ANTHROPIC_MODEL_FAST ?? 'claude-haiku-4-5-20251001' },
  starter: { maxTokens: 4096, model: process.env.ANTHROPIC_MODEL_MAIN ?? 'claude-sonnet-4-6' },
  pro: { maxTokens: 8192, model: process.env.ANTHROPIC_MODEL_MAIN ?? 'claude-sonnet-4-6' },
  enterprise: { maxTokens: 16384, model: process.env.ANTHROPIC_MODEL_MAIN ?? 'claude-sonnet-4-6' },
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createServiceClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, daily_questions, full_name, streak')
      .eq('id', user.id)
      .single()

    const plan = profile?.plan ?? 'free'
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free

    const body = await request.json()
    const { messages, system } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages requis' }, { status: 400 })
    }

    // Récupère les 3 derniers projets/conversations de l'utilisateur pour mémoire NAMA-Muse
    const { data: recentConvs } = await supabase
      .from('conversations')
      .select('title')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(3)

    const recentProjects = (recentConvs ?? [])
      .map(c => (c as { title?: string | null }).title)
      .filter((t): t is string => typeof t === 'string' && t.length > 0)

    // Si l'appelant fournit un system custom, on le respecte (back-compat agents spécialisés).
    // Sinon on utilise NAMA-Muse enrichie avec le contexte utilisateur.
    const systemPrompt = system ?? buildMuseSystem({
      userName: profile?.full_name ?? null,
      recentProjects,
      streak: typeof profile?.streak === 'number' ? profile.streak : undefined,
    })

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: limits.model,
      max_tokens: limits.maxTokens,
      system: systemPrompt,
      messages,
    })

    const content = response.content[0]
    const text = content.type === 'text' ? content.text : ''

    return NextResponse.json({
      message: text,
      tokens: response.usage.output_tokens,
      model: limits.model,
      persona: system ? 'custom' : 'nama-muse',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export { NAMA_MUSE_SYSTEM_PROMPT }
