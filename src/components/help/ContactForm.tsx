'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { contactSchema } from '@/lib/validators'

export default function ContactForm() {
  const [formState, setFormState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const inFlight = useRef(false)
  const confirmed = useRef(false)
  const mounted = useRef(true)
  const nextMessage = useRef<HTMLButtonElement>(null)
  const fieldsId = useId()

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (formState === 'success') nextMessage.current?.focus()
  }, [formState])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (inFlight.current || confirmed.current) return

    const form = e.currentTarget
    const data = new FormData(form)
    const payload = contactSchema.safeParse({
      name: data.get('name'), email: data.get('email'),
      subject: data.get('subject'), message: data.get('message'),
    })
    if (!payload.success) {
      setErrorMsg('Vérifie les champs : nom, adresse email, sujet de 5 à 200 caractères et message de 10 à 2 000 caractères.')
      setFormState('error')
      return
    }
    inFlight.current = true
    setFormState('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.data),
      })

      const receipt: unknown = await res.json().catch(() => null)
      if (!mounted.current) return
      if (!res.ok || !receipt || typeof receipt !== 'object'
        || !('success' in receipt) || receipt.success !== true) {
        throw new Error('Envoi non confirmé. Ton message est conservé.')
      }

      confirmed.current = true
      setFormState('success')
    } catch (err) {
      if (!mounted.current) return
      setErrorMsg(err instanceof Error && err.message === 'Envoi non confirmé. Ton message est conservé.'
        ? err.message : 'Envoi non confirmé. Vérifie ta connexion avant de réessayer.')
      setFormState('error')
    } finally {
      inFlight.current = false
    }
  }

  if (formState === 'success') {
    return (
      <div className="space-y-4">
        <div role="status" className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
          <CheckCircle2 aria-hidden="true" className="w-4 h-4 flex-shrink-0" />
          Message envoyé avec succès. Nous te répondrons rapidement.
        </div>
        <button ref={nextMessage} type="button" className="text-sm text-violet-300 underline" onClick={() => {
          confirmed.current = false
          setErrorMsg('')
          setFormState('idle')
        }}>Écrire un autre message</button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={formState === 'loading'}
      aria-describedby={formState === 'error' ? `${fieldsId}-error` : undefined}
      className="space-y-5"
      data-testid="contact-form"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${fieldsId}-name`} className="block text-sm font-medium text-white/70 mb-1.5">
            Nom
          </label>
          <input
            id={`${fieldsId}-name`}
            name="name"
            type="text"
            required
            minLength={1}
            maxLength={100}
            autoComplete="name"
            disabled={formState === 'loading'}
            data-testid="contact-name-input"
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm"
            placeholder="Ton nom"
          />
        </div>
        <div>
          <label htmlFor={`${fieldsId}-email`} className="block text-sm font-medium text-white/70 mb-1.5">
            Email
          </label>
          <input
            id={`${fieldsId}-email`}
            name="email"
            type="email"
            required
            autoComplete="email"
            disabled={formState === 'loading'}
            data-testid="contact-email-input"
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm"
            placeholder="ton@email.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${fieldsId}-subject`} className="block text-sm font-medium text-white/70 mb-1.5">
          Sujet
        </label>
        <input
          id={`${fieldsId}-subject`}
          name="subject"
          type="text"
          required
          minLength={5}
          maxLength={200}
          disabled={formState === 'loading'}
          data-testid="contact-subject-input"
          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm"
          placeholder="Quel est le sujet ?"
        />
      </div>

      <div>
        <label htmlFor={`${fieldsId}-message`} className="block text-sm font-medium text-white/70 mb-1.5">
          Message
        </label>
        <textarea
          id={`${fieldsId}-message`}
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          disabled={formState === 'loading'}
          data-testid="contact-message-input"
          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm resize-none"
          placeholder="Decris ton probleme ou ta question..."
        />
      </div>

      {formState === 'error' && (
        <motion.div
          id={`${fieldsId}-error`}
          role="alert"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {errorMsg || 'Erreur lors de l\'envoi. Reessaie plus tard.'}
        </motion.div>
      )}

      <button
        type="submit"
        disabled={formState === 'loading'}
        data-testid="contact-submit"
        className={cn(
          'w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97] flex items-center justify-center gap-2',
          'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40',
          formState === 'loading' && 'opacity-70 cursor-not-allowed'
        )}
      >
        {formState === 'loading' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        {formState === 'loading' ? 'Envoi...' : 'Envoyer'}
      </button>
    </form>
  )
}
