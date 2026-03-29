import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { contactSchema } from '@/lib/validators'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: Request) {
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

    await resend.emails.send({
      from: 'SUTRA Contact <noreply@purama.dev>',
      to: 'matiss.frasne@gmail.com',
      replyTo: email,
      subject: `[SUTRA Contact] ${subject}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Nouveau message de contact SUTRA</h2>
          <p><strong>De :</strong> ${email}</p>
          <p><strong>Sujet :</strong> ${subject}</p>
          <hr style="border: 1px solid #eee;" />
          <p>${message.replace(/\n/g, '<br />')}</p>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur envoi message', details: message }, { status: 500 })
  }
}
