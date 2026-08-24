export interface PublishVideoPreviewProps {
  videoUrl?: string
}

export function PublishVideoPreview({ videoUrl }: PublishVideoPreviewProps) {
  if (!videoUrl) return null

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-black aspect-video max-h-48 mx-auto">
      <video src={videoUrl} controls className="w-full h-full object-contain" preload="metadata" />
    </div>
  )
}
