'use client'

import { Suspense, useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react'
import { toast } from 'sonner'
import { signupSchema } from '@/lib/validators'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

function getPasswordStrength(password: string): {
  score: number
  label: string
  color: string
} {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score, label: 'Faible', color: 'bg-red-500' }
  if (score <= 2) return { score, label: 'Moyen', color: 'bg-orange-500' }
  if (score <= 3) return { score, label: 'Bon', color: 'bg-yellow-500' }
  return { score, label: 'Excellent', color: 'bg-emerald-500' }
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupContent />
    </Suspense>
  )
}

function SignupContent() {
  const { signUp, signInWithGoogle } = useAuth()
  const searchParams = useSearchParams()
  const refCode = searchParams.get('ref') ?? ''

  // Store referral code in localStorage for post-signup processing
  useEffect(() => {
    if (refCode) {
      localStorage.setItem('sutra-referral-code', refCode)
    }
  }, [refCode])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [acceptCGU, setAcceptCGU] = useState(false)
  const [errors, setErrors] = useState<{
    name?: string
    email?: string
    password?: string
    cgu?: string
  }>({})

  const strength = useMemo(() => getPasswordStrength(password), [password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const result = signupSchema.safeParse({ name, email, password })
    if (!result.success) {
      const fieldErrors: { name?: string; email?: string; password?: string; cgu?: string } =
        {}
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string
        if (field === 'name' || field === 'email' || field === 'password') {
          fieldErrors[field] = issue.message
        }
      })
      if (!acceptCGU) fieldErrors.cgu = 'Tu dois accepter les CGU'
      setErrors(fieldErrors)
      return
    }

    if (!acceptCGU) {
      setErrors({ cgu: 'Tu dois accepter les CGU et la politique de confidentialite' })
      return
    }

    setLoading(true)
    try {
      const storedRef = localStorage.getItem('sutra-referral-code') ?? refCode
      await signUp(email, password, name, storedRef || undefined)
      setSuccess(true)
      localStorage.removeItem('sutra-referral-code')
      toast.success('Compte cree avec succes !')
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de l'inscription"
      if (message.includes('already registered')) {
        toast.error('Cet email est deja utilise')
      } else {
        toast.error(message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch {
      toast.error('Erreur de connexion Google')
      setGoogleLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4 py-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#06050e]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/8 rounded-full blur-[120px]" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative w-full max-w-md"
        >
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 text-center shadow-2xl shadow-violet-500/5">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="font-display text-xl font-bold text-white mb-2">
              Verifie ton email
            </h2>
            <p className="text-white/50 text-sm mb-6 leading-relaxed">
              Un email de confirmation a ete envoye a{' '}
              <span className="text-violet-400 font-medium">{email}</span>.
              <br />
              Clique sur le lien pour activer ton compte.
            </p>
            <Link href="/login">
              <Button variant="secondary" size="md">
                Retour a la connexion
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[#06050e]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/8 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Glass card */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 shadow-2xl shadow-violet-500/5">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block">
              <h1 className="font-display text-3xl font-bold tracking-wider bg-gradient-to-r from-violet-400 via-purple-400 to-violet-300 bg-clip-text text-transparent">
                SUTRA
              </h1>
            </Link>
            <p className="text-white/50 text-sm mt-2">
              Cree ton compte gratuitement
            </p>
          </div>

          {/* Google button */}
          <Button
            data-testid="google-button"
            variant="secondary"
            size="lg"
            className="w-full mb-6"
            onClick={handleGoogle}
            loading={googleLoading}
            disabled={loading}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            S&apos;inscrire avec Google
          </Button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.06]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#06050e] px-3 text-white/30">ou</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                data-testid="name-input"
                type="text"
                label="Prenom"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
                autoComplete="given-name"
                className="pl-11"
              />
              <User className="absolute left-4 top-3.5 w-4 h-4 text-white/30 pointer-events-none" />
            </div>

            <div className="relative">
              <Input
                data-testid="email-input"
                type="email"
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                autoComplete="email"
                className="pl-11"
              />
              <Mail className="absolute left-4 top-3.5 w-4 h-4 text-white/30 pointer-events-none" />
            </div>

            <div className="relative">
              <Input
                data-testid="password-input"
                type={showPassword ? 'text' : 'password'}
                label="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                autoComplete="new-password"
                className="pl-11 pr-11"
              />
              <Lock className="absolute left-4 top-3.5 w-4 h-4 text-white/30 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-4 top-3.5 text-white/30 hover:text-white/60 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Password strength */}
            {password.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-1.5"
              >
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                        i <= strength.score ? strength.color : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-white/40">
                  Force :{' '}
                  <span
                    className={`font-medium ${
                      strength.score <= 1
                        ? 'text-red-400'
                        : strength.score <= 2
                          ? 'text-orange-400'
                          : strength.score <= 3
                            ? 'text-yellow-400'
                            : 'text-emerald-400'
                    }`}
                  >
                    {strength.label}
                  </span>
                </p>
              </motion.div>
            )}

            {/* CGU checkbox */}
            <div className="space-y-1">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptCGU}
                  onChange={(e) => {
                    setAcceptCGU(e.target.checked)
                    if (e.target.checked) setErrors((prev) => ({ ...prev, cgu: undefined }))
                  }}
                  data-testid="cgu-checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500/50 accent-violet-500"
                />
                <span className="text-xs text-white/50 leading-relaxed">
                  J&apos;accepte les{' '}
                  <Link href="/legal/terms" target="_blank" className="text-violet-400 hover:text-violet-300 underline">
                    conditions generales d&apos;utilisation
                  </Link>
                  , les{' '}
                  <Link href="/legal/cgv" target="_blank" className="text-violet-400 hover:text-violet-300 underline">
                    conditions generales de vente
                  </Link>
                  {' '}et la{' '}
                  <Link href="/legal/privacy" target="_blank" className="text-violet-400 hover:text-violet-300 underline">
                    politique de confidentialite
                  </Link>
                  .
                </span>
              </label>
              {errors.cgu && (
                <p className="text-xs text-red-400 ml-7">{errors.cgu}</p>
              )}
            </div>

            <Button
              data-testid="signup-button"
              type="submit"
              size="lg"
              className="w-full"
              loading={loading}
              disabled={googleLoading}
            >
              Creer mon compte
            </Button>
          </form>

          {/* Login link */}
          <p className="text-center text-sm text-white/40 mt-6">
            Deja un compte ?{' '}
            <Link
              href="/login"
              className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
            >
              Connecte-toi
            </Link>
          </p>

        </div>

        {/* Footer */}
        <p className="text-center text-xs text-white/20 mt-6">
          SUTRA by Purama — Generation video IA
        </p>
      </motion.div>
    </div>
  )
}
