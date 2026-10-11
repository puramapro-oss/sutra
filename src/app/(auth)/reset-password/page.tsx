'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Lock, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase'
import { signupSchema } from '@/lib/validators'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function ResetPasswordPage() {
  const { user, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving || !user) return
    const result = signupSchema.shape.password.safeParse(password)
    if (!result.success) { setError(result.error.issues[0].message); return }
    if (password !== confirmation) { setError('Les mots de passe ne correspondent pas.'); return }
    setError('')
    setSaving(true)
    try {
      const { error } = await createClient().auth.updateUser({ password })
      if (error) throw error
      setPassword('')
      setConfirmation('')
      setDone(true)
    } catch {
      setError('Le mot de passe n’a pas pu être modifié. Vérifie la connexion ou demande un nouveau lien si ta session a expiré.')
    } finally { setSaving(false) }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <Link href="/" className="font-bold text-violet-300">SUTRA</Link>
        <h1 className="mt-6 mb-3 text-2xl font-semibold">Nouveau mot de passe</h1>
        {loading ? <p role="status" className="text-white/70">Vérification du lien…</p> : done ? (
          <div role="status" className="space-y-5">
            <p className="flex items-center gap-2 text-emerald-300"><CheckCircle2 className="h-5 w-5" /> Mot de passe modifié.</p>
            <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-xl bg-violet-600 px-5 text-white">Ouvrir le studio</Link>
          </div>
        ) : !user ? (
          <div className="space-y-4">
            <p role="alert" className="text-white/70">Le lien a expiré ou aucune session n’a été vérifiée.</p>
            <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-violet-300 underline">Demander un nouveau lien</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5">
            <p className="text-sm text-white/70">Choisis au moins 8 caractères. Ton ancien mot de passe n’est pas nécessaire pour cette réinitialisation.</p>
            <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} iconLeft={<Lock className="h-4 w-4" />} required minLength={8} />
            <Input label="Confirmer le mot de passe" type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} error={error} required />
            <Button type="submit" className="w-full" loading={saving}>Enregistrer le mot de passe</Button>
          </form>
        )}
        <Link href="/login" className="mt-6 inline-flex min-h-11 items-center text-sm text-white/70 underline">Retour à la connexion</Link>
      </section>
    </main>
  )
}
