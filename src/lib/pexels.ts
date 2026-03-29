const PEXELS_API_KEY = process.env.PEXELS_API_KEY!

interface PexelsVideo {
  id: number
  url: string
  width: number
  height: number
  duration: number
  video_files: Array<{
    id: number
    quality: string
    link: string
    width: number
    height: number
  }>
}

export async function searchVideos(
  query: string,
  perPage = 3
): Promise<Array<{ id: number; url: string; duration: number }>> {
  const res = await fetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`,
    {
      headers: { Authorization: PEXELS_API_KEY },
    }
  )

  if (!res.ok) return []
  const data = await res.json()

  return (data.videos ?? []).map((v: PexelsVideo) => {
    const hdFile = v.video_files.find((f) => f.quality === 'hd') ?? v.video_files[0]
    return {
      id: v.id,
      url: hdFile?.link ?? '',
      duration: v.duration,
    }
  })
}

export async function searchImages(
  query: string,
  perPage = 3
): Promise<Array<{ id: number; url: string }>> {
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}`,
    {
      headers: { Authorization: PEXELS_API_KEY },
    }
  )

  if (!res.ok) return []
  const data = await res.json()
  return (data.photos ?? []).map((p: { id: number; src: { large: string } }) => ({
    id: p.id,
    url: p.src.large,
  }))
}
