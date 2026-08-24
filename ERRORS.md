# ERRORS.md — sutra

| DATE | BUG | CAUSE | FIX |
|------|-----|-------|-----|
| 2026-08-24 | 17 fichiers >300L | Code non modulaire, gros composants monolithiques | Extraction hooks + composants : template-data 433→18L, templates/page 486→235L, voices/page 511→181L. 14 fichiers restants à traiter. |

## Fichiers >300L restants (14)

1. src/app/(dashboard)/analytics/page.tsx — 511L
2. src/app/(dashboard)/batch/page.tsx — 681L  
3. src/app/(dashboard)/create/page.tsx — 1181L
4. src/app/(dashboard)/editor/[id]/page.tsx — 1023L
5. src/app/(dashboard)/library/page.tsx — 922L
6. src/app/(dashboard)/production/page.tsx — 617L
7. src/app/(dashboard)/publish/page.tsx — 532L
8. src/app/(dashboard)/referral/page.tsx — 582L
9. src/app/(dashboard)/settings/page.tsx — 715L
10. src/app/(dashboard)/storyboard/page.tsx — 502L
11. (2 fichiers non identifiés) — 516L, 512L
12. src/app/financer/page.tsx — 652L
13. src/app/help/page.tsx — 588L

## Stratégie appliquée

- Extraction systématique en `hooks/` + `components/{feature}/`
- Re-exports compatibilité
- 0 changement comportemental
- tsc + build vérifiés après chaque fichier

## Prochaines étapes

Continuer extraction sur les 14 fichiers restants, ordre croissant de taille.
