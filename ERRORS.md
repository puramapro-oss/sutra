# ERRORS.md — sutra

| DATE | BUG | CAUSE | FIX |
|------|-----|-------|-----|
| 2026-08-24 | 17 fichiers >300L | Code non modulaire, gros composants monolithiques | Extraction hooks + composants : template-data 433→18L, templates/page 486→235L, voices/page 511→181L, storyboard/page 571→241L, analytics/page 550→72L, publish/page 532→116L, referral/page 623→133L, production/page 617→265L, **batch/page 625→121L** ✅ (commit ab290b8). 4 fichiers >300L restants (2 exclus). |

## Fichiers >300L restants (12 total, 10 à traiter)

**FAIT** ✅ (7 fichiers <300L confirmés):
- ~~storyboard/page.tsx~~ 571→241L (commit 3a6e647)
- ~~analytics/page.tsx~~ 550→72L (commit 1e4f006)
- ~~publish/page.tsx~~ 532→116L (commit fd19e4a)
- ~~referral/page.tsx~~ 623→133L (commit 94ea58c)
- ~~help/page.tsx~~ (commit 528869c, constants extraits)
- ~~production/page.tsx~~ 617→265L (constants + types + 8 composants + hook)
- ~~batch/page.tsx~~ 625→121L (commit ab290b8, useBatch hook + 7 composants)

**EXCLUS** (webhook Stripe intacts):
- src/app/api/stripe/webhook/route.ts — 512L (NE PAS TOUCHER)
- src/app/api/internal/stripe-fulfillment/route.ts — 516L (NE PAS TOUCHER)

**RESTANTS** (4 à traiter, ordre croissant):
1. src/app/(dashboard)/settings/page.tsx — 715L
2. src/app/(dashboard)/library/page.tsx — 922L
3. src/app/(dashboard)/editor/[id]/page.tsx — 1023L
4. src/app/(dashboard)/create/page.tsx — 1181L

## Stratégie confirmée

- Extraction systématique en `hooks/use{Feature}.ts` + `components/{feature}/`
- Re-exports pour 0 breaking change
- tsc + commit après chaque fichier
- Ordre croissant de taille
- Dernière mesure réelle wc -l, jamais d'estimation
