import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import Stripe from 'stripe'
import { CONTEST_DISTRIBUTION } from '@/lib/constants'

const CRON_SECRET = process.env.CRON_SECRET
const JUDGE_POOL_PCT = 0.03

const CRITERIA = [
  { name: 'Amour', maxPoints: 25, description: 'Emotion, passion, authenticite du message' },
  { name: 'Impact', maxPoints: 25, description: 'Force du message, capacite a toucher et inspirer' },
  { name: 'Creativite', maxPoints: 20, description: 'Originalite du concept, de la mise en scene' },
  { name: 'Qualite', maxPoints: 15, description: 'Qualite technique du script, de la narration' },
  { name: 'Inspiration', maxPoints: 15, description: 'Capacite a motiver et inspirer les autres' },
]

export async function GET(request: Request) {
  if (CRON_SECRET && request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })

  try {
    // 1. Find the monthly contest to judge (status = 'open', type = 'monthly', period_end passed)
    const now = new Date()
    const { data: contest } = await supabase
      .from('contests')
      .select('*')
      .eq('type', 'monthly')
      .eq('status', 'open')
      .lte('period_end', now.toISOString())
      .order('period_end', { ascending: false })
      .limit(1)
      .single()

    if (!contest) {
      return NextResponse.json({ status: 'no_contest_to_judge' })
    }

    // 2. Get all submissions for this contest
    const { data: submissions } = await supabase
      .from('contest_submissions')
      .select('*, videos:video_id(title, description, script_data)')
      .eq('contest_id', contest.id)
      .eq('status', 'submitted')

    if (!submissions || submissions.length === 0) {
      await supabase
        .from('contests')
        .update({ status: 'completed', prize_pool_amount: 0 })
        .eq('id', contest.id)
      return NextResponse.json({ status: 'no_submissions' })
    }

    // 3. Judge each submission with Claude
    const scored: { userId: string; submissionId: string; score: number; evaluation: Record<string, number> }[] = []

    for (const sub of submissions) {
      const videoTitle = sub.title ?? (sub.videos as { title?: string })?.title ?? 'Sans titre'
      const videoDesc = sub.description ?? (sub.videos as { description?: string })?.description ?? ''
      const scriptData = (sub.videos as { script_data?: { narration?: string } })?.script_data

      const prompt = `Tu es juge d'un concours de creation video IA. Evalue cette soumission sur 5 criteres.

Video: "${videoTitle}"
Description: "${videoDesc}"
${scriptData?.narration ? `Script/Narration: "${scriptData.narration.slice(0, 500)}"` : ''}

Criteres d'evaluation:
${CRITERIA.map((c) => `- ${c.name} (/${c.maxPoints} pts): ${c.description}`).join('\n')}

Reponds UNIQUEMENT avec un JSON valide sans markdown:
{"Amour": <score>, "Impact": <score>, "Creativite": <score>, "Qualite": <score>, "Inspiration": <score>}

Sois juste, rigoureux et exigeant. Note sur le potentiel creatif et emotionnel, pas sur la perfection technique.`

      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }],
        })

        const text = response.content[0].type === 'text' ? response.content[0].text : ''
        const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const evaluation = JSON.parse(cleanJson) as Record<string, number>

        const totalScore = Object.values(evaluation).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0)

        scored.push({
          userId: sub.user_id,
          submissionId: sub.id,
          score: totalScore,
          evaluation,
        })

        // Update submission ai_score
        await supabase
          .from('contest_submissions')
          .update({ ai_score: totalScore, status: 'judged', content_data: evaluation })
          .eq('id', sub.id)
      } catch {
        // If Claude fails for one submission, skip it
        scored.push({
          userId: sub.user_id,
          submissionId: sub.id,
          score: 0,
          evaluation: {},
        })
      }
    }

    // 4. Rank by score
    scored.sort((a, b) => b.score - a.score)
    const top10 = scored.slice(0, 10)

    // 5. Calculate prize pool from monthly Stripe revenue
    const monthStart = new Date(contest.period_start)
    let monthlyRevenue = 0
    try {
      const charges = await stripe.charges.list({
        created: { gte: Math.floor(monthStart.getTime() / 1000) },
        limit: 100,
      })
      monthlyRevenue = charges.data
        .filter((c) => c.status === 'succeeded')
        .reduce((sum, c) => sum + c.amount, 0) / 100
    } catch {
      // Stripe unreachable
    }

    const totalPool = monthlyRevenue * JUDGE_POOL_PCT + (contest.carried_over_amount ?? 0)

    // 6. Distribute prizes to top 10
    const rankings = []
    for (let i = 0; i < top10.length; i++) {
      const pct = CONTEST_DISTRIBUTION[i] ?? 0
      const prizeAmount = Math.round(totalPool * (pct / 100) * 100) / 100
      const entry = top10[i]

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', entry.userId)
        .single()

      // Credit wallet
      if (prizeAmount > 0) {
        const { data: wallet } = await supabase
          .from('wallets')
          .select('balance, total_earned')
          .eq('user_id', entry.userId)
          .single()

        if (wallet) {
          await supabase
            .from('wallets')
            .update({
              balance: (wallet.balance ?? 0) + prizeAmount,
              total_earned: (wallet.total_earned ?? 0) + prizeAmount,
            })
            .eq('user_id', entry.userId)
        } else {
          await supabase.from('wallets').insert({
            user_id: entry.userId,
            balance: prizeAmount,
            total_earned: prizeAmount,
          })
        }
      }

      await supabase.from('contest_results').insert({
        contest_id: contest.id,
        user_id: entry.userId,
        rank: i + 1,
        score: entry.score,
        prize_amount: prizeAmount,
        ai_evaluation: entry.evaluation,
      })

      rankings.push({
        user_id: entry.userId,
        name: profile?.name ?? profile?.email ?? 'Anonyme',
        score: entry.score,
        prize: prizeAmount,
        rank: i + 1,
      })
    }

    // 7. Close contest
    await supabase
      .from('contests')
      .update({
        status: 'completed',
        prize_pool_amount: totalPool,
        winner_ids: top10.map((e) => e.userId),
        rankings,
        total_submissions: submissions.length,
      })
      .eq('id', contest.id)

    return NextResponse.json({
      status: 'judged',
      contestId: contest.id,
      submissions: submissions.length,
      totalPool,
      top3: rankings.slice(0, 3).map((r) => ({ name: r.name, score: r.score, prize: r.prize })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 120
