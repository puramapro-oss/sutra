'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Send, Star, Globe, Newspaper, MapPin } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

const VALID_CHANNELS = ['influencer', 'website', 'media', 'physical'] as const
type Channel = (typeof VALID_CHANNELS)[number]

const CHANNEL_META: Record<
  Channel,
  { label: string; icon: typeof Star; color: string; description: string }
> = {
  influencer: {
    label: 'Influenceur',
    icon: Star,
    color: 'from-violet-500 to-purple-600',
    description: 'Monétise ton audience en recommandant SUTRA à ta communauté.',
  },
  website: {
    label: 'Website',
    icon: Globe,
    color: 'from-blue-500 to-cyan-600',
    description: 'Intègre SUTRA sur ton site ou blog avec des liens trackés.',
  },
  media: {
    label: 'Média',
    icon: Newspaper,
    color: 'from-amber-500 to-orange-600',
    description: 'Parle de SUTRA dans tes articles, podcasts ou vidéos éditoriales.',
  },
  physical: {
    label: 'Physique',
    icon: MapPin,
    color: 'from-emerald-500 to-teal-600',
    description: 'Organise des ateliers et formations en présentiel avec SUTRA.',
  },
}

export default function CanalRegistrationPage() {
  const params = useParams()
  const router = useRouter()
  const canal = params.canal as string

  const isValid = VALID_CHANNELS.includes(canal as Channel)
  const meta = isValid ? CHANNEL_META[canal as Channel] : null

  const [bio, setBio] = useState('')
  const [website, setWebsite] = useState('')
  const [instagram, setInstagram] = useState('')
  const [youtube, setYoutube] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [twitter, setTwitter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isValid || !meta) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-2xl font-bold mb-4">Canal invalide</p>
          <p className="text-white/50 mb-6">
            Les canaux disponibles sont : Influenceur, Website, Média, Physique.
          </p>
          <Link href="/partenariat">
            <Button variant="secondary">Retour au programme</Button>
          </Link>
        </div>
      </div>
    )
  }

  const Icon = meta.icon

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bio.trim()) {
      setError('Présente-toi en quelques lignes.')
      return
    }
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/partner/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: canal,
          bio: bio.trim(),
          website: website.trim() || undefined,
          social_links: {
            instagram: instagram.trim() || undefined,
            youtube: youtube.trim() || undefined,
            tiktok: tiktok.trim() || undefined,
            twitter: twitter.trim() || undefined,
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Erreur lors de l\'inscription.')
      }

      router.push('/dashboard/partenaire')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="max-w-xl mx-auto px-4 py-12">
        <Link
          href="/partenariat"
          className="inline-flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors mb-8 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au programme
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-4 mb-6">
            <div
              className={cn(
                'w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center',
                meta.color
              )}
            >
              <Icon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Partenaire {meta.label}</h1>
              <p className="text-white/50 text-sm">{meta.description}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Présentation *
              </label>
              <textarea
                data-testid="input-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Décris ton activité, ton audience et pourquoi tu veux promouvoir SUTRA..."
                rows={4}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 resize-none transition-colors"
              />
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Site web{' '}
                {canal === 'website' ? (
                  <span className="text-violet-400">*</span>
                ) : (
                  <span className="text-white/30">(optionnel)</span>
                )}
              </label>
              <input
                data-testid="input-website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://monsite.com"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-colors"
              />
            </div>

            {/* Social links */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-3">
                Réseaux sociaux <span className="text-white/30">(optionnel)</span>
              </label>
              <div className="space-y-3">
                {[
                  { key: 'instagram', label: 'Instagram', value: instagram, set: setInstagram, placeholder: '@toncompte' },
                  { key: 'youtube', label: 'YouTube', value: youtube, set: setYoutube, placeholder: 'URL de ta chaîne' },
                  { key: 'tiktok', label: 'TikTok', value: tiktok, set: setTiktok, placeholder: '@toncompte' },
                  { key: 'twitter', label: 'X / Twitter', value: twitter, set: setTwitter, placeholder: '@toncompte' },
                ].map((social) => (
                  <div key={social.key} className="flex items-center gap-3">
                    <span className="text-white/40 text-sm w-20 shrink-0">{social.label}</span>
                    <input
                      data-testid={`input-${social.key}`}
                      type="text"
                      value={social.value}
                      onChange={(e) => social.set(e.target.value)}
                      placeholder={social.placeholder}
                      className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm" data-testid="form-error">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={loading}
              className="w-full"
              data-testid="submit-partner-form"
            >
              <Send className="w-5 h-5" />
              Soumettre ma candidature
            </Button>

            <p className="text-center text-white/30 text-xs">
              En soumettant, tu acceptes les{' '}
              <Link href="/cgv" className="text-violet-400 hover:underline">
                CGV
              </Link>{' '}
              du programme partenaire.
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  )
}
