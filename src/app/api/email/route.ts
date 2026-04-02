import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'

const resend = new Resend(process.env.RESEND_API_KEY)

const emailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  template: z.enum([
    'welcome',
    'password-reset',
    'invoice',
    'payment-confirmation',
    'referral-welcome',
    'referral-commission',
    'withdrawal-confirmed',
    'contest-winner',
    'lottery-winner',
    'support-reply',
  ]),
  data: z.record(z.string(), z.unknown()).optional(),
})

function getEmailContent(template: string, data: Record<string, unknown> = {}): { subject: string; html: string } {
  const name = (data.name as string) ?? 'Utilisateur'

  switch (template) {
    case 'welcome':
      return {
        subject: 'Bienvenue sur SUTRA',
        html: `<h1>Bienvenue ${name} !</h1><p>Ton compte SUTRA est pret. Commence a creer des videos IA des maintenant.</p>`,
      }
    case 'payment-confirmation':
      return {
        subject: 'Paiement confirme — SUTRA',
        html: `<h1>Merci ${name} !</h1><p>Ton paiement de ${data.amount ?? '0'} EUR a bien ete recu.</p>`,
      }
    default:
      return {
        subject: data.subject as string ?? 'Notification SUTRA',
        html: `<p>${data.message ?? 'Notification de SUTRA.'}</p>`,
      }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = emailSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { to, template, data } = parsed.data
    const content = getEmailContent(template, data ?? {})

    const { error } = await resend.emails.send({
      from: 'SUTRA <noreply@purama.dev>',
      to,
      subject: content.subject,
      html: content.html,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
