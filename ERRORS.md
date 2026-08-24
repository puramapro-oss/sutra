# ERRORS — ESLint max-lines Sutra

## État : 21 fichiers restants (24→21, 3 résolus session 2026-08-24-2)

### Résolus session 2026-08-24-2 (3)
- ✅ influencer/page.tsx (no-empty catch block→console.error) — commit d374691
- ✅ lib/ltx.ts (408→refactoré 4 modules) — commit 6dbdca9
- ✅ lib/sutra-auto.ts (423→285L refactoré 4 modules) — commit 152a31c

### Restants triés par taille approximative (21)

NE PAS TOUCHER (selon consignes):
- api/stripe/webhook/route.ts - 512 lignes
- api/internal/stripe-fulfillment/route.ts - 516 lignes

À traiter par ordre croissant:
1. voices/page.tsx - 472 lignes
2. autopilot/page.tsx - 499 lignes
3. contest/page.tsx - 499 lignes
4. storyboard/page.tsx - 502 lignes
5. admin/page.tsx - 507 lignes
6. analytics/page.tsx - 511 lignes
7. publish/page.tsx - 532 lignes
8. referral/page.tsx - 582 lignes
9. PublishEverywhereButton.tsx - 600 lignes
10. production/page.tsx - 617 lignes
11. settings/social/page.tsx - 639 lignes
12. batch/page.tsx - 681 lignes
13. financer/page.tsx - 683 lignes
14. help/page.tsx - 690 lignes
15. settings/page.tsx - 715 lignes
16. templates/page.tsx - 861 lignes
17. library/page.tsx - 922 lignes
18. editor/[id]/page.tsx - 1023 lignes
19. create/page.tsx - 1181 lignes

## Stratégie de refactoring

Pour chaque fichier page.tsx trop long :
1. Extraire hooks custom dans fichiers séparés (useX.ts)
2. Extraire sections/composants dans fichiers séparés
3. Extraire utilitaires/helpers dans fichiers séparés
4. Garder seulement structure principale dans page.tsx

Pour lib/*.ts :
1. Créer *-types.ts pour interfaces
2. Créer *-utils.ts pour helpers
3. Créer *-helpers.ts pour fonctions secondaires
4. Garder seulement fonctions principales + re-exports

## Commits précédents

Session 2026-08-24-1 (4 fichiers):
- admin/users (458→105L) — commit 8e02ba9
- community (461→70L) — commit 89c3d21
- admin/contest (499→90L) — commit 6d4f582
- landing/AppWelcome (505→25L) — commit 125d33d

Sessions précédentes (2 fichiers):
- setup-db.mjs (412→241L) — commit 558d937
- admin/finances (413→284L) — commit 5f8696a

## Total traité : 9 fichiers
## Total restant : 21 fichiers (hors 2 interdits)
