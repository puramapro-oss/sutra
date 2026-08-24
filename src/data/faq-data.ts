export interface FAQItem {
  question: string
  answer: string
  category: string
}

export const faqs: FAQItem[] = [
  {
    category: 'general',
    question: "Qu'est-ce que SUTRA ?",
    answer:
      "SUTRA est une plateforme de generation de videos par intelligence artificielle. Tu donnes un sujet, et notre pipeline IA genere automatiquement le script, la voix off, les visuels, la musique et le montage final. Le resultat : une video prete a publier en quelques minutes.",
  },
  {
    category: 'general',
    question: 'Comment ca marche concretement ?',
    answer:
      "C'est simple : 1) Tu decris ton sujet ou idee. 2) Notre IA genere un script optimise. 3) Une voix off naturelle est creee. 4) Des visuels uniques sont generes pour chaque scene. 5) Une musique originale est composee. 6) Le tout est assemble en une video finale avec sous-titres et transitions professionnelles.",
  },
  {
    category: 'creation',
    question: 'Quelle est la qualite des videos generees ?',
    answer:
      "La qualite depend de ton plan : 720p pour Free et Starter, 1080p pour Createur, et 4K pour Empire. Les visuels sont generes par IA de pointe, les voix sont ultra-realistes, et le montage est professionnel. Tu peux aussi affiner chaque element dans SUTRA Studio.",
  },
  {
    category: 'creation',
    question: 'Combien de temps prend la generation ?',
    answer:
      "La generation complete d'une video prend generalement entre 3 et 8 minutes selon la duree et la complexite. Tu recois une notification des que ta video est prete. Tu peux suivre la progression en temps reel depuis ton dashboard.",
  },
  {
    category: 'creation',
    question: 'Puis-je modifier la video apres generation ?',
    answer:
      "Oui, avec SUTRA Studio (disponible a partir du plan Createur), tu peux modifier le script, changer les visuels scene par scene, ajuster la musique, repositionner les sous-titres, et re-generer des elements individuels. C'est un editeur complet integre.",
  },
  {
    category: 'voix',
    question: 'Les voix sont-elles vraiment realistes ?',
    answer:
      "Oui, nous utilisons la technologie de synthese vocale la plus avancee du marche. Plus de 30 voix naturelles sont disponibles, avec emotions et intonations. A partir du plan Createur, tu peux meme cloner ta propre voix pour un rendu encore plus personnel.",
  },
  {
    category: 'voix',
    question: 'Comment fonctionne le clonage de voix ?',
    answer:
      "Le clonage de voix te permet de creer une replique numerique de ta propre voix. Il suffit de fournir un echantillon audio de quelques minutes. Notre IA analyse ta voix et cree un modele qui peut ensuite lire n'importe quel texte avec ton timbre, ton rythme et tes intonations. Disponible a partir du plan Createur.",
  },
  {
    category: 'abonnement',
    question: 'Combien coute SUTRA ?',
    answer:
      "SUTRA propose un plan gratuit avec 2 videos par mois. Les plans payants : Starter a 9 EUR/mois (10 videos), Createur a 29 EUR/mois (50 videos, le plus populaire), et Empire a 99 EUR/mois (videos illimitees, 4K). -20% avec la facturation annuelle.",
  },
  {
    category: 'abonnement',
    question: 'Puis-je annuler mon abonnement a tout moment ?',
    answer:
      "Absolument. Tu peux annuler ton abonnement a tout moment depuis tes parametres. Aucun engagement, aucun frais cache. Tu conserves l'acces a ton plan jusqu'a la fin de la periode en cours.",
  },
  {
    category: 'abonnement',
    question: 'Comment fonctionne le parrainage ?',
    answer:
      "Le parrainage SUTRA est tres genereux : ton filleul obtient -50% sur son premier mois, tu recois 50% de son premier paiement + 10% recurrent chaque mois tant qu'il est abonne. Tous les 10 filleuls, tu debloques un bonus de 30%. Les gains sont verses sur ton wallet SUTRA et retirables a partir de 50 EUR.",
  },
  {
    category: 'technique',
    question: 'Mes donnees sont-elles protegees ?',
    answer:
      "Oui. SUTRA est conforme au RGPD. Tes donnees sont hebergees en Europe, chiffrees en transit et au repos. Tu peux exporter ou supprimer tes donnees a tout moment depuis tes parametres. Nous ne vendons jamais tes informations personnelles.",
  },
  {
    category: 'technique',
    question: "Qu'est-ce que l'Autopilot ?",
    answer:
      "L'Autopilot te permet de creer des series de videos automatiques. Tu definis un theme, une frequence de publication, et SUTRA genere et publie automatiquement tes videos selon ton calendrier. Ideal pour maintenir une presence constante sans effort. Disponible a partir du plan Createur (1 serie) et Empire (5 series).",
  },
  {
    category: 'abonnement',
    question: 'Comment fonctionne le wallet et les retraits ?',
    answer:
      "Tes gains de parrainage et de concours sont credites automatiquement sur ton wallet SUTRA. Tu peux retirer tes gains a partir de 5 EUR par virement bancaire (IBAN). Les retraits sont traites sous 48 heures ouvrees. Tu consultes ton solde et l'historique complet depuis la page Wallet.",
  },
  {
    category: 'general',
    question: 'Quels formats de video sont disponibles ?',
    answer:
      "SUTRA propose 3 formats : 16:9 (horizontal, ideal pour YouTube), 9:16 (vertical, parfait pour TikTok et Reels Instagram), et 1:1 (carre, pour les fils LinkedIn et Facebook). Tu choisis le format avant la generation, et notre IA adapte automatiquement le cadrage et les sous-titres.",
  },
  {
    category: 'creation',
    question: 'Puis-je utiliser mes propres images ou videos ?',
    answer:
      "Pour le moment, SUTRA genere tous les visuels par IA ou utilise des stocks HD (Pexels). L'import d'images personnalisees sera disponible prochainement. Tu peux cependant influencer le style visuel via le prompt, le choix de niche et les preferences de ton profil.",
  },
  {
    category: 'technique',
    question: 'Comment participer aux concours et au classement ?',
    answer:
      "Chaque utilisateur inscrit recoit automatiquement des places pour le tirage au sort hebdomadaire et mensuel. Plus tu parraines, plus tu as de places. Pour le classement mensuel Purama Impact, tu soumets ta meilleure video creee sur SUTRA. Notre IA l'evalue sur 5 criteres (Amour, Impact, Creativite, Qualite, Inspiration) et le top 10 se partage 3% du CA du mois.",
  },
]
