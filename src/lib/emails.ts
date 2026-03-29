import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)
const FROM_EMAIL = 'SUTRA by Purama <noreply@purama.dev>'

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Bienvenue sur SUTRA ! Cree ta premiere video en 2 min',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #06050e; color: #f8fafc; padding: 40px;">
        <h1 style="color: #8b5cf6;">Bienvenue sur SUTRA, ${name ?? 'createur'} !</h1>
        <p>Tu fais desormais partie de la revolution de la creation video IA.</p>
        <p>Avec SUTRA, donne un sujet et recois une video prete a publier en quelques minutes.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px;">Creer ma premiere video</a>
        <p style="color: rgba(255,255,255,0.5); margin-top: 30px; font-size: 12px;">SUTRA by Purama - ${process.env.NEXT_PUBLIC_APP_URL}</p>
      </div>
    `,
  })
}

export async function sendSubscriptionEmail(
  to: string,
  plan: string,
  amount: number
): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Abonnement ${plan} active !`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #06050e; color: #f8fafc; padding: 40px;">
        <h1 style="color: #8b5cf6;">Ton plan ${plan} est actif !</h1>
        <p>Montant : ${(amount / 100).toFixed(2)} EUR/mois</p>
        <p>Tu as desormais acces a toutes les fonctionnalites de ton plan.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px;">Aller au dashboard</a>
      </div>
    `,
  })
}

export async function sendVideoReadyEmail(
  to: string,
  videoTitle: string,
  videoId: string
): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Ta video "${videoTitle}" est prete !`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #06050e; color: #f8fafc; padding: 40px;">
        <h1 style="color: #8b5cf6;">Ta video est prete !</h1>
        <p>"${videoTitle}" a ete generee avec succes.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/library?video=${videoId}" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px;">Voir ma video</a>
      </div>
    `,
  })
}

export async function sendWeeklyDigest(
  to: string,
  stats: { videos: number; views: number }
): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Ta semaine sur SUTRA : ${stats.videos} videos`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #06050e; color: #f8fafc; padding: 40px;">
        <h1 style="color: #8b5cf6;">Recap de ta semaine</h1>
        <p>Videos creees : <strong>${stats.videos}</strong></p>
        <p>Continue comme ca !</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px;">Creer une nouvelle video</a>
      </div>
    `,
  })
}
