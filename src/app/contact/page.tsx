'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Send, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { contactSchema } from '@/lib/validators'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const confirmed = useRef(false)
  const mounted = useRef(true)
  const confirmation = useRef<HTMLDivElement>(null)
  const fieldsId = useId()

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (sent) confirmation.current?.focus()
  }, [sent])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inFlight.current || confirmed.current) return
    const payload = contactSchema.safeParse({ name, email, subject, message })
    if (!payload.success) {
      setError('Vérifie les champs : nom, adresse email, sujet de 5 à 200 caractères et message de 10 à 2 000 caractères.')
      return
    }
    inFlight.current = true
    setError('')
    setSending(true)
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
        setError('Envoi non confirmé. Ton message est conservé.')
        return
      }
      confirmed.current = true
      setSent(true)
      toast.success('Message envoyé !')
    } catch {
      if (mounted.current) setError('Envoi non confirmé. Vérifie ta connexion avant de réessayer.')
    } finally {
      inFlight.current = false
      if (mounted.current) setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-6">
        <motion.div
          role="status"
          ref={confirmation}
          tabIndex={-1}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Message envoyé</h1>
          <p className="text-white/50">On te répond au plus vite !</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <Mail className="w-10 h-10 text-violet-400 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">Contacte-nous</h1>
          <p className="text-white/50 mt-1">Une question ? On est la pour toi</p>
        </div>

        <Card className="glass">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} aria-busy={sending} aria-describedby={error ? `${fieldsId}-error` : undefined} className="space-y-4">
              <Input
                label="Nom *"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ton nom"
                required
                autoComplete="name"
                maxLength={100}
                disabled={sending}
              />
              <Input
                label="Email *"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ton@email.com"
                required
                autoComplete="email"
                disabled={sending}
              />
              <Input
                label="Sujet *"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="De quoi s&apos;agit-il ?"
                required
                minLength={5}
                maxLength={200}
                disabled={sending}
              />
              <div>
                <label htmlFor={`${fieldsId}-message`} className="block text-sm font-medium text-white/70 mb-1.5">Message *</label>
                <textarea
                  id={`${fieldsId}-message`}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Dis-nous tout..."
                  rows={5}
                  required
                  minLength={10}
                  maxLength={2000}
                  disabled={sending}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 outline-none resize-none transition-colors"
                />
              </div>
              {error && <p id={`${fieldsId}-error`} role="alert" className="text-sm text-red-300">{error}</p>}
              <Button type="submit" className="w-full" disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Envoyer
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
