'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  User,
  Settings,
  CreditCard,
  Bell,
  Palette,
  Database,
  Camera,
  ExternalLink,
  Trash2,
  Download,
  Sun,
  Moon,
  Shield,
  Lock,
  Loader2,
  AlertTriangle,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { cn, formatPrice } from '@/lib/utils'
import { PLAN_LIMITS, NICHES, VOICE_STYLES } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Input } from '@/components/ui/Input'
import { Tabs } from '@/components/ui/Tabs'
import { Modal } from '@/components/ui/Modal'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { Plan, VideoQuality, EmailPreferences } from '@/types'

const supabase = createClient()

const SETTINGS_TABS = [
  { id: 'profil', label: 'Profil', icon: <User className="h-4 w-4" /> },
  { id: 'compte', label: 'Compte', icon: <Lock className="h-4 w-4" /> },
  { id: 'abonnement', label: 'Abonnement', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  { id: 'apparence', label: 'Apparence', icon: <Palette className="h-4 w-4" /> },
  { id: 'donnees', label: 'Donnees', icon: <Database className="h-4 w-4" /> },
]

const QUALITY_OPTIONS: { value: VideoQuality; label: string }[] = [
  { value: '720p', label: '720p HD' },
  { value: '1080p', label: '1080p Full HD' },
  { value: '4k', label: '4K Ultra HD' },
]

export default function SettingsPage() {
  const { profile, plan, loading: authLoading, refetch } = useAuth()
  const { theme, setTheme } = useTheme()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Profile form
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [preferredNiche, setPreferredNiche] = useState('')
  const [preferredQuality, setPreferredQuality] = useState<VideoQuality>('1080p')
  const [preferredVoice, setPreferredVoice] = useState('')

  // Account
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Notifications
  const [emailPrefs, setEmailPrefs] = useState<EmailPreferences>({
    welcome: true,
    digest: true,
    inactivity: true,
    tips: true,
    contest: true,
    referral: true,
  })

  // Brand Kit
  const [brandLogo, setBrandLogo] = useState('')
  const [brandPrimary, setBrandPrimary] = useState('#8b5cf6')
  const [brandSecondary, setBrandSecondary] = useState('#06050e')
  const [brandFont, setBrandFont] = useState('')

  // UI state
  const [saving, setSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Init form
  useEffect(() => {
    if (!profile) return
    setName(profile.name ?? '')
    setAvatarUrl(profile.avatar_url ?? '')
    setPreferredNiche(profile.preferred_niche ?? '')
    setPreferredQuality(profile.preferred_quality ?? '1080p')
    setPreferredVoice(profile.preferred_voice_style ?? '')
    setEmailPrefs(profile.email_preferences ?? {
      welcome: true, digest: true, inactivity: true, tips: true, contest: true, referral: true,
    })
    if (profile.brand_kit) {
      setBrandLogo(profile.brand_kit.logo_url ?? '')
      setBrandPrimary(profile.brand_kit.colors?.primary ?? '#8b5cf6')
      setBrandSecondary(profile.brand_kit.colors?.secondary ?? '#06050e')
      setBrandFont(profile.brand_kit.font ?? '')
    }
  }, [profile])

  // Save profile
  const saveProfile = useCallback(async () => {
    if (!profile) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: name.trim() || null,
          preferred_niche: preferredNiche || null,
          preferred_quality: preferredQuality,
          preferred_voice_style: preferredVoice || null,
        })
        .eq('id', profile.id)

      if (error) throw error
      await refetch()
      toast.success('Profil mis a jour !')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }, [profile, name, preferredNiche, preferredQuality, preferredVoice, refetch])

  // Upload avatar
  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${profile.id}.${ext}`
      const { error: uploadError } = await supabase.storage.from('public').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('public').getPublicUrl(path)

      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id)
      setAvatarUrl(publicUrl)
      await refetch()
      toast.success('Avatar mis a jour !')
    } catch {
      toast.error("Erreur lors de l'upload")
    } finally {
      setUploadingAvatar(false)
    }
  }, [profile, refetch])

  // Change password
  const handlePasswordChange = useCallback(async () => {
    if (newPassword.length < 8) {
      toast.error('Le mot de passe doit faire au moins 8 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success('Mot de passe mis a jour !')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      toast.error('Erreur lors du changement de mot de passe')
    } finally {
      setSaving(false)
    }
  }, [newPassword, confirmPassword])

  // Save notifications
  const saveNotifications = useCallback(async () => {
    if (!profile) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ email_preferences: emailPrefs })
        .eq('id', profile.id)

      if (error) throw error
      toast.success('Preferences de notifications sauvegardees !')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }, [profile, emailPrefs])

  // Save brand kit
  const saveBrandKit = useCallback(async () => {
    if (!profile) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          brand_kit: {
            logo_url: brandLogo || undefined,
            colors: { primary: brandPrimary, secondary: brandSecondary },
            font: brandFont || undefined,
          },
        })
        .eq('id', profile.id)

      if (error) throw error
      toast.success('Brand Kit sauvegarde !')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }, [profile, brandLogo, brandPrimary, brandSecondary, brandFont])

  // Open Stripe portal
  const openBillingPortal = useCallback(async () => {
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.assign(data.url)
      else toast.error('Impossible de charger le portail de paiement')
    } catch {
      toast.error('Erreur')
    }
  }, [])

  // Export data
  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/user/export')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'sutra-data-export.json'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Donnees exportees !')
    } catch {
      toast.error("Erreur lors de l'export")
    } finally {
      setExporting(false)
    }
  }, [])

  // Delete account
  const handleDeleteAccount = useCallback(async () => {
    if (deleteConfirm !== 'SUPPRIMER') {
      toast.error('Tape SUPPRIMER pour confirmer')
      return
    }
    setDeleting(true)
    try {
      const res = await fetch('/api/user/delete', { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      await supabase.auth.signOut()
      window.location.assign('/')
    } catch {
      toast.error('Erreur lors de la suppression')
      setDeleting(false)
    }
  }, [deleteConfirm])

  const toggleEmailPref = useCallback((key: keyof EmailPreferences) => {
    setEmailPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const limits = PLAN_LIMITS[plan]
  const planLabels: Record<Plan, string> = {
    free: 'Gratuit',
    starter: 'Starter',
    creator: 'Creator',
    empire: 'Empire',
    admin: 'Admin',
  }

  if (authLoading) {
    return (
      <div className="space-y-6" data-testid="settings-loading">
        <Skeleton width={200} height={32} rounded="lg" />
        <Skeleton width="100%" height={48} rounded="xl" />
        <Skeleton width="100%" height={400} rounded="xl" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-4xl mx-auto"
    >
      <div>
        <h1 className="text-2xl font-bold text-white" data-testid="settings-title">
          Reglages
        </h1>
        <p className="text-sm text-white/40 mt-1">Gere ton profil, ton abonnement et tes preferences</p>
      </div>

      <Tabs tabs={SETTINGS_TABS} data-testid="settings-tabs">
        {(activeTab) => (
          <>
            {/* Profil */}
            {activeTab === 'profil' && (
              <Card data-testid="settings-profil">
                <CardContent className="space-y-5">
                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <div className="h-16 w-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center overflow-hidden">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <User className="h-7 w-7 text-violet-400" />
                        )}
                      </div>
                      <button
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        data-testid="settings-avatar-upload"
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
                      >
                        {uploadingAvatar ? (
                          <Loader2 className="h-5 w-5 text-white animate-spin" />
                        ) : (
                          <Camera className="h-5 w-5 text-white" />
                        )}
                      </button>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-white/70">{profile?.name ?? 'Utilisateur'}</p>
                      <p className="text-xs text-white/30">{profile?.email}</p>
                    </div>
                  </div>

                  <Input
                    label="Nom complet"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="settings-name-input"
                  />

                  {/* Preferred niche */}
                  <div>
                    <label className="text-sm font-medium text-white/60 mb-2 block">Niche preferee</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {NICHES.map((niche) => (
                        <button
                          key={niche}
                          onClick={() => setPreferredNiche(niche)}
                          data-testid={`settings-niche-${niche}`}
                          className={cn(
                            'px-3 py-2 rounded-xl text-xs font-medium border transition-all capitalize',
                            preferredNiche === niche
                              ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                              : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/60'
                          )}
                        >
                          {niche.replace('-', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quality */}
                  <div>
                    <label className="text-sm font-medium text-white/60 mb-2 block">Qualite preferee</label>
                    <div className="flex gap-2">
                      {QUALITY_OPTIONS.map((q) => (
                        <button
                          key={q.value}
                          onClick={() => setPreferredQuality(q.value)}
                          data-testid={`settings-quality-${q.value}`}
                          className={cn(
                            'flex-1 px-3 py-2.5 rounded-xl text-sm border transition-all',
                            preferredQuality === q.value
                              ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                              : 'bg-white/[0.02] border-white/[0.06] text-white/40'
                          )}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Voice */}
                  <div>
                    <label className="text-sm font-medium text-white/60 mb-2 block">Voix preferee</label>
                    <select
                      value={preferredVoice}
                      onChange={(e) => setPreferredVoice(e.target.value)}
                      data-testid="settings-voice-select"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 outline-none appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-[#0c0b14]">Aucune preference</option>
                      {VOICE_STYLES.map((v) => (
                        <option key={v.id} value={v.id} className="bg-[#0c0b14]">
                          {v.name} ({v.gender === 'male' ? 'Homme' : 'Femme'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button onClick={saveProfile} loading={saving} data-testid="settings-save-profil">
                    Sauvegarder le profil
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Compte */}
            {activeTab === 'compte' && (
              <div className="space-y-4">
                <Card data-testid="settings-compte">
                  <CardContent className="space-y-4">
                    <h3 className="text-sm font-semibold text-white">Email</h3>
                    <Input
                      label="Adresse email"
                      value={profile?.email ?? ''}
                      disabled
                      data-testid="settings-email"
                    />
                    <p className="text-xs text-white/25">L&apos;email ne peut pas etre modifie.</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-4">
                    <h3 className="text-sm font-semibold text-white">Changer le mot de passe</h3>
                    <Input
                      label="Mot de passe actuel"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      data-testid="settings-current-password"
                    />
                    <Input
                      label="Nouveau mot de passe"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      data-testid="settings-new-password"
                    />
                    <Input
                      label="Confirmer le mot de passe"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      data-testid="settings-confirm-password"
                    />
                    <Button
                      onClick={handlePasswordChange}
                      loading={saving}
                      variant="secondary"
                      data-testid="settings-change-password"
                    >
                      <Lock className="h-4 w-4" />
                      Changer le mot de passe
                    </Button>
                  </CardContent>
                </Card>

              </div>
            )}

            {/* Abonnement */}
            {activeTab === 'abonnement' && (
              <Card data-testid="settings-abonnement">
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Plan actuel</h3>
                      <Badge variant="premium" className="mt-1">{planLabels[plan]}</Badge>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={openBillingPortal}
                      data-testid="settings-manage-subscription"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Gerer l&apos;abonnement
                    </Button>
                  </div>

                  {/* Usage stats */}
                  <div className="space-y-4 pt-4 border-t border-white/[0.06]">
                    <h4 className="text-xs font-medium text-white/40">Utilisation ce mois</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="text-white/50">Videos</span>
                          <span className="text-white/70">
                            {profile?.monthly_video_count ?? 0} / {limits.videos === 9999 ? '∞' : limits.videos}
                          </span>
                        </div>
                        <ProgressBar
                          value={profile?.monthly_video_count ?? 0}
                          max={limits.videos}
                          data-testid="usage-videos"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-3 rounded-xl bg-white/[0.02]">
                          <p className="text-white/40 text-xs">Qualite max</p>
                          <p className="text-white/70 font-medium">{limits.quality}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white/[0.02]">
                          <p className="text-white/40 text-xs">Voix clonees</p>
                          <p className="text-white/70 font-medium">{limits.voices === 0 ? 'Non inclus' : limits.voices}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white/[0.02]">
                          <p className="text-white/40 text-xs">Autopilot</p>
                          <p className="text-white/70 font-medium">{limits.autopilot === 0 ? 'Non inclus' : `${limits.autopilot} series`}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white/[0.02]">
                          <p className="text-white/40 text-xs">Reseaux</p>
                          <p className="text-white/70 font-medium">{limits.networks === 0 ? 'Non inclus' : limits.networks}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {plan !== 'empire' && plan !== 'admin' && (
                    <Button
                      onClick={() => window.location.assign('/pricing')}
                      data-testid="settings-upgrade"
                      className="w-full"
                    >
                      Passer au plan superieur
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Notifications */}
            {activeTab === 'notifications' && (
              <Card data-testid="settings-notifications">
                <CardContent className="space-y-4">
                  <h3 className="text-sm font-semibold text-white mb-2">Notifications email</h3>
                  {[
                    { key: 'welcome' as const, label: 'Emails de bienvenue', desc: 'Recois un email a l\'inscription' },
                    { key: 'digest' as const, label: 'Resume hebdomadaire', desc: 'Recapitulatif chaque lundi' },
                    { key: 'inactivity' as const, label: 'Rappels d\'inactivite', desc: 'Notification apres 7 jours sans activite' },
                    { key: 'tips' as const, label: 'Conseils et astuces', desc: 'Tips pour ameliorer tes videos' },
                    { key: 'contest' as const, label: 'Concours et tirages', desc: 'Notifications des concours et resultats' },
                    { key: 'referral' as const, label: 'Parrainage', desc: 'Alertes commissions et filleuls' },
                  ].map((pref) => (
                    <div
                      key={pref.key}
                      className="flex items-center justify-between py-2"
                    >
                      <div>
                        <p className="text-sm text-white/70">{pref.label}</p>
                        <p className="text-xs text-white/30">{pref.desc}</p>
                      </div>
                      <button
                        onClick={() => toggleEmailPref(pref.key)}
                        data-testid={`toggle-notif-${pref.key}`}
                        className={cn(
                          'relative w-11 h-6 rounded-full transition-colors',
                          emailPrefs[pref.key] ? 'bg-violet-500' : 'bg-white/10'
                        )}
                      >
                        <motion.div
                          animate={{ x: emailPrefs[pref.key] ? 20 : 2 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="absolute top-1 w-4 h-4 rounded-full bg-white"
                        />
                      </button>
                    </div>
                  ))}
                  <Button
                    onClick={saveNotifications}
                    loading={saving}
                    variant="secondary"
                    data-testid="settings-save-notifications"
                  >
                    Sauvegarder les notifications
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Apparence */}
            {activeTab === 'apparence' && (
              <div className="space-y-4">
                <Card data-testid="settings-apparence">
                  <CardContent className="space-y-4">
                    <h3 className="text-sm font-semibold text-white">Theme</h3>
                    <div className="flex gap-3">
                      {[
                        { id: 'dark' as const, label: 'Sombre', icon: Moon },
                        { id: 'light' as const, label: 'Clair', icon: Sun },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setTheme(t.id)}
                          data-testid={`theme-${t.id}`}
                          className={cn(
                            'flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border transition-all',
                            theme === t.id
                              ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                              : 'bg-white/[0.02] border-white/[0.06] text-white/40'
                          )}
                        >
                          <t.icon className="h-4 w-4" />
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="settings-brandkit">
                  <CardContent className="space-y-4">
                    <h3 className="text-sm font-semibold text-white">Brand Kit</h3>
                    <p className="text-xs text-white/30">
                      Configure ton branding pour l&apos;appliquer automatiquement a tes videos.
                    </p>

                    {/* Logo */}
                    <div>
                      <label className="text-xs font-medium text-white/40 mb-2 block">Logo</label>
                      <div
                        onClick={() => logoInputRef.current?.click()}
                        className="h-20 w-20 rounded-xl bg-white/[0.03] border border-dashed border-white/[0.08] flex items-center justify-center cursor-pointer hover:border-white/[0.15] transition-colors overflow-hidden"
                      >
                        {brandLogo ? (
                          <img src={brandLogo} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                          <Upload className="h-5 w-5 text-white/20" />
                        )}
                      </div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            const url = URL.createObjectURL(file)
                            setBrandLogo(url)
                          }
                        }}
                        className="hidden"
                      />
                    </div>

                    {/* Colors */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-white/40 mb-1.5 block">Couleur primaire</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={brandPrimary}
                            onChange={(e) => setBrandPrimary(e.target.value)}
                            data-testid="brand-primary-color"
                            className="h-8 w-8 rounded-lg cursor-pointer bg-transparent border-0"
                          />
                          <span className="text-xs text-white/40 font-mono">{brandPrimary}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-white/40 mb-1.5 block">Couleur secondaire</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={brandSecondary}
                            onChange={(e) => setBrandSecondary(e.target.value)}
                            data-testid="brand-secondary-color"
                            className="h-8 w-8 rounded-lg cursor-pointer bg-transparent border-0"
                          />
                          <span className="text-xs text-white/40 font-mono">{brandSecondary}</span>
                        </div>
                      </div>
                    </div>

                    {/* Font */}
                    <Input
                      label="Police personnalisee"
                      value={brandFont}
                      onChange={(e) => setBrandFont(e.target.value)}
                      placeholder="Ex: Montserrat, Syne..."
                      data-testid="brand-font-input"
                    />

                    <Button onClick={saveBrandKit} loading={saving} data-testid="settings-save-brandkit">
                      Sauvegarder le Brand Kit
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Donnees */}
            {activeTab === 'donnees' && (
              <div className="space-y-4">
                <Card data-testid="settings-donnees">
                  <CardContent className="space-y-4">
                    <h3 className="text-sm font-semibold text-white">Exporter mes donnees</h3>
                    <p className="text-xs text-white/30">
                      Telecharge toutes tes donnees au format JSON (videos, profil, commissions).
                    </p>
                    <Button
                      variant="secondary"
                      onClick={handleExport}
                      loading={exporting}
                      data-testid="settings-export-data"
                    >
                      <Download className="h-4 w-4" />
                      Exporter mes donnees
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-red-500/10">
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                      <h3 className="text-sm font-semibold text-red-400">Zone de danger</h3>
                    </div>
                    <p className="text-xs text-white/30">
                      La suppression de ton compte est irreversible. Toutes tes videos, donnees et commissions seront perdues.
                    </p>
                    <Button
                      variant="danger"
                      onClick={() => setShowDeleteModal(true)}
                      data-testid="settings-delete-account"
                    >
                      <Trash2 className="h-4 w-4" />
                      Supprimer mon compte
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </Tabs>

      {/* Delete confirmation modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Supprimer mon compte"
        data-testid="modal-delete-account"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
            <p className="text-sm text-red-400">
              Cette action est irreversible. Toutes tes donnees seront supprimees definitivement.
            </p>
          </div>
          <Input
            label='Tape "SUPPRIMER" pour confirmer'
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            data-testid="delete-confirm-input"
          />
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
            >
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccount}
              loading={deleting}
              disabled={deleteConfirm !== 'SUPPRIMER'}
              data-testid="delete-confirm-btn"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer definitivement
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  )
}
