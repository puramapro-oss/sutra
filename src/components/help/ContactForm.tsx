'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ContactForm() {
  const [formState, setFormState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormState('loading')
    setErrorMsg('')

    const form = e.currentTarget
    const data = new FormData(form)
    const body = {
      name: data.get('name') as string,
      email: data.get('email') as string,
      subject: data.get('subject') as string,
      message: data.get('message') as string,
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error ?? 'Erreur lors de l\'envoi')
      }

      setFormState('success')
      form.reset()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur inconnue')
      setFormState('error')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
      data-testid="contact-form"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="contact-name" className="block text-sm font-medium text-white/70 mb-1.5">
            Nom
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={50}
            data-testid="contact-name-input"
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm"
            placeholder="Ton nom"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="block text-sm font-medium text-white/70 mb-1.5">
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            data-testid="contact-email-input"
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm"
            placeholder="ton@email.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact-subject" className="block text-sm font-medium text-white/70 mb-1.5">
          Sujet
        </label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          required
          minLength={3}
          maxLength={100}
          data-testid="contact-subject-input"
          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm"
          placeholder="Quel est le sujet ?"
        />
      </div>

      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-white/70 mb-1.5">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          data-testid="contact-message-input"
          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm resize-none"
          placeholder="Decris ton probleme ou ta question..."
        />
      </div>

      {formState === 'success' && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3"
        >
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Message envoye avec succes. Nous te repondrons rapidement.
        </motion.div>
      )}

      {formState === 'error' && (
        <motion.div
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
