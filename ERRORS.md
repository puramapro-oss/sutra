# ERRORS.md — SUTRA

## État actuel ESLint max-lines

**Total**: 19 erreurs "File has too many lines (Maximum allowed is 300)"

### Fichiers à traiter (6 restants, triés par taille croissante)

1. **admin/page.tsx** — 495L (besoin -195L)
2. **PublishEverywhereButton.tsx** — 643L (besoin -343L)  
3. **settings/social/page.tsx** — 676L (besoin -376L)
4. **financer/page.tsx** — 724L (besoin -424L)
5. **help/page.tsx** — 727L (besoin -427L)
6. **templates/page.tsx** — 925L (besoin -625L)

### Fichiers exclus (non modifiables selon instruction)

- `api/stripe/webhook/route.ts`
- `api/internal/stripe-fulfillment/route.ts`

### Fichiers corrigés cette session

- ✅ **autopilot/page.tsx** : 499L → ~260L (extraction AutopilotUpgradePrompt, AutopilotSeriesForm, AutopilotSeriesCard)
- ✅ **contest/page.tsx** : 541L → ~230L (extraction ContestBanner, ContestSubmissionForm, ContestLeaderboard, PastContestsSection, HallOfFame + useCountdown hook)
- 🟡 **admin/page.tsx** : 541L → 495L (extraction partielle GoldCard, StationHeader, StatSkeleton)

### Stratégie extraction réussie

Pattern qui a marché:
1. Créer répertoire `src/components/{feature}/`
2. Extraire composants UI volumineux (forms, cards, sections)
3. Extraire hooks réutilisables dans `src/hooks/`
4. Re-export depuis page principale
5. `npx tsc --noEmit` après CHAQUE fichier
6. Commit immédiat

### Next steps

Continuer extractions dans l'ordre croissant. Objectif: tous fichiers <300L.

