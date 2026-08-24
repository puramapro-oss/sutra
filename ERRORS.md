# ERRORS.md — sutra

| DATE | BUG | CAUSE | FIX |
|------|-----|-------|-----|
| 2026-08-24 | Build cassé après extraction create/page (10 erreurs TS) | Extraction incomplète useVideoGeneration hook + ManualForm : (1) `isOverLimit` utilisé avant déclaration L87 vs L93, (2) setters (`setPipelineSteps`, `setVideoId`, `setError`) non retournés par hook, (3) `topic`/`setTopic` manquants dans destructuration ManualForm props, (4) `VideoEngine` importé depuis `@/types` au lieu de `@/lib/ltx` dans create-utils | (1) Déplacer définition `isOverLimit` (L90-93) AVANT appel hook (L65), (2) Ajouter `resetGeneration()` + setters dans return du hook, (3) Ajouter `topic`, `setTopic` dans destructuration ManualForm L36, (4) Corriger import VideoEngine→`@/lib/ltx`. tsc 0 erreur, build ✓ 4.2s. |
| 2026-08-24 | 17 fichiers >300L | Code non modulaire, gros composants monolithiques | Extraction hooks + composants : template-data 433→18L, templates/page 486→235L, voices/page 511→181L, storyboard/page 571→241L, analytics/page 550→72L, publish/page 532→116L, referral/page 623→133L, production/page 617→265L, batch/page 625→121L, **financer/page 578→195L** ✅ (commit efc094c). 4 fichiers réels >300L restants + 2 exclus. |

## Fichiers >300L restants (12 total, 10 à traiter)

**FAIT** ✅ (8 fichiers <300L confirmés):
- ~~storyboard/page.tsx~~ 571→241L (commit 3a6e647)
- ~~analytics/page.tsx~~ 550→72L (commit 1e4f006)
- ~~publish/page.tsx~~ 532→116L (commit fd19e4a)
- ~~referral/page.tsx~~ 623→133L (commit 94ea58c)
- ~~help/page.tsx~~ (commit 528869c, constants extraits)
- ~~production/page.tsx~~ 617→265L (constants + types + 8 composants + hook)
- ~~batch/page.tsx~~ 625→121L (commit ab290b8, useBatch hook + 7 composants)
- ~~financer/page.tsx~~ 578→195L (commit efc094c, 4 steps → composants Step1-4)

**EXCLUS** (webhook Stripe intacts):
- src/app/api/stripe/webhook/route.ts — 613L (NE PAS TOUCHER)
- src/app/api/internal/stripe-fulfillment/route.ts — 618L (NE PAS TOUCHER)

**RESTANTS** (4 à traiter, ordre croissant):
1. src/app/(dashboard)/settings/page.tsx — 777L (hook useSettingsState créé commit e08c936, reste extraction 7 tabs)
2. src/app/(dashboard)/library/page.tsx — 1017L
3. src/app/(dashboard)/editor/[id]/page.tsx — 1120L
4. src/app/(dashboard)/create/page.tsx — 1280L

## Stratégie confirmée

- Extraction systématique en `hooks/use{Feature}.ts` + `components/{feature}/`
- Re-exports pour 0 breaking change
- tsc + commit après chaque fichier
- Ordre croissant de taille
- Dernière mesure réelle wc -l, jamais d'estimation
