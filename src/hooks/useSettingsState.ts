import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { VideoQuality, EmailPreferences } from '@/types'

const supabase = createClient()

export function useSettingsState() {
  const { profile, refetch } = useAuth()
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
      const { error} = await supabase
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

  return {
    // Profile
    name,
    setName,
    avatarUrl,
    setAvatarUrl,
    preferredNiche,
    setPreferredNiche,
    preferredQuality,
    setPreferredQuality,
    preferredVoice,
    setPreferredVoice,
    saveProfile,
    handleAvatarUpload,
    avatarInputRef,
    uploadingAvatar,
    // Account
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    handlePasswordChange,
    // Notifications
    emailPrefs,
    setEmailPrefs,
    saveNotifications,
    // Brand Kit
    brandLogo,
    setBrandLogo,
    brandPrimary,
    setBrandPrimary,
    brandSecondary,
    setBrandSecondary,
    brandFont,
    setBrandFont,
    saveBrandKit,
    logoInputRef,
    // UI
    saving,
    setSaving,
  }
}
