export interface AchievementDef {
  id: string
  name: string
  description: string
  icon: string
  xp: number
  points: number
  condition: (stats: UserStats) => boolean
}

export interface UserStats {
  videoCount: number
  referralCount: number
  streak: number
  walletBalance: number
  level: number
  puramaPoints: number
  lifetimeEarned: number
  dailyGiftStreak: number
  loginDays: number
  sharesCount: number
  credits: number
  plan: string
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_video',
    name: 'Premiere Scene',
    description: 'Cree ta premiere video avec SUTRA',
    icon: 'film',
    xp: 50,
    points: 100,
    condition: (s) => s.videoCount >= 1,
  },
  {
    id: 'five_videos',
    name: 'Realisateur en Herbe',
    description: 'Cree 5 videos',
    icon: 'clapperboard',
    xp: 100,
    points: 200,
    condition: (s) => s.videoCount >= 5,
  },
  {
    id: 'twenty_videos',
    name: 'Producteur Confirme',
    description: 'Cree 20 videos',
    icon: 'award',
    xp: 250,
    points: 500,
    condition: (s) => s.videoCount >= 20,
  },
  {
    id: 'fifty_videos',
    name: 'Studio Hollywoodien',
    description: 'Cree 50 videos',
    icon: 'star',
    xp: 500,
    points: 500,
    condition: (s) => s.videoCount >= 50,
  },
  {
    id: 'first_referral',
    name: 'Ambassadeur',
    description: 'Parraine ton premier ami',
    icon: 'users',
    xp: 100,
    points: 200,
    condition: (s) => s.referralCount >= 1,
  },
  {
    id: 'ten_referrals',
    name: 'Ambassadeur Bronze',
    description: 'Parraine 10 personnes',
    icon: 'user-plus',
    xp: 250,
    points: 300,
    condition: (s) => s.referralCount >= 10,
  },
  {
    id: 'streak_7',
    name: 'Semaine de Feu',
    description: 'Maintiens un streak de 7 jours',
    icon: 'flame',
    xp: 75,
    points: 150,
    condition: (s) => s.streak >= 7,
  },
  {
    id: 'streak_30',
    name: 'Mois Legendaire',
    description: 'Maintiens un streak de 30 jours',
    icon: 'zap',
    xp: 300,
    points: 500,
    condition: (s) => s.streak >= 30,
  },
  {
    id: 'streak_100',
    name: 'Centurion',
    description: 'Maintiens un streak de 100 jours',
    icon: 'crown',
    xp: 1000,
    points: 500,
    condition: (s) => s.streak >= 100,
  },
  {
    id: 'first_wallet',
    name: 'Premier Euro',
    description: 'Gagne ton premier euro dans le wallet',
    icon: 'wallet',
    xp: 100,
    points: 100,
    condition: (s) => s.walletBalance >= 1,
  },
  {
    id: 'level_5',
    name: 'Apprenti Cineaste',
    description: 'Atteins le niveau 5',
    icon: 'trending-up',
    xp: 150,
    points: 200,
    condition: (s) => s.level >= 5,
  },
  {
    id: 'level_10',
    name: 'Expert du Montage',
    description: 'Atteins le niveau 10',
    icon: 'trophy',
    xp: 300,
    points: 300,
    condition: (s) => s.level >= 10,
  },
  {
    id: 'points_1000',
    name: 'Collectionneur',
    description: 'Accumule 1000 points au total',
    icon: 'coins',
    xp: 100,
    points: 50,
    condition: (s) => s.lifetimeEarned >= 1000,
  },
  {
    id: 'premium_member',
    name: 'Membre Premium',
    description: 'Passe a un abonnement payant',
    icon: 'sparkles',
    xp: 200,
    points: 300,
    condition: (s) => s.plan !== 'free' && s.plan !== '',
  },
  {
    id: 'first_share',
    name: 'Connecte',
    description: 'Partage SUTRA avec tes amis',
    icon: 'share-2',
    xp: 50,
    points: 100,
    condition: (s) => s.sharesCount >= 1,
  },
]
