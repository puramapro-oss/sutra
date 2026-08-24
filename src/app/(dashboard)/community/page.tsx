'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCommunity } from '@/hooks/useCommunity'
import { Skeleton } from '@/components/ui/Skeleton'
import { CommunityTabs, CommunityTab } from '@/components/community/CommunityTabs'
import { CommunityWallTab } from '@/components/community/CommunityWallTab'
import { CommunityCirclesTab } from '@/components/community/CommunityCirclesTab'
import { CommunityBuddyTab } from '@/components/community/CommunityBuddyTab'
import { CommunityMissionsTab } from '@/components/community/CommunityMissionsTab'

export default function CommunityPage() {
  const { profile, loading: authLoading } = useAuth()
  const [tab, setTab] = useState<CommunityTab>('wall')

  const {
    loading,
    posts,
    circles,
    buddy,
    missions,
    posting,
    joiningCircle,
    checkingIn,
    handlePost,
    handleReact,
    handleJoinCircle,
    handleCheckin,
    handleFindBuddy,
  } = useCommunity(profile?.id)

  if (authLoading || loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Heart className="w-7 h-7 text-pink-400" />
          Communaute
        </h1>
        <p className="text-white/50 mt-1">Createurs SUTRA, ensemble on va plus loin</p>
      </div>

      <CommunityTabs activeTab={tab} onTabChange={setTab} />

      {tab === 'wall' && (
        <CommunityWallTab posts={posts} posting={posting} onPost={handlePost} onReact={handleReact} />
      )}

      {tab === 'circles' && (
        <CommunityCirclesTab circles={circles} joiningCircle={joiningCircle} onJoinCircle={handleJoinCircle} />
      )}

      {tab === 'buddy' && (
        <CommunityBuddyTab buddy={buddy} checkingIn={checkingIn} onCheckin={handleCheckin} onFindBuddy={handleFindBuddy} />
      )}

      {tab === 'missions' && <CommunityMissionsTab missions={missions} />}
    </div>
  )
}
