import { Resend } from 'resend'
import { requireEnv } from '@/lib/env'
import { publicOrigin } from '@/lib/public-origin'

const FROM_EMAIL = 'SUTRA by Purama <noreply@purama.dev>'

// Client construit à l'appel : erreur explicite si RESEND_API_KEY absente
// (et pas de crash à l'import pendant un build sans env).
function getResend(): Resend {
  return new Resend(requireEnv('RESEND_API_KEY', 'envoi des emails transactionnels'))
}

function appUrl(): string {
  return publicOrigin('https://sutra.purama.dev')
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!)
}

/**
 * A provider receipt confirms acceptance, not delivery to the inbox. Keep
 * provider diagnostics and caller content out of logs and public errors.
 */
async function sendChecked(params: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  const resend = getResend()
  const response = await resend.emails.send({
    from: FROM_EMAIL,
    to: params.to,
    subject: params.subject.replace(/[\r\n]+/g, ' ').trim(),
    html: params.html,
  }).catch(() => {
    throw new Error('Email non envoye : service indisponible')
  })
  if (response?.error) {
    throw new Error('Email non envoye : envoi refuse')
  }
  if (typeof response?.data?.id !== 'string' || !response.data.id.trim()) {
    throw new Error('Email non envoye : reponse Resend invalide')
  }
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  await sendChecked({
    to,
    subject: 'Bienvenue sur SUTRA ! Cree ta premiere video en 2 min',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #06050e; color: #f8fafc; padding: 40px;">
        <h1 style="color: #8b5cf6;">Bienvenue sur SUTRA, ${escapeHtml(name ?? 'createur')} !</h1>
        <p>Tu fais desormais partie de la revolution de la creation video IA.</p>
        <p>Avec SUTRA, donne un sujet et recois une video prete a publier en quelques minutes.</p>
        <a href="${escapeHtml(`${appUrl()}/dashboard`)}" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px;">Creer ma premiere video</a>
        <p style="color: rgba(255,255,255,0.5); margin-top: 30px; font-size: 12px;">SUTRA by Purama - ${escapeHtml(appUrl())}</p>
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
        <h1 style="color: #8b5cf6;">Ton plan ${escapeHtml(plan)} est actif !</h1>
        <p>Montant : ${(amount / 100).toFixed(2)} EUR</p>
        <p>Tu as desormais acces a toutes les fonctionnalites de ton plan.</p>
        <a href="${escapeHtml(`${appUrl()}/dashboard`)}" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px;">Aller au dashboard</a>
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
        <p>"${escapeHtml(videoTitle)}" a ete generee avec succes.</p>
        <a href="${escapeHtml(`${appUrl()}/library?video=${encodeURIComponent(videoId)}`)}" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px;">Voir ma video</a>
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
        <p>Videos creees : <strong>${escapeHtml(String(stats.videos))}</strong></p>
        <p>Continue comme ca !</p>
        <a href="${escapeHtml(`${appUrl()}/dashboard`)}" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px;">Creer une nouvelle video</a>
      </div>
    `,
  })
}
