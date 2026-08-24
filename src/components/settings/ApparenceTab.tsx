import { Moon, Sun, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const LANGUAGES = [
  { code: 'fr', label: 'Francais' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Espanol' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Portugues' },
  { code: 'ar', label: 'العربية' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ru', label: 'Русский' },
  { code: 'tr', label: 'Turkce' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'sv', label: 'Svenska' },
]

interface ApparenceTabProps {
  theme: 'dark' | 'oled' | 'light'
  setTheme: (theme: 'dark' | 'oled' | 'light') => void
  brandLogo: string
  setBrandLogo: (logo: string) => void
  brandPrimary: string
  setBrandPrimary: (color: string) => void
  brandSecondary: string
  setBrandSecondary: (color: string) => void
  brandFont: string
  setBrandFont: (font: string) => void
  saveBrandKit: () => void
  logoInputRef: React.RefObject<HTMLInputElement | null>
  saving: boolean
}

export default function ApparenceTab({
  theme,
  setTheme,
  brandLogo,
  setBrandLogo,
  brandPrimary,
  setBrandPrimary,
  brandSecondary,
  setBrandSecondary,
  brandFont,
  setBrandFont,
  saveBrandKit,
  logoInputRef,
  saving,
}: ApparenceTabProps) {
  return (
    <div className="space-y-4">
      <Card data-testid="settings-apparence">
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Theme</h3>
          <div className="flex gap-3">
            {[
              { id: 'dark' as const, label: 'Sombre', icon: Moon },
              { id: 'oled' as const, label: 'OLED', icon: Moon },
              { id: 'light' as const, label: 'Clair', icon: Sun },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                data-testid={`theme-${t.id}`}
                className={cn(
                  'flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border transition-all',
                  theme === t.id
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                    : 'bg-white/[0.02] border-white/[0.06] text-white/40'
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="settings-language">
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Langue</h3>
          <select
            data-testid="language-select"
            defaultValue={typeof document !== 'undefined' ? (document.cookie.match(/sutra_locale=([^;]+)/)?.[1] || 'fr') : 'fr'}
            onChange={async (e) => {
              try {
                await fetch('/api/locale', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ locale: e.target.value }),
                })
                window.location.reload()
              } catch {
                toast.error('Erreur lors du changement de langue')
              }
            }}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 outline-none transition-colors appearance-none"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-[#0A0A0F]">
                {lang.label}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card data-testid="settings-brandkit">
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Brand Kit</h3>
          <p className="text-xs text-white/30">
            Configure ton branding pour l&apos;appliquer automatiquement a tes videos.
          </p>

          {/* Logo */}
          <div>
            <label className="text-xs font-medium text-white/40 mb-2 block">Logo</label>
            <div
              onClick={() => logoInputRef.current?.click()}
              className="h-20 w-20 rounded-xl bg-white/[0.03] border border-dashed border-white/[0.08] flex items-center justify-center cursor-pointer hover:border-white/[0.15] transition-colors overflow-hidden"
            >
              {brandLogo ? (
                <img src={brandLogo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Upload className="h-5 w-5 text-white/20" />
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  const url = URL.createObjectURL(file)
                  setBrandLogo(url)
                }
              }}
              className="hidden"
            />
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-white/40 mb-1.5 block">Couleur primaire</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandPrimary}
                  onChange={(e) => setBrandPrimary(e.target.value)}
                  data-testid="brand-primary-color"
                  className="h-8 w-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <span className="text-xs text-white/40 font-mono">{brandPrimary}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-white/40 mb-1.5 block">Couleur secondaire</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandSecondary}
                  onChange={(e) => setBrandSecondary(e.target.value)}
                  data-testid="brand-secondary-color"
                  className="h-8 w-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <span className="text-xs text-white/40 font-mono">{brandSecondary}</span>
              </div>
            </div>
          </div>

          {/* Font */}
          <Input
            label="Police personnalisee"
            value={brandFont}
            onChange={(e) => setBrandFont(e.target.value)}
            placeholder="Ex: Montserrat, Syne..."
            data-testid="brand-font-input"
          />

          <Button onClick={saveBrandKit} loading={saving} data-testid="settings-save-brandkit">
            Sauvegarder le Brand Kit
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
