import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const PLAN_LIMITS: Record<string, { maxTokens: number; model: string }> = {
  free: { maxTokens: 2048, model: 'claude-haiku-4-5-20241022' },
  starter: { maxTokens: 4096, model: 'claude-sonnet-4-20250514' },
  pro: { maxTokens: 8192, model: 'claude-sonnet-4-20250514' },
  enterprise: { maxTokens: 16384, model: 'claude-sonnet-4-20250514' },
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
      .select('plan, daily_questions')
      .eq('id', user.id)
      .single()

    const plan = profile?.plan ?? 'free'
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free

    const body = await request.json()
    const { messages, system } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages requis' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: limits.model,
      max_tokens: limits.maxTokens,
      system: system ?? 'Tu es SUTRA, un assistant creatif specialise dans la generation de videos IA. Reponds en francais avec un ton bienveillant et professionnel.',
      messages,
    })

    const content = response.content[0]
    const text = content.type === 'text' ? content.text : ''

    return NextResponse.json({
      message: text,
      tokens: response.usage.output_tokens,
      model: limits.model,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
