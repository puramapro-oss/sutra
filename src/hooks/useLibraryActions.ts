import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { copyToClipboard } from '@/lib/utils'
import type { Video } from '@/types'

export function useLibraryActions() {
  const router = useRouter()

  const handleShare = useCallback(async (videoId: string) => {
    const link = `https://sutra.purama.dev/v/${videoId}`
    await copyToClipboard(link)
    import('sonner').then(({ toast }) => toast.success('Lien copie !'))
  }, [])

  const handleRegenerate = useCallback(
    (video: Video) => {
      const params = new URLSearchParams()
      if (video.script_data?.title) params.set('topic', video.script_data.title)
      if (video.format) params.set('format', video.format)
      if (video.quality) params.set('quality', video.quality)
      router.push(`/create?${params.toString()}`)
    },
    [router]
  )

  return { handleShare, handleRegenerate }
}
