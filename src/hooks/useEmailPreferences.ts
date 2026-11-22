import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { normalizeEmailPreferences, saveEmailPreferences } from '@/lib/email-preferences'
import type { EmailPreferences, Profile } from '@/types'

const client = createClient()

export function useEmailPreferences(profile: Profile | null, userId: string | undefined, refetch: () => Promise<unknown>) {
  const ownerId = profile?.id === userId ? userId ?? null : null
  const preferencesKey = JSON.stringify(normalizeEmailPreferences(ownerId ? profile?.email_preferences : null))
  const sourceKey = `${ownerId ?? ''}:${preferencesKey}`
  const [source, setSource] = useState(sourceKey)
  const [emailPrefs, setEmailPrefsState] = useState(() => normalizeEmailPreferences(ownerId ? profile?.email_preferences : null))
  const [savingOwner, setSavingOwner] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ownerId: string; text: string; error: boolean } | null>(null)
  const request = useRef<{ ownerId: string; controller: AbortController } | null>(null)

  if (source !== sourceKey) {
    setSource(sourceKey)
    setEmailPrefsState(normalizeEmailPreferences(ownerId ? profile?.email_preferences : null))
    // A same-account refresh can land after the successful save continuation.
    // Preserve its receipt while discarding every notice from a former owner.
    setNotice(previous => previous?.ownerId === ownerId ? previous : null)
  }
  useEffect(() => () => { request.current?.controller.abort() }, [ownerId])

  const setEmailPrefs = useCallback((update: SetStateAction<EmailPreferences>) => {
    setEmailPrefsState(update)
    setNotice(null)
  }, [])

  const saveNotifications = useCallback(async () => {
    if (!ownerId || (request.current?.ownerId === ownerId && !request.current.controller.signal.aborted)) return
    request.current?.controller.abort()
    const current = { ownerId, controller: new AbortController() }
    request.current = current
    setSavingOwner(ownerId); setNotice(null)
    try {
      const confirmed = await saveEmailPreferences(client, ownerId, emailPrefs, current.controller.signal)
      if (!confirmed || current.controller.signal.aborted) return
      let refreshed = true
      try { await refetch() } catch { refreshed = false }
      if (current.controller.signal.aborted) return
      const text = refreshed ? 'Préférences email enregistrées.'
        : 'Préférences email enregistrées. Le profil ne peut pas encore être actualisé.'
      setNotice({ ownerId, text, error: false }); toast.success(text)
    } catch {
      if (!current.controller.signal.aborted) {
        const text = 'La sauvegarde n’a pas pu être confirmée. Tes choix restent affichés ; réessaie.'
        setNotice({ ownerId, text, error: true }); toast.error(text)
      }
    } finally {
      if (request.current === current) { request.current = null; setSavingOwner(null) }
    }
  }, [ownerId, emailPrefs, refetch])

  return {
    emailPrefs, setEmailPrefs, saveNotifications,
    savingNotifications: Boolean(ownerId && savingOwner === ownerId),
    notificationsAvailable: Boolean(ownerId),
    notificationNotice: notice?.ownerId === ownerId ? notice : null,
  }
}
