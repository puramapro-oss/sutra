import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { VideoQuality, EmailPreferences } from '@/types'
import type { Profile } from '@/types'
import { validateProfileImage } from '@/lib/profile-image'

const supabase = createClient()

export function useSettingsState() {
  const { user, profile, refetch } = useAuth()
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
  const [brandLogoFile, setBrandLogoFile] = useState<File | null>(null)
  const [brandPrimary, setBrandPrimary] = useState('#8b5cf6')
  const [brandSecondary, setBrandSecondary] = useState('#06050e')
  const [brandFont, setBrandFont] = useState('')

  // UI state
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => () => { if (brandLogo.startsWith('blob:')) URL.revokeObjectURL(brandLogo) }, [brandLogo])
  const selectBrandLogo = useCallback(async (file: File) => {
    try {
      await validateProfileImage(file)
      setBrandLogoFile(file)
      setBrandLogo(URL.createObjectURL(file))
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Image non valide.') }
  }, [])

  const uploadImage = useCallback(async (file: File, folder: 'avatars' | 'logos') => {
    if (!profile?.id) throw new Error('SESSION_REQUIRED')
    const { type, extension } = await validateProfileImage(file)
    const path = `${folder}/${profile.id}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage.from('public').upload(path, file, { contentType: type, upsert: false })
    if (error) throw error
    const { data } = supabase.storage.from('public').getPublicUrl(path)
    return data.publicUrl
  }, [profile])

  // Reset the editable fields when a new server snapshot arrives, before
  // rendering a form that could still contain another account's values.
  const [loadedProfile, setLoadedProfile] = useState<Profile | null>(null)
  if (profile && profile !== loadedProfile) {
    setLoadedProfile(profile)
    setName(profile.name ?? '')
    setAvatarUrl(profile.avatar_url ?? '')
    setPreferredNiche(profile.preferred_niche ?? '')
    setPreferredQuality(profile.preferred_quality ?? '1080p')
    setPreferredVoice(profile.preferred_voice_style ?? '')
    setEmailPrefs(profile.email_preferences ?? {
      welcome: true, digest: true, inactivity: true, tips: true, contest: true, referral: true,
    })
    setBrandLogoFile(null)
    setBrandLogo(profile.brand_kit?.logo_url ?? '')
    setBrandPrimary(profile.brand_kit?.colors?.primary ?? '#8b5cf6')
    setBrandSecondary(profile.brand_kit?.colors?.secondary ?? '#06050e')
    setBrandFont(profile.brand_kit?.font ?? '')
  }

  // Save profile
  const saveProfile = useCallback(async () => {
    if (!profile) return
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          name: name.trim() || null,
          preferred_niche: preferredNiche || null,
          preferred_quality: preferredQuality,
          preferred_voice_style: preferredVoice || null,
        })
        .eq('id', profile.id)
        .select('id').single()

      if (error || data?.id !== profile.id) throw error ?? new Error('PROFILE_SAVE_NOT_CONFIRMED')
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
      const publicUrl = await uploadImage(file, 'avatars')
      const { data, error } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id).select('id').single()
      if (error || data?.id !== profile.id) throw error ?? new Error('AVATAR_SAVE_NOT_CONFIRMED')
      setAvatarUrl(publicUrl)
      await refetch()
      toast.success('Avatar mis a jour !')
    } catch {
      toast.error("Erreur lors de l'upload")
    } finally {
      setUploadingAvatar(false)
    }
  }, [profile, refetch, uploadImage])

  // Change password
  const handlePasswordChange = useCallback(async () => {
    const passwordAccount = user?.app_metadata?.providers?.includes('email')
    if (passwordAccount && !currentPassword) { toast.error('Saisis ton mot de passe actuel.'); return }
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
      if (passwordAccount) {
        if (!user?.email) throw new Error('SESSION_REQUIRED')
        const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
        if (error) { toast.error('Le mot de passe actuel n’a pas pu être vérifié.'); return }
      }
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
  }, [newPassword, confirmPassword, currentPassword, user])

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
      let logoUrl = brandLogo
      if (brandLogoFile) {
        logoUrl = await uploadImage(brandLogoFile, 'logos')
        setBrandLogo(logoUrl)
        setBrandLogoFile(null)
      }
      if (logoUrl.startsWith('blob:')) throw new Error('LOGO_NOT_UPLOADED')
      const { data, error } = await supabase
        .from('profiles')
        .update({
          brand_kit: {
            logo_url: logoUrl || undefined,
            colors: { primary: brandPrimary, secondary: brandSecondary },
            font: brandFont || undefined,
          },
        })
        .eq('id', profile.id)
        .select('id').single()

      if (error || data?.id !== profile.id) throw error ?? new Error('BRAND_SAVE_NOT_CONFIRMED')
      await refetch()
      toast.success('Brand Kit sauvegarde !')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }, [profile, brandLogo, brandLogoFile, brandPrimary, brandSecondary, brandFont, uploadImage, refetch])

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
    selectBrandLogo,
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
