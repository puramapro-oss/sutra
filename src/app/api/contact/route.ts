import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { contactSchema } from '@/lib/validators'
import { enforceRateLimit } from '@/lib/rate-limit'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: Request) {
  // Public identities and forwarded headers can be forged. Bound provider calls
  // across this process using the existing limiter; distributed limits need infra.
  const limited = enforceRateLimit('contact:send', 20, 60_000)
  if (limited) return limited
  try {
    const body = await req.json()
    const parsed = contactSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { subject, message, email } = parsed.data

    const { error } = await resend.emails.send({
      from: 'SUTRA Contact <noreply@purama.dev>',
      to: 'matiss.frasne@gmail.com',
      replyTo: email,
      subject: `[SUTRA Contact] ${subject}`,
      text: `Nouveau message de contact SUTRA\nDe : ${email}\nSujet : ${subject}\n\n${message}`,
    })
    if (error) return NextResponse.json({ error: 'Erreur envoi message' }, { status: 502 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erreur envoi message' }, { status: 500 })
  }
}
