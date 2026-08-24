'use client'

import { useRouter } from 'next/navigation'
import { Palette, Check } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { Profile } from '@/types'

interface BrandKitTabProps {
  profile: Profile | null
}

export default function BrandKitTab({ profile }: BrandKitTabProps) {
  const router = useRouter()

  return (
    <div data-testid="editor-panel-brandkit" className="space-y-4">
      {profile?.brand_kit ? (
        <>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            {profile.brand_kit.logo_url ? (
              <img
                src={profile.brand_kit.logo_url}
                alt="Logo"
                className="h-10 w-10 rounded-lg object-contain"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Palette className="h-5 w-5 text-violet-400" />
              </div>
            )}
            <div>
              <p className="text-sm text-white/70">Brand Kit actif</p>
              <p className="text-xs text-white/30">
                {profile.brand_kit.font ?? 'Police par defaut'}
              </p>
            </div>
            <Badge variant="success" size="sm" className="ml-auto">
              <Check className="h-3 w-3 mr-1" />
              Applique
            </Badge>
          </div>
          {profile.brand_kit.colors && (
            <div className="flex items-center gap-3">
              <div
                className="h-8 w-8 rounded-lg border border-white/[0.08]"
                style={{ backgroundColor: profile.brand_kit.colors.primary }}
              />
              <div
                className="h-8 w-8 rounded-lg border border-white/[0.08]"
                style={{ backgroundColor: profile.brand_kit.colors.secondary }}
              />
              <span className="text-xs text-white/40">Couleurs de marque</span>
            </div>
          )}
        </>
      ) : (
        <div className="py-8 text-center">
          <Palette className="h-8 w-8 text-white/20 mx-auto mb-3" />
          <p className="text-sm text-white/40 mb-3">Aucun Brand Kit configure</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push('/settings')}
          >
            Configurer dans les reglages
          </Button>
        </div>
      )}
    </div>
  )
}
