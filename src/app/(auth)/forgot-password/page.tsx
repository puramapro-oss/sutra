'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const supabase = createClient()

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Email invalide')
      return
    }

    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
        }
      )
      if (resetError) throw resetError
      setSent(true)
      toast.success('Email de reinitialisation envoye')
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Erreur lors de l'envoi"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-[#06050e]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/8 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 shadow-2xl shadow-violet-500/5">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block">
              <h1 className="font-display text-3xl font-bold tracking-wider bg-gradient-to-r from-violet-400 via-purple-400 to-violet-300 bg-clip-text text-transparent">
                SUTRA
              </h1>
            </Link>
            <p className="text-white/50 text-sm mt-2">
              Reinitialise ton mot de passe
            </p>
          </div>

          {sent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Mail className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">
                Email envoye
              </h2>
              <p className="text-white/50 text-sm mb-6 leading-relaxed">
                Un lien de reinitialisation a ete envoye a{' '}
                <span className="text-violet-400 font-medium">{email}</span>.
                <br />
                Verifie tes spams si tu ne le vois pas.
              </p>
              <Link href="/login">
                <Button variant="secondary" size="md">
                  <ArrowLeft className="w-4 h-4" />
                  Retour a la connexion
                </Button>
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  data-testid="email-input"
                  type="email"
                  label="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={error}
                  autoComplete="email"
                  className="pl-11"
                />
                <Mail className="absolute left-4 top-3.5 w-4 h-4 text-white/30 pointer-events-none" />
              </div>

              <Button
                data-testid="reset-button"
                type="submit"
                size="lg"
                className="w-full"
                loading={loading}
              >
                Envoyer le lien
              </Button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Retour a la connexion
                </Link>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          SUTRA by Purama — Generation video IA
        </p>
      </motion.div>
    </div>
  )
}
