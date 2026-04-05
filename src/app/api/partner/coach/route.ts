import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { askClaude } from '@/lib/claude'

export const dynamic = 'force-dynamic'

const coachSchema = z.object({
  message: z.string().min(1, 'Message requis').max(2000),
})

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = coachSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { message } = parsed.data
    const service = createServiceClient()

    // Verify partner
    const { data: partner } = await service
      .from('partners')
      .select('id, code, channel, tier, current_balance, total_earned, total_referrals, created_at')
      .eq('user_id', user.id)
      .single()

    if (!partner) {
      return NextResponse.json({ error: 'Tu n\'es pas partenaire' }, { status: 403 })
    }

    // Rate limit: 20 messages/day
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count: todayMessages } = await service
      .from('partner_coach_messages')
      .select('*', { count: 'exact', head: true })
      .eq('partner_id', partner.id)
      .eq('role', 'user')
      .gte('created_at', todayStart.toISOString())

    if ((todayMessages ?? 0) >= 20) {
      return NextResponse.json(
        { error: 'Limite de 20 messages par jour atteinte. Reviens demain !' },
        { status: 429 }
      )
    }

    // Get recent conversation history (last 10 messages)
    const { data: recentMessages } = await service
      .from('partner_coach_messages')
      .select('role, content')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })
      .limit(10)

    const conversationHistory = (recentMessages ?? [])
      .reverse()
      .map((m) => `${m.role === 'user' ? 'Partenaire' : 'Coach'}: ${m.content}`)
      .join('\n')

    // Get referral stats for context
    const { count: totalReferrals } = await service
      .from('partner_referrals')
      .select('*', { count: 'exact', head: true })
      .eq('partner_id', partner.id)

    const { data: recentReferrals } = await service
      .from('partner_referrals')
      .select('created_at, status')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })
      .limit(5)

    // Get commission stats
    const { data: commissions } = await service
      .from('partner_commissions')
      .select('amount, status, created_at')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })
      .limit(10)

    const totalPaid = (commissions ?? [])
      .filter((c) => c.status === 'paid')
      .reduce((sum, c) => sum + (c.amount ?? 0), 0)

    // Build context for Claude
    const partnerContext = `CONTEXTE PARTENAIRE SUTRA:
- Code partenaire: ${partner.code}
- Canal: ${partner.channel}
- Palier: ${partner.tier}
- Solde actuel: ${partner.current_balance ?? 0} EUR
- Total gagne: ${partner.total_earned ?? totalPaid} EUR
- Total filleuls: ${totalReferrals ?? 0}
- Inscrit depuis: ${new Date(partner.created_at).toLocaleDateString('fr-FR')}
- Derniers filleuls: ${(recentReferrals ?? []).map((r) => `${new Date(r.created_at).toLocaleDateString('fr-FR')} (${r.status})`).join(', ') || 'Aucun'}
- Dernieres commissions: ${(commissions ?? []).slice(0, 5).map((c) => `${c.amount}EUR (${c.status})`).join(', ') || 'Aucune'}

PALIERS DE COMMISSIONS:
10 filleuls = 50EUR | 25 = 150EUR | 50 = 400EUR | 100 = 1000EUR | 250 = 3000EUR | 500 = 6500EUR

HISTORIQUE CONVERSATION:
${conversationHistory || 'Premiere conversation'}`

    const systemPrompt = `Tu es le Coach IA Partenaire de SUTRA, la plateforme de creation video IA de Purama. Tu es un expert en marketing digital, croissance et partenariats.

TON ROLE:
- Analyser les performances du partenaire et donner des conseils CONCRETS et ACTIONNABLES
- Suggerer des strategies pour augmenter les filleuls (reseaux sociaux, contenu, communaute)
- Feliciter les progres et motiver
- Informer sur les paliers proches et les recompenses
- Comparer anonymement aux meilleurs partenaires pour inspirer
- Etre enthousiaste, empathique, et toujours encourageant

REGLES:
- Tutoiement obligatoire
- Utilise des emojis avec parcimonie
- Reponses concises (max 300 mots)
- Toujours proposer une action concrete a faire MAINTENANT
- Ne jamais inventer de donnees, utilise UNIQUEMENT le contexte fourni
- Reponds en francais

${partnerContext}`

    // Save user message
    await service.from('partner_coach_messages').insert({
      partner_id: partner.id,
      role: 'user',
      content: message,
    })

    // Call Claude
    const aiResponse = await askClaude(message, systemPrompt)

    // Save AI response
    await service.from('partner_coach_messages').insert({
      partner_id: partner.id,
      role: 'assistant',
      content: aiResponse,
    })

    return NextResponse.json({
      response: aiResponse,
      messages_remaining: 20 - ((todayMessages ?? 0) + 1),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur coach IA', details: message }, { status: 500 })
  }
}
