import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const CRON_SECRET = process.env.CRON_SECRET

// 10 email sequences: J0→J30 + events
const SEQUENCES = [
  { type: 'welcome', dayOffset: 0, subject: 'Bienvenue sur SUTRA ! Ta premiere video t\'attend' },
  { type: 'tip_day1', dayOffset: 1, subject: '3 astuces pour des videos qui cartonnent' },
  { type: 'reminder_day3', dayOffset: 3, subject: 'Tu n\'as pas encore cree de video ?' },
  { type: 'tips_day7', dayOffset: 7, subject: 'Les createurs SUTRA partagent leurs secrets' },
  { type: 'upgrade_day14', dayOffset: 14, subject: '-20% sur ton abo — code EMAIL20 (48h)' },
  { type: 'testimonial_day21', dayOffset: 21, subject: 'Comment ils ont multiplie leur audience par 5' },
  { type: 'winback_day30', dayOffset: 30, subject: 'Tu nous manques — cadeau special pour toi' },
] as const

export async function GET(request: Request) {
  if (CRON_SECRET && request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  try {
    const now = new Date()
    let emailsSent = 0

    // Process each sequence type
    for (const seq of SEQUENCES) {
      const targetDate = new Date(now)
      targetDate.setDate(targetDate.getDate() - seq.dayOffset)
      const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
      const dayEnd = new Date(dayStart.getTime() + 86400000)

      // Find users who signed up on this day and haven't received this email
      const { data: eligibleUsers } = await supabase
        .from('profiles')
        .select('id, email, name')
        .gte('created_at', dayStart.toISOString())
        .lt('created_at', dayEnd.toISOString())

      if (!eligibleUsers || eligibleUsers.length === 0) continue

      for (const user of eligibleUsers) {
        // Check if already sent
        const { data: existing } = await supabase
          .from('email_sequences')
          .select('id')
          .eq('user_id', user.id)
          .eq('email_type', seq.type)
          .limit(1)
          .single()

        if (existing) continue

        // Check email preferences
        const profile = user as { id: string; email: string; name: string; email_preferences?: Record<string, boolean> }
        // Send via Resend (if available)
        try {
          const { Resend } = await import('resend')
          const resend = new Resend(process.env.RESEND_API_KEY)

          await resend.emails.send({
            from: 'SUTRA <noreply@purama.dev>',
            to: user.email,
            subject: seq.subject,
            html: generateEmailHTML(seq.type, profile.name || 'Createur'),
          })

          // Record sequence
          await supabase.from('email_sequences').insert({
            user_id: user.id,
            email_type: seq.type,
          })

          emailsSent++
        } catch {
          // Email sending failed — skip silently
        }
      }
    }

    return NextResponse.json({ status: 'ok', emailsSent })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function generateEmailHTML(type: string, name: string): string {
  const templates: Record<string, string> = {
    welcome: `
      <div style="font-family:system-ui;max-width:600px;margin:0 auto;background:#0A0A0F;color:white;padding:40px;border-radius:16px">
        <h1 style="color:#8B5CF6">Bienvenue ${name} !</h1>
        <p>Tu fais maintenant partie de la communaute SUTRA — des createurs video propulses par l'IA.</p>
        <p>Cree ta premiere video en 30 secondes : choisis un theme, l'IA fait le reste.</p>
        <a href="https://sutra.purama.dev/create" style="display:inline-block;background:linear-gradient(to right,#7C3AED,#8B5CF6);color:white;padding:12px 24px;border-radius:12px;text-decoration:none;margin-top:16px">Creer ma premiere video</a>
        <p style="color:#999;margin-top:24px;font-size:12px">+100 points offerts pour ton inscription !</p>
      </div>
    `,
    tip_day1: `
      <div style="font-family:system-ui;max-width:600px;margin:0 auto;background:#0A0A0F;color:white;padding:40px;border-radius:16px">
        <h1 style="color:#8B5CF6">3 astuces pro, ${name}</h1>
        <ol style="line-height:2">
          <li>Utilise le format 9:16 pour TikTok et Reels — 3x plus de vues</li>
          <li>Active le mode Autopilot pour publier automatiquement</li>
          <li>Clone ta voix pour un branding unique</li>
        </ol>
        <a href="https://sutra.purama.dev/guide" style="display:inline-block;background:linear-gradient(to right,#7C3AED,#8B5CF6);color:white;padding:12px 24px;border-radius:12px;text-decoration:none;margin-top:16px">Voir le guide complet</a>
      </div>
    `,
    upgrade_day14: `
      <div style="font-family:system-ui;max-width:600px;margin:0 auto;background:#0A0A0F;color:white;padding:40px;border-radius:16px">
        <h1 style="color:#F59E0B">-20% special pour toi</h1>
        <p>Tu utilises SUTRA depuis 14 jours — passe au niveau superieur avec le code <strong>EMAIL20</strong>.</p>
        <p>Starter : videos illimitees en 1080p + voix IA + autopilot basique.</p>
        <a href="https://sutra.purama.dev/pricing" style="display:inline-block;background:linear-gradient(to right,#F59E0B,#EF4444);color:white;padding:12px 24px;border-radius:12px;text-decoration:none;margin-top:16px">Profiter de -20%</a>
        <p style="color:#999;font-size:12px;margin-top:8px">Valable 48 heures. Code : EMAIL20</p>
      </div>
    `,
  }

  return templates[type] || `
    <div style="font-family:system-ui;max-width:600px;margin:0 auto;background:#0A0A0F;color:white;padding:40px;border-radius:16px">
      <h1 style="color:#8B5CF6">Salut ${name} !</h1>
      <p>Reviens creer des videos incroyables sur SUTRA.</p>
      <a href="https://sutra.purama.dev/dashboard" style="display:inline-block;background:linear-gradient(to right,#7C3AED,#8B5CF6);color:white;padding:12px 24px;border-radius:12px;text-decoration:none;margin-top:16px">Ouvrir SUTRA</a>
    </div>
  `
}

export const runtime = 'nodejs'
export const maxDuration = 60
