'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Send, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error('Remplis tous les champs obligatoires')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      })
      if (res.ok) {
        setSent(true)
        toast.success('Message envoye !')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de l\'envoi')
      }
    } catch {
      toast.error('Erreur reseau')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Message envoye</h1>
          <p className="text-white/50">On te repond au plus vite !</p>
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Nom *"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ton nom"
                required
              />
              <Input
                label="Email *"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ton@email.com"
                required
              />
              <Input
                label="Sujet"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="De quoi s'agit-il ?"
              />
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Message *</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Dis-nous tout..."
                  rows={5}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 outline-none resize-none transition-colors"
                />
              </div>
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
