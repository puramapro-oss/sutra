import { Resend } from 'resend'
import { requireEnv, optionalEnv } from '@/lib/env'

const FROM_EMAIL = 'SUTRA by Purama <noreply@purama.dev>'

// Client construit à l'appel : erreur explicite si RESEND_API_KEY absente
// (et pas de crash à l'import pendant un build sans env).
function getResend(): Resend {
  return new Resend(requireEnv('RESEND_API_KEY', 'envoi des emails transactionnels'))
}

function appUrl(): string {
  return optionalEnv('NEXT_PUBLIC_APP_URL', 'https://sutra.purama.dev')
}

/**
 * Envoi vérifié : le SDK Resend ne jette PAS sur erreur API — il retourne
 * `{ error }`. On logge (sans secret) et on throw une erreur explicite pour
 * ne jamais croire un email parti alors qu'il a été refusé.
 */
async function sendChecked(params: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  const resend = getResend()
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: params.to,
    subject: params.subject,
    html: params.html,
  })
  if (error) {
    console.error(`[emails] Resend a refuse l'envoi (${params.subject}) : ${error.name} ${error.message}`)
    throw new Error(`Email non envoye : ${error.name} ${error.message}`)
  }
  if (!data?.id) {
    throw new Error('Email non envoye : reponse Resend invalide (id absent)')
  }
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  await sendChecked({
    to,
    subject: 'Bienvenue sur SUTRA ! Cree ta premiere video en 2 min',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #06050e; color: #f8fafc; padding: 40px;">
        <h1 style="color: #8b5cf6;">Bienvenue sur SUTRA, ${name ?? 'createur'} !</h1>
        <p>Tu fais desormais partie de la revolution de la creation video IA.</p>
        <p>Avec SUTRA, donne un sujet et recois une video prete a publier en quelques minutes.</p>
        <a href="${appUrl()}/dashboard" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px;">Creer ma premiere video</a>
        <p style="color: rgba(255,255,255,0.5); margin-top: 30px; font-size: 12px;">SUTRA by Purama - ${appUrl()}</p>
      </div>
    `,
  })
}

export async function sendSubscriptionEmail(
  to: string,
  plan: string,
  amount: number
): Promise<void> {
  await sendChecked({
    to,
    subject: `Abonnement ${plan} active !`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #06050e; color: #f8fafc; padding: 40px;">
        <h1 style="color: #8b5cf6;">Ton plan ${plan} est actif !</h1>
        <p>Montant : ${(amount / 100).toFixed(2)} EUR/mois</p>
        <p>Tu as desormais acces a toutes les fonctionnalites de ton plan.</p>
        <a href="${appUrl()}/dashboard" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px;">Aller au dashboard</a>
      </div>
    `,
  })
}

export async function sendVideoReadyEmail(
  to: string,
  videoTitle: string,
  videoId: string
): Promise<void> {
  await sendChecked({
    to,
    subject: `Ta video "${videoTitle}" est prete !`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #06050e; color: #f8fafc; padding: 40px;">
        <h1 style="color: #8b5cf6;">Ta video est prete !</h1>
        <p>"${videoTitle}" a ete generee avec succes.</p>
        <a href="${appUrl()}/library?video=${videoId}" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px;">Voir ma video</a>
      </div>
    `,
  })
}

export async function sendWeeklyDigest(
  to: string,
  stats: { videos: number; views: number }
): Promise<void> {
  await sendChecked({
    to,
    subject: `Ta semaine sur SUTRA : ${stats.videos} videos`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #06050e; color: #f8fafc; padding: 40px;">
        <h1 style="color: #8b5cf6;">Recap de ta semaine</h1>
        <p>Videos creees : <strong>${stats.videos}</strong></p>
        <p>Continue comme ca !</p>
        <a href="${appUrl()}/dashboard" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px;">Creer une nouvelle video</a>
      </div>
    `,
  })
}
