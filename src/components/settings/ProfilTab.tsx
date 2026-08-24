import { User, Camera, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { NICHES, VOICE_STYLES } from '@/lib/constants'
import type { VideoQuality, Profile } from '@/types'

const QUALITY_OPTIONS: { value: VideoQuality; label: string }[] = [
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: '4k', label: '4K' },
]

interface ProfilTabProps {
  profile: Profile | null
  name: string
  setName: (name: string) => void
  avatarUrl: string
  preferredNiche: string
  setPreferredNiche: (niche: string) => void
  preferredQuality: VideoQuality
  setPreferredQuality: (quality: VideoQuality) => void
  preferredVoice: string
  setPreferredVoice: (voice: string) => void
  saveProfile: () => void
  handleAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  avatarInputRef: React.RefObject<HTMLInputElement | null>
  uploadingAvatar: boolean
  saving: boolean
}

export default function ProfilTab({
  profile,
  name,
  setName,
  avatarUrl,
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
  saving,
}: ProfilTabProps) {
  return (
    <Card data-testid="settings-profil">
      <CardContent className="space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="h-16 w-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="h-7 w-7 text-violet-400" />
              )}
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              data-testid="settings-avatar-upload"
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
            >
              {uploadingAvatar ? (
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div>
            <p className="text-sm text-white/70">{profile?.name ?? 'Utilisateur'}</p>
            <p className="text-xs text-white/30">{profile?.email}</p>
          </div>
        </div>

        <Input
          label="Nom complet"
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="settings-name-input"
        />

        {/* Preferred niche */}
        <div>
          <label className="text-sm font-medium text-white/60 mb-2 block">Niche preferee</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {NICHES.map((niche) => (
              <button
                key={niche}
                onClick={() => setPreferredNiche(niche)}
                data-testid={`settings-niche-${niche}`}
                className={cn(
                  'px-3 py-2 rounded-xl text-xs font-medium border transition-all capitalize',
                  preferredNiche === niche
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                    : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/60'
                )}
              >
                {niche.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Quality */}
        <div>
          <label className="text-sm font-medium text-white/60 mb-2 block">Qualite preferee</label>
          <div className="flex gap-2">
            {QUALITY_OPTIONS.map((q) => (
              <button
                key={q.value}
                onClick={() => setPreferredQuality(q.value)}
                data-testid={`settings-quality-${q.value}`}
                className={cn(
                  'flex-1 px-3 py-2.5 rounded-xl text-sm border transition-all',
                  preferredQuality === q.value
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                    : 'bg-white/[0.02] border-white/[0.06] text-white/40'
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Voice */}
        <div>
          <label className="text-sm font-medium text-white/60 mb-2 block">Voix preferee</label>
          <select
            value={preferredVoice}
            onChange={(e) => setPreferredVoice(e.target.value)}
            data-testid="settings-voice-select"
            className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 outline-none appearance-none cursor-pointer"
          >
            <option value="" className="bg-[#0c0b14]">Aucune preference</option>
            {VOICE_STYLES.map((v) => (
              <option key={v.id} value={v.id} className="bg-[#0c0b14]">
                {v.name} ({v.gender === 'male' ? 'Homme' : 'Femme'})
              </option>
            ))}
          </select>
        </div>

        <Button onClick={saveProfile} loading={saving} data-testid="settings-save-profil">
          Sauvegarder le profil
        </Button>
      </CardContent>
    </Card>
  )
}
