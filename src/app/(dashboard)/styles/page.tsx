'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Sparkles, X, Info, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { VISUAL_STYLES, type VisualStyle } from '@/lib/styles'

const STORAGE_KEY = 'sutra_selected_style'

function getPreviewUrl(preview: string): string {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(preview)}?width=512&height=288&model=flux&enhance=true&nologo=true`
}

export default function StylesPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      setSelectedStyle(stored)
    }
  }, [])

  const handleSelectStyle = (style: VisualStyle) => {
    localStorage.setItem(STORAGE_KEY, style.id)
    setSelectedStyle(style.id)
    router.push(`/create?style=${style.id}`)
  }

  const handleClearStyle = () => {
    localStorage.removeItem(STORAGE_KEY)
    setSelectedStyle(null)
  }

  const activeStyle = VISUAL_STYLES.find((s) => s.id === selectedStyle)

  if (!mounted) return null

  return (
    <div className="min-h-dvh p-4 md:p-8 max-w-7xl mx-auto" data-testid="styles-page">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-7 h-7 text-violet-400" />
          <h1 className="text-2xl md:text-3xl font-display font-bold text-white">
            Styles IA
          </h1>
        </div>
        <p className="text-white/50 text-sm md:text-base">
          Applique un style visuel unique à tes vidéos
        </p>
      </motion.div>

      {/* Active style banner */}
      {activeStyle && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center justify-between bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3"
          data-testid="active-style-banner"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{activeStyle.icon}</span>
            <span className="text-sm text-white/80">
              Style actif : <span className="text-violet-300 font-medium">{activeStyle.name}</span>
            </span>
          </div>
          <button
            onClick={handleClearStyle}
            className="text-white/40 hover:text-white/80 transition-colors p-1 rounded-lg hover:bg-white/5"
            data-testid="clear-style-btn"
            aria-label="Supprimer le style actif"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Styles grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
        {VISUAL_STYLES.map((style, index) => {
          const isActive = selectedStyle === style.id
          return (
            <motion.div
              key={style.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className={cn(
                'group relative rounded-xl overflow-hidden border transition-all duration-300 cursor-pointer',
                isActive
                  ? 'border-violet-500/50 shadow-lg shadow-violet-500/20'
                  : 'border-white/[0.06] hover:border-white/[0.12]'
              )}
              data-testid={`style-card-${style.id}`}
              onClick={() => handleSelectStyle(style)}
            >
              {/* Preview image */}
              <div className="relative aspect-video bg-white/[0.02] overflow-hidden">
                <Image
                  src={getPreviewUrl(style.preview)}
                  alt={style.name}
                  width={512}
                  height={288}
                  unoptimized
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Gradient overlay */}
                <div className={cn(
                  'absolute inset-0 bg-gradient-to-t from-[#0A0A0F] via-transparent to-transparent opacity-80'
                )} />
                {/* Colored glow on hover */}
                <div className={cn(
                  'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-30 transition-opacity duration-300',
                  style.color
                )} />
                {/* Active badge */}
                {isActive && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="premium" size="sm">Actif</Badge>
                  </div>
                )}
              </div>

              {/* Card content */}
              <div className="p-4 bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-lg">{style.icon}</span>
                  <h3 className="text-sm font-semibold text-white">{style.name}</h3>
                </div>
                <p className="text-xs text-white/40 leading-relaxed mb-3 line-clamp-2">
                  {style.description}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full group/btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectStyle(style)
                  }}
                  data-testid={`use-style-${style.id}`}
                >
                  <span>Utiliser ce style</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform group-hover/btn:translate-x-0.5" />
                </Button>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Info section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-10 flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 md:p-5"
        data-testid="styles-info"
      >
        <Info className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-medium text-white/80 mb-1">
            Comment fonctionnent les styles ?
          </h4>
          <p className="text-xs text-white/40 leading-relaxed">
            Chaque style modifie le prompt visuel envoyé au moteur de génération LTX 2.3.
            Les instructions stylistiques sont ajoutées automatiquement à ta description pour
            orienter le rendu final. Tu peux combiner un style avec n&apos;importe quel prompt
            personnalisé pour obtenir des résultats uniques.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
