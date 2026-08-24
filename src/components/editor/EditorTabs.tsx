'use client'

import {
  GripVertical,
  Trash2,
  Plus,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { Scene, Profile } from '@/types'
import { type SubtitleEntry, type SideTab, SIDE_TABS } from '@/types/editor'
import BrandKitTab from './tabs/BrandKitTab'

interface EditorTabsProps {
  activeTab: SideTab
  onTabChange: (tab: SideTab) => void
  script: string
  onScriptChange: (value: string) => void
  scenes: Scene[]
  dragIndex: number | null
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDragEnd: () => void
  subtitles: SubtitleEntry[]
  onUpdateSubtitle: (id: string, field: 'text' | 'start' | 'end', value: string | number) => void
  onAddSubtitle: () => void
  onRemoveSubtitle: (id: string) => void
  voiceVolume: number
  musicVolume: number
  onVoiceVolumeChange: (v: number) => void
  onMusicVolumeChange: (v: number) => void
  profile: Profile | null
}

export function EditorTabs({
  activeTab,
  onTabChange,
  script,
  onScriptChange,
  scenes,
  dragIndex,
  onDragStart,
  onDragOver,
  onDragEnd,
  subtitles,
  onUpdateSubtitle,
  onAddSubtitle,
  onRemoveSubtitle,
  voiceVolume,
  musicVolume,
  onVoiceVolumeChange,
  onMusicVolumeChange,
  profile,
}: EditorTabsProps) {
  return (
    <div className="lg:col-span-8">
      <Card>
        <div className="flex border-b border-white/[0.06] overflow-x-auto">
          {SIDE_TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                data-testid={`editor-tab-${tab.id}`}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                  activeTab === tab.id
                    ? 'text-violet-400 border-violet-500'
                    : 'text-white/40 border-transparent hover:text-white/60'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <CardContent>
          {/* Script tab */}
          {activeTab === 'script' && (
            <div data-testid="editor-panel-script">
              <label className="text-sm font-medium text-white/60 mb-2 block">
                Narration
              </label>
              <textarea
                value={script}
                onChange={(e) => onScriptChange(e.target.value)}
                rows={12}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/90 placeholder-white/30 outline-none resize-y focus:border-violet-500/60 focus:shadow-[0_0_15px_rgba(139,92,246,0.15)] transition-all"
                placeholder="Ecris ou modifie le script de la narration..."
              />
              <p className="text-xs text-white/30 mt-2">
                {script.split(/\s+/).filter(Boolean).length} mots
              </p>
            </div>
          )}

          {/* Scenes tab */}
          {activeTab === 'scenes' && (
            <div data-testid="editor-panel-scenes" className="space-y-3">
              {scenes.length === 0 ? (
                <div className="py-8 text-center text-sm text-white/30">
                  Aucune scene dans ce projet
                </div>
              ) : (
                scenes.map((scene, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={() => onDragStart(i)}
                    onDragOver={(e) => onDragOver(e, i)}
                    onDragEnd={onDragEnd}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors cursor-grab active:cursor-grabbing group',
                      dragIndex === i && 'opacity-50'
                    )}
                  >
                    <div className="flex items-center gap-2 mt-1">
                      <GripVertical className="h-4 w-4 text-white/20 group-hover:text-white/40" />
                      <div className="h-12 w-16 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-xs text-white/30 font-mono shrink-0">
                        {i + 1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/70 line-clamp-2">
                        {scene.visual_prompt}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-white/30">
                          {scene.duration_seconds}s
                        </span>
                        <Badge variant={scene.use_stock ? 'info' : 'premium'} size="sm">
                          {scene.use_stock ? 'Stock' : 'IA'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Audio tab */}
          {activeTab === 'audio' && (
            <div data-testid="editor-panel-audio" className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-white/60">Volume voix</label>
                  <span className="text-xs text-white/40 font-mono">{voiceVolume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={voiceVolume}
                  onChange={(e) => onVoiceVolumeChange(Number(e.target.value))}
                  data-testid="editor-voice-volume"
                  className="w-full h-2 rounded-full appearance-none bg-white/10 accent-violet-500 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500"
                />
              </div>

              <div className="border-t border-white/[0.06] pt-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-white/60">Volume musique</label>
                  <span className="text-xs text-white/40 font-mono">{musicVolume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={musicVolume}
                  onChange={(e) => onMusicVolumeChange(Number(e.target.value))}
                  data-testid="editor-music-volume"
                  className="w-full h-2 rounded-full appearance-none bg-white/10 accent-violet-500 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500"
                />
              </div>
            </div>
          )}

          {/* Subtitles tab */}
          {activeTab === 'subtitles' && (
            <div data-testid="editor-panel-subtitles" className="space-y-3">
              {subtitles.length === 0 ? (
                <div className="py-8 text-center text-sm text-white/30">
                  Aucun sous-titre
                </div>
              ) : (
                subtitles.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]"
                  >
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <input
                        type="number"
                        value={sub.start}
                        onChange={(e) => onUpdateSubtitle(sub.id, 'start', Number(e.target.value))}
                        step={0.1}
                        min={0}
                        data-testid={`subtitle-start-${sub.id}`}
                        className="w-16 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.06] text-xs text-white/60 font-mono outline-none text-center"
                        title="Debut (s)"
                      />
                      <input
                        type="number"
                        value={sub.end}
                        onChange={(e) => onUpdateSubtitle(sub.id, 'end', Number(e.target.value))}
                        step={0.1}
                        min={0}
                        data-testid={`subtitle-end-${sub.id}`}
                        className="w-16 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.06] text-xs text-white/60 font-mono outline-none text-center"
                        title="Fin (s)"
                      />
                    </div>
                    <textarea
                      value={sub.text}
                      onChange={(e) => onUpdateSubtitle(sub.id, 'text', e.target.value)}
                      rows={2}
                      data-testid={`subtitle-text-${sub.id}`}
                      className="flex-1 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder-white/20 outline-none resize-none focus:border-violet-500/60 transition-colors"
                      placeholder="Texte du sous-titre..."
                    />
                    <button
                      onClick={() => onRemoveSubtitle(sub.id)}
                      data-testid={`subtitle-delete-${sub.id}`}
                      className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
              <button
                onClick={onAddSubtitle}
                data-testid="add-subtitle"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/[0.08] text-sm text-white/40 hover:text-white/60 hover:border-white/[0.15] transition-colors"
              >
                <Plus className="h-4 w-4" />
                Ajouter un sous-titre
              </button>
            </div>
          )}

          {/* Brand Kit tab */}
          {activeTab === 'brandkit' && <BrandKitTab profile={profile} />}
        </CardContent>
      </Card>
    </div>
  )
}
