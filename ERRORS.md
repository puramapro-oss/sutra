# ERRORS.md — sutra

| DATE | BUG | CAUSE | FIX |
|------|-----|-------|-----|
| 2026-08-24 | 17 fichiers >300L | Code non modulaire, gros composants monolithiques | Extraction hooks + composants : template-data 433→18L, templates/page 486→235L, voices/page 511→181L, storyboard/page 571→241L, analytics/page 550→72L, publish/page 532→116L, referral/page 623→133L. 8 fichiers restants à traiter (2 exclus). |

## Fichiers >300L restants (12 total, 10 à traiter)

**FAIT** ✅:
- ~~storyboard/page.tsx~~ 571→241L (commit 3a6e647)
- ~~analytics/page.tsx~~ 550→72L (commit 1e4f006)
- ~~publish/page.tsx~~ 532→116L (commit fd19e4a)
- ~~referral/page.tsx~~ 623→133L (commit 94ea58c)

**EXCLUS** (webhook Stripe intacts):
- src/app/api/stripe/webhook/route.ts — 512L (NE PAS TOUCHER)
- src/app/api/internal/stripe-fulfillment/route.ts — 516L (NE PAS TOUCHER)

**RESTANTS** (10):
1. src/app/(dashboard)/publish/page.tsx — 581L
2. src/app/(dashboard)/referral/page.tsx — 582L
3. src/app/help/page.tsx — 588L
4. src/app/(dashboard)/production/page.tsx — 617L
5. src/app/financer/page.tsx — 652L
6. src/app/(dashboard)/batch/page.tsx — 681L
7. src/app/(dashboard)/settings/page.tsx — 715L
8. src/app/(dashboard)/library/page.tsx — 922L
9. src/app/(dashboard)/editor/[id]/page.tsx — 1023L
10. src/app/(dashboard)/create/page.tsx — 1181L

## Stratégie confirmée

- Extraction systématique en `hooks/use{Feature}.ts` + `components/{feature}/`
- Re-exports pour 0 breaking change
- tsc + commit après chaque fichier
- Ordre croissant de taille
- Dernière mesure réelle wc -l, jamais d'estimation
