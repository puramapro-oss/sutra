import { Video, Zap, CreditCard, Users, Shield } from 'lucide-react'

export interface FAQItem {
  question: string
  answer: string
  icon: React.ComponentType<{ className?: string }>
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export const faqs: FAQItem[] = [
  {
    icon: Video,
    question: "Comment generer ma premiere video ?",
    answer: "Clique sur 'Creer' dans le menu, decris ton sujet, et SUTRA genere automatiquement le script, la voix, les visuels et le montage. En quelques minutes, ta video est prete.",
  },
  {
    icon: Zap,
    question: "Quelle est la difference entre les plans ?",
    answer: "Free : 2 videos/mois en 720p. Starter : 10 videos en 720p. Createur : 50 videos en 1080p avec voix et autopilot. Empire : videos illimitees en 4K avec toutes les fonctionnalites.",
  },
  {
    icon: CreditCard,
    question: "Comment fonctionne le systeme de points ?",
    answer: "Tu gagnes des points en creant du contenu, en parrainant, en completant des achievements et en ouvrant ton coffre quotidien. Les points peuvent etre echanges contre des reductions, des abonnements ou convertis en euros.",
  },
  {
    icon: Users,
    question: "Comment fonctionne le parrainage ?",
    answer: "Partage ton lien de parrainage. Tu recois une commission sur chaque abonnement de tes filleuls. Les paliers vont de Bronze (10 filleuls) a Legende (100+) avec des avantages croissants.",
  },
  {
    icon: Shield,
    question: "Mes donnees sont-elles protegees ?",
    answer: "Oui. SUTRA est conforme RGPD. Tes videos et donnees sont chiffrees. Tu peux exporter ou supprimer tes donnees a tout moment depuis les parametres.",
  },
  {
    icon: Video,
    question: "Puis-je personnaliser les voix ?",
    answer: "Oui ! Avec le plan Createur ou Empire, tu as acces a plusieurs voix francaises naturelles et tu peux meme cloner ta propre voix pour un rendu unique.",
  },
]
