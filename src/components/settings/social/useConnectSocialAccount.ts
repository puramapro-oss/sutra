import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { toast } from 'sonner'
import { PLATFORM_INFO, type SocialPlatform } from '@/lib/zernio'

export function useConnectSocialAccount(initialError: string | null, disconnectRequest: RefObject<AbortController | null>) {
  const connectRequest = useRef<AbortController | null>(null)
  const [connecting, setConnecting] = useState<SocialPlatform | null>(null)
  const [connectingAccountId, setConnectingAccountId] = useState<string | null>(null)
  const [connectError, setConnectError] = useState<string | null>(initialError)

  useEffect(() => () => { connectRequest.current?.abort(); connectRequest.current = null }, [])

  const handleConnect = useCallback(async (platform: SocialPlatform, accountId?: string) => {
    // React state alone cannot guard two activations in the same event turn.
    if (connectRequest.current || disconnectRequest.current) return
    const controller = new AbortController()
    connectRequest.current = controller
    const current = () => connectRequest.current === controller
    const timeout = setTimeout(() => controller.abort(), 10_000)
    let redirecting = false
    setConnecting(platform)
    setConnectingAccountId(accountId ?? null)
    setConnectError(null)
    try {
      const res = await fetch('/api/social/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, ...(accountId ? { accountId } : {}) }), signal: controller.signal,
      })
      if (!current() || controller.signal.aborted) return
      if (!res.ok) {
        // These statuses are SUTRA's safe contract; never display provider error bodies.
        const message = res.status === 409
          ? 'Déconnexion en cours de vérification. Réessayez plus tard ; si le blocage persiste, contactez votre administrateur.'
          : res.status === 503 ? 'Profil social non attribué. Contactez votre administrateur.'
            : `Connexion ${PLATFORM_INFO[platform].label} indisponible`
        toast.error(message)
        setConnectError(message)
        return
      }
      const data = await res.json()
      if (!current() || controller.signal.aborted) return
      if (!data?.oauthUrl) throw new Error('no_oauth_url')
      window.location.href = data.oauthUrl
      redirecting = true
    } catch {
      if (!current()) return
      const message = controller.signal.aborted
        ? 'Le lien de connexion n’a pas pu être récupéré à temps. Réessaie manuellement.'
        : `Connexion ${PLATFORM_INFO[platform].label} indisponible`
      toast.error(message)
      setConnectError(message)
    } finally {
      clearTimeout(timeout)
      // Hold the guard until navigation; an OAuth redirect must not be duplicated.
      if (current() && !redirecting) {
        connectRequest.current = null
        setConnecting(null)
        setConnectingAccountId(null)
      }
    }
  }, [disconnectRequest])

  return { connecting, connectingAccountId, connectError, connectRequest, handleConnect }
}
