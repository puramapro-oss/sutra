import {
  BookOpen,
  Zap,
  Video,
  Mic,
  CreditCard,
  Shield,
  Wand2,
  Palette,
  Users,
} from 'lucide-react'

export const categories = [
  { id: 'all', label: 'Tout', icon: BookOpen },
  { id: 'general', label: 'General', icon: Zap },
  { id: 'creation', label: 'Creation', icon: Video },
  { id: 'voix', label: 'Voix', icon: Mic },
  { id: 'abonnement', label: 'Abonnement', icon: CreditCard },
  { id: 'technique', label: 'Technique', icon: Shield },
]

export const gettingStartedSteps = [
  {
    icon: Wand2,
    title: 'Cree ton compte',
    description:
      "Inscris-toi gratuitement en quelques secondes. Aucune carte bancaire requise pour le plan Free.",
  },
  {
    icon: Palette,
    title: 'Configure ton profil',
    description:
      "Choisis ta niche, ton style prefere et ta voix. SUTRA s'adapte a tes preferences pour des resultats optimaux.",
  },
  {
    icon: Video,
    title: 'Genere ta premiere video',
    description:
      "Donne un sujet ou une idee, choisis un format, et laisse l'IA faire le reste. Ta video sera prete en quelques minutes.",
  },
  {
    icon: Users,
    title: 'Publie et partage',
    description:
      "Publie directement sur TikTok, YouTube, Instagram depuis SUTRA. Partage ton lien de parrainage pour gagner des commissions.",
  },
]
