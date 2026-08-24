import Link from 'next/link'
import { Share2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export default function ReseauxTab() {
  return (
    <Card data-testid="settings-reseaux">
      <CardContent className="space-y-4">
        <h3 className="text-sm font-semibold text-white mb-2">Publication sociale automatique</h3>
        <p className="text-sm text-white/60">
          Connecte tes 14 reseaux (TikTok, YouTube, Instagram, Facebook, X, LinkedIn, Pinterest, Reddit, Threads, Snapchat, Tumblr, Mastodon, Bluesky, Vimeo) et configure l&apos;autopilot IA.
        </p>
        <Link href="/settings/social" data-testid="link-social-settings">
          <Button variant="primary" size="md">
            <Share2 className="h-4 w-4" />
            Gerer mes reseaux sociaux
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
