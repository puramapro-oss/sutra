# 🎬 SUTRA MODE AUTONOME — BRIEF CLAUDE CODE V1.0

## VISION
SUTRA devient un agent vidéo IA 100% autonome. L'utilisateur configure ses préférences
et SUTRA génère, édite et publie des vidéos automatiquement selon un planning.

Deux modes :
1. **Mode Assisté** (existant) : l'utilisateur demande une vidéo → SUTRA la crée
2. **Mode Autonome** (NOUVEAU) : SUTRA crée et publie tout seul selon un planning

L'agent a une MÉMOIRE : il connaît les préférences, les thèmes passés, ce qui a marché,
et s'améliore au fil du temps.

---

## ARCHITECTURE TECHNIQUE

### Stack existant (ne pas toucher)
- Frontend : sutra.purama.dev (Next.js)
- Vidéo : RunPod WAN 2.2 + LTX-2.3 (fallback)
- Audio : Suno (musique) + ElevenLabs (voix)
- Supabase existant SUTRA

### Ajouts pour le mode autonome
- **Orchestrateur** : n8n workflows
- **Publication** : Zernio API (14 plateformes)
- **Mémoire** : tables Supabase dédiées
- **Notifications** : système partagé agent_notifications (Push PWA + Email)

---

## BASE DE DONNÉES SUPABASE (nouvelles tables)

### Table : `sutra_auto_config`
```sql
CREATE TABLE sutra_auto_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  
  -- Planning de publication
  schedules JSONB NOT NULL DEFAULT '[]',
  -- [{
  --   id: "uuid",
  --   name: "Vidéo fitness lundi",
  --   is_active: true,
  --   frequency: "weekly", -- daily, weekly, biweekly, monthly
  --   days: ["MO"], -- jours de la semaine
  --   time: "10:00", -- heure de publication
  --   timezone: "Europe/Paris"
  -- }]
  
  -- Préférences globales
  default_style TEXT DEFAULT 'cinematic', -- cinematic, anime, realistic, abstract, minimal
  default_duration INTEGER DEFAULT 15, -- secondes
  default_aspect_ratio TEXT DEFAULT '9:16', -- 9:16, 16:9, 1:1
  default_music_genre TEXT DEFAULT 'ambient',
  default_voice_enabled BOOLEAN DEFAULT false,
  default_voice_id TEXT, -- ElevenLabs voice ID
  default_language TEXT DEFAULT 'fr',
  
  -- Publication
  publish_platforms TEXT[] DEFAULT '{youtube_shorts,instagram_reels,tiktok}',
  auto_publish BOOLEAN DEFAULT true, -- false = crée mais ne publie pas sans validation
  require_approval_before_publish BOOLEAN DEFAULT false,
  
  -- Zernio
  zernio_api_key TEXT,
  zernio_connected_platforms JSONB, -- [{platform, account_id, username}]
  
  -- Branding
  watermark_url TEXT,
  intro_clip_url TEXT,
  outro_clip_url TEXT,
  brand_colors JSONB, -- {primary, secondary, accent}
  brand_font TEXT,
  
  -- Qualité
  preferred_model TEXT DEFAULT 'wan-2.2', -- wan-2.2, ltx-2.3-pro, ltx-2.3-fast
  quality_level TEXT DEFAULT 'high', -- draft, standard, high, ultra
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Table : `sutra_auto_themes`
```sql
CREATE TABLE sutra_auto_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_id TEXT, -- lié à un schedule spécifique ou null = global
  
  theme TEXT NOT NULL, -- "fitness motivation", "crypto trading tips", "nature relaxation"
  description TEXT, -- description détaillée pour guider l'IA
  example_prompts TEXT[], -- exemples de prompts qui marchent bien
  
  -- Contraintes
  must_include TEXT[], -- éléments à toujours inclure
  never_include TEXT[], -- éléments à ne jamais inclure
  target_audience TEXT, -- "hommes 25-35 sportifs"
  tone TEXT, -- "motivant", "calme", "éducatif", "fun"
  
  -- Rotation
  weight INTEGER DEFAULT 1, -- poids dans la rotation (plus haut = plus fréquent)
  last_used_at TIMESTAMPTZ,
  times_used INTEGER DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Table : `sutra_auto_memory`
```sql
CREATE TABLE sutra_auto_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Ce que l'IA retient
  memory_type TEXT NOT NULL, -- 'preference', 'performance', 'feedback', 'trend', 'learning'
  content TEXT NOT NULL,
  importance FLOAT DEFAULT 0.5, -- 0-1
  
  -- Contexte
  related_video_id UUID,
  related_theme TEXT,
  related_platform TEXT,
  
  -- Expiration
  expires_at TIMESTAMPTZ, -- certaines mémoires sont temporaires (trends)
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Table : `sutra_auto_videos`
```sql
CREATE TABLE sutra_auto_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_id TEXT,
  theme_id UUID REFERENCES sutra_auto_themes(id),
  
  -- Génération
  status TEXT DEFAULT 'planning',
  -- planning → generating_script → generating_video → generating_audio → 
  -- compositing → ready → pending_approval → publishing → published → failed
  
  -- Contenu décidé par l'IA
  title TEXT,
  description TEXT,
  hashtags TEXT[],
  script TEXT, -- script narratif si voix
  prompt_used TEXT, -- prompt exact envoyé au modèle vidéo
  music_prompt TEXT,
  
  -- Fichiers
  video_raw_url TEXT, -- vidéo brute (RunPod/LTX)
  audio_music_url TEXT, -- musique (Suno)
  audio_voice_url TEXT, -- voix (ElevenLabs)
  video_final_url TEXT, -- vidéo finale composée
  thumbnail_url TEXT,
  
  -- Publication
  published_at TIMESTAMPTZ,
  published_platforms JSONB, -- [{platform, post_id, post_url}]
  zernio_job_id TEXT,
  
  -- Performance (rempli par scraping ou Zernio stats)
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2),
  
  -- IA
  ai_reasoning TEXT, -- pourquoi l'IA a choisi ce contenu
  ai_confidence FLOAT,
  user_rating INTEGER, -- 1-5 noté par l'utilisateur après publication
  user_feedback TEXT,
  
  -- Timing
  scheduled_for TIMESTAMPTZ,
  generation_started_at TIMESTAMPTZ,
  generation_completed_at TIMESTAMPTZ,
  generation_duration_seconds INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## WORKFLOWS N8N

### Workflow 1 : "SUTRA Auto - Plan & Generate" (CRON toutes les heures)
```
[CRON toutes les heures]
→ Fetch schedules actifs où prochaine publication dans les 3 prochaines heures
  (on génère EN AVANCE pour avoir le temps de produire)
→ Pour chaque vidéo à générer :
  → Claude API : planifier le contenu
    System: """
    Tu es le directeur créatif de SUTRA, un studio vidéo IA.
    
    Mémoire de l'utilisateur : {{memories}}
    Thèmes configurés : {{themes}}
    Dernières vidéos (éviter répétition) : {{recent_videos}}
    Performances passées (s'inspirer de ce qui marche) : {{top_performing}}
    Tendances actuelles : {{trends}}
    
    Crée le plan pour la prochaine vidéo :
    {
      "title": "titre accrocheur",
      "description": "description pour les réseaux sociaux",
      "hashtags": ["#tag1", "#tag2"],
      "video_prompt": "prompt détaillé pour le modèle de génération vidéo",
      "music_prompt": "description de la musique souhaitée",
      "script": "script voix-off si voice_enabled (null sinon)",
      "style": "style visuel choisi",
      "reasoning": "pourquoi j'ai fait ces choix",
      "theme_used": "theme_id"
    }
    """
  → Insert dans sutra_auto_videos (status: generating_video)
  
  → RunPod API / LTX API : générer la vidéo
  → Suno API : générer la musique
  → ElevenLabs API : générer la voix (si activé)
  
  → FFmpeg (sur VPS) : composer vidéo + audio + watermark + intro/outro
  → Upload vers Supabase Storage
  → Update status → 'ready'
  
  → Si require_approval :
    → Notification : "Vidéo prête ! [Voir preview] [Publier] [Refaire]"
  → Sinon :
    → Déclencher Workflow 2
```

### Workflow 2 : "SUTRA Auto - Publish" (Webhook ou suite de Workflow 1)
```
[Trigger : vidéo approuvée ou auto_publish=true]
→ Zernio API : publier sur toutes les plateformes configurées
  POST /api/v1/posts
  {
    "platforms": {{publish_platforms}},
    "content": {
      "title": {{title}},
      "description": {{description}},
      "hashtags": {{hashtags}},
      "video_url": {{video_final_url}},
      "thumbnail_url": {{thumbnail_url}}
    },
    "schedule": {{scheduled_for}} // ou null pour immédiat
  }
→ Update status → 'published'
→ Store platform post IDs
→ Notification : "Vidéo publiée sur {{platforms}} ! 🎬"
→ Update theme last_used_at + times_used
→ Créer mémoire : "Vidéo sur {{theme}} publiée, prompt: {{prompt}}"
```

### Workflow 3 : "SUTRA Auto - Learn & Improve" (CRON quotidien)
```
[CRON tous les jours à 22h]
→ Pour chaque user :
  → Fetch vidéos publiées dans les dernières 48h
  → Zernio API / scraping : récupérer stats (vues, likes, comments)
  → Update sutra_auto_videos avec les stats
  → Claude API : analyser les performances
    System: "Analyse les performances des dernières vidéos.
    Compare avec l'historique. Identifie les patterns :
    - Quels thèmes marchent le mieux ?
    - Quels styles visuels performent ?
    - Quels horaires de publication sont optimaux ?
    - Quels hashtags génèrent le plus d'engagement ?
    Retourne des insights et recommandations."
  → Insérer dans sutra_auto_memory (type: 'performance' + 'learning')
  → Les prochaines vidéos utiliseront ces insights
```

### Workflow 4 : "SUTRA Auto - Trend Watcher" (CRON quotidien)
```
[CRON tous les jours à 6h]
→ Tavily API : chercher tendances dans les niches des users
→ Claude API : identifier ce qui trend et comment l'adapter
→ Insérer dans sutra_auto_memory (type: 'trend', expires_at: +7 jours)
→ Les prochaines vidéos pourront surfer sur les trends
```

---

## PAGES FRONTEND (dans SUTRA)

### `/auto` — Dashboard mode autonome
- **Toggle ON/OFF** mode autonome
- **Calendrier visuel** : vidéos planifiées + publiées (vue semaine/mois)
- **Prochaine vidéo** : preview + countdown
- **Stats globales** : vidéos générées, vues totales, engagement moyen
- **Feed** : dernières vidéos publiées avec stats

### `/auto/schedules`
- Créer/éditer des plannings de publication
- Fréquence : quotidien, hebdo, bi-hebdo, mensuel
- Jours et heures
- Thèmes associés à chaque planning

### `/auto/themes`
- Gérer les thèmes de contenu
- Pour chaque thème : description, exemples, contraintes, poids de rotation
- "Ajouter un thème" avec assistant IA

### `/auto/memory`
- Voir ce que l'IA a appris
- Insights de performance
- Tendances détectées
- L'utilisateur peut ajouter/supprimer des mémoires manuellement

### `/auto/videos`
- Galerie de toutes les vidéos générées
- Statut de chaque vidéo
- Stats par vidéo
- Bouton [Publier] [Refaire] [Supprimer]
- Noter les vidéos (1-5 étoiles) pour le feedback loop

### `/auto/settings`
- Style par défaut
- Durée, ratio, qualité
- Plateformes de publication
- Branding (watermark, intro, outro, couleurs)
- Modèle préféré (WAN 2.2 vs LTX)
- Connexion Zernio
- Approbation requise ON/OFF

---

## PROMPT SYSTÈME CLAUDE API (directeur créatif)

```xml
<s>
Tu es le directeur créatif IA de SUTRA, le studio vidéo le plus avancé au monde.

<mission>
Créer du contenu vidéo viral, unique et captivant qui surpasse tout ce qui existe.
Chaque vidéo doit arrêter le scroll en moins de 0.5 seconde.
</mission>

<memoire_utilisateur>
{{user_memories}}
</memoire_utilisateur>

<preferences>
Style : {{default_style}}
Durée : {{default_duration}}s
Format : {{default_aspect_ratio}}
Musique : {{default_music_genre}}
Langue : {{default_language}}
</preferences>

<themes_disponibles>
{{themes_json}}
</themes_disponibles>

<historique_recent>
Dernières 10 vidéos (éviter répétition) : {{recent_videos}}
Top 5 meilleures performances : {{top_videos}}
</historique_recent>

<tendances_actuelles>
{{current_trends}}
</tendances_actuelles>

<insights_performance>
{{performance_insights}}
</insights_performance>

<regles>
1. JAMAIS deux vidéos identiques — toujours innover
2. Utiliser les insights de performance pour optimiser
3. Surfer sur les tendances quand pertinent
4. Le prompt vidéo doit être ultra-détaillé et cinématique
5. Les titres doivent être irrésistibles
6. Les hashtags doivent maximiser la découvrabilité
7. Respecter les contraintes des thèmes (must_include, never_include)
8. Varier les thèmes selon les poids de rotation
</regles>

<format_reponse>
Retourne UNIQUEMENT un JSON valide :
{
  "title": "titre accrocheur (max 60 chars)",
  "description": "description engageante avec CTA (max 300 chars)",
  "hashtags": ["#tag1", "#tag2", "..."], // 10-15 hashtags
  "video_prompt": "prompt ultra-détaillé pour génération vidéo...",
  "music_prompt": "description ambiance musicale",
  "script": "texte voix-off si activé, null sinon",
  "style_override": "style si différent du défaut, null sinon",
  "theme_id": "uuid du thème utilisé",
  "reasoning": "pourquoi ces choix créatifs",
  "expected_engagement": "high|medium|low",
  "trend_leveraged": "nom de la tendance utilisée ou null"
}
</format_reponse>
</s>
```

---

## ENV VARS SUTRA (à ajouter)

```
# Existantes
RUNPOD_API_KEY=<existant>
SUNO_API_KEY=<existant>
ELEVENLABS_API_KEY=<existant>
LTX_API_KEY=<existant>

# Nouvelles
ZERNIO_API_KEY=sk_e95ed9fb3d9daea6de54cc054e62296db591ad9de634a24d9856099c2528f1d9
TAVILY_API_KEY=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
VAPID_PUBLIC_KEY=<partagé>
VAPID_PRIVATE_KEY=<partagé>
```

---

## CRITÈRES DE SUCCÈS

- [ ] Vidéos générées automatiquement selon planning
- [ ] Publication auto sur 14 plateformes via Zernio
- [ ] Mémoire qui s'améliore (feedback loop)
- [ ] 0 intervention humaine en mode full-auto
- [ ] Qualité visuelle professionnelle
- [ ] Contenu varié (jamais de répétition)
- [ ] Trends détectées et exploitées
- [ ] Stats de performance trackées
- [ ] Tout configurable par l'utilisateur
- [ ] Preview + approbation optionnelle avant publication
