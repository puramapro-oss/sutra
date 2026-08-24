'use client'

import { useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  User,
  CreditCard,
  Bell,
  Palette,
  Database,
  Lock,
  Share2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useSettingsState } from '@/hooks/useSettingsState'
import { PLAN_LIMITS } from '@/lib/constants'
import { Skeleton } from '@/components/ui/Skeleton'
import { Tabs } from '@/components/ui/Tabs'
import ProfilTab from '@/components/settings/ProfilTab'
import CompteTab from '@/components/settings/CompteTab'
import AbonnementTab from '@/components/settings/AbonnementTab'
import ReseauxTab from '@/components/settings/ReseauxTab'
import NotificationsTab from '@/components/settings/NotificationsTab'
import ApparenceTab from '@/components/settings/ApparenceTab'
import DonneesTab from '@/components/settings/DonneesTab'
import type { Plan, EmailPreferences } from '@/types'

const SETTINGS_TABS = [
  { id: 'profil', label: 'Profil', icon: <User className="h-4 w-4" /> },
  { id: 'compte', label: 'Compte', icon: <Lock className="h-4 w-4" /> },
  { id: 'abonnement', label: 'Abonnement', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'reseaux', label: 'Reseaux sociaux', icon: <Share2 className="h-4 w-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  { id: 'apparence', label: 'Apparence', icon: <Palette className="h-4 w-4" /> },
  { id: 'donnees', label: 'Donnees', icon: <Database className="h-4 w-4" /> },
]

export default function SettingsPage() {
  const { profile, plan, loading: authLoading } = useAuth()
  const { theme, setTheme } = useTheme()
  const settingsState = useSettingsState()

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

  const toggleEmailPref = useCallback((key: keyof EmailPreferences) => {
    settingsState.setEmailPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [settingsState])

  const limits = PLAN_LIMITS[plan]
  const planLabels: Record<Plan, string> = {
    free: 'Gratuit',
    starter: 'Starter',
    creator: 'Creator',
    empire: 'Empire',
    enterprise: 'Enterprise',
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
            {activeTab === 'profil' && (
              <ProfilTab
                profile={profile}
                name={settingsState.name}
                setName={settingsState.setName}
                avatarUrl={settingsState.avatarUrl}
                preferredNiche={settingsState.preferredNiche}
                setPreferredNiche={settingsState.setPreferredNiche}
                preferredQuality={settingsState.preferredQuality}
                setPreferredQuality={settingsState.setPreferredQuality}
                preferredVoice={settingsState.preferredVoice}
                setPreferredVoice={settingsState.setPreferredVoice}
                saveProfile={settingsState.saveProfile}
                handleAvatarUpload={settingsState.handleAvatarUpload}
                avatarInputRef={settingsState.avatarInputRef}
                uploadingAvatar={settingsState.uploadingAvatar}
                saving={settingsState.saving}
              />
            )}

            {activeTab === 'compte' && (
              <CompteTab
                profile={profile}
                currentPassword={settingsState.currentPassword}
                setCurrentPassword={settingsState.setCurrentPassword}
                newPassword={settingsState.newPassword}
                setNewPassword={settingsState.setNewPassword}
                confirmPassword={settingsState.confirmPassword}
                setConfirmPassword={settingsState.setConfirmPassword}
                handlePasswordChange={settingsState.handlePasswordChange}
                saving={settingsState.saving}
              />
            )}

            {activeTab === 'abonnement' && (
              <AbonnementTab
                plan={plan}
                planLabel={planLabels[plan]}
                limits={limits}
                profile={profile}
                openBillingPortal={openBillingPortal}
              />
            )}

            {activeTab === 'reseaux' && <ReseauxTab />}

            {activeTab === 'notifications' && (
              <NotificationsTab
                emailPrefs={settingsState.emailPrefs}
                toggleEmailPref={toggleEmailPref}
                saveNotifications={settingsState.saveNotifications}
                saving={settingsState.saving}
              />
            )}

            {activeTab === 'apparence' && (
              <ApparenceTab
                theme={theme}
                setTheme={setTheme}
                brandLogo={settingsState.brandLogo}
                setBrandLogo={settingsState.setBrandLogo}
                brandPrimary={settingsState.brandPrimary}
                setBrandPrimary={settingsState.setBrandPrimary}
                brandSecondary={settingsState.brandSecondary}
                setBrandSecondary={settingsState.setBrandSecondary}
                brandFont={settingsState.brandFont}
                setBrandFont={settingsState.setBrandFont}
                saveBrandKit={settingsState.saveBrandKit}
                logoInputRef={settingsState.logoInputRef}
                saving={settingsState.saving}
              />
            )}

            {activeTab === 'donnees' && <DonneesTab />}
          </>
        )}
      </Tabs>
    </motion.div>
  )
}
