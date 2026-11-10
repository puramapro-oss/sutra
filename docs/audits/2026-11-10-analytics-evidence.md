# SUTRA — mesures vérifiées pour l’apprentissage automatique

Date : 10 novembre 2026. Base exacte : [PR #9](https://github.com/puramapro-oss/sutra/pull/9), commit `305e802cfb18b31b8366458c58b868c2a37348fa`.

## Défaut et correction

Le cron lisait `account_id` alors que les publications récentes enregistrent `accountId`. L’adaptateur envoyait aussi des paramètres incompatibles avec le contrat Zernio et lisait les compteurs au mauvais niveau de réponse. Une mesure indisponible pouvait ainsi devenir un zéro enregistré, puis alimenter l’apprentissage. Les écritures refusées et les mémoires non sauvegardées pouvaient être comptées comme réussies.

Le correctif vérifie le compte, le profil, la publication et chaque destination, puis réévalue leur liaison après l’appel fournisseur. Il conserve les mesures précédentes si un résultat manque ou reste en attente. Seules les mesures complètes dont l’écriture est confirmée alimentent l’analyse ; une mise à jour concurrente empêche l’écrasement d’un instantané périmé. Les taux inconnus restent inconnus, les valeurs sont bornées et les taux sont arrondis à deux décimales. Le compteur d’insights augmente uniquement après confirmation de sauvegarde.

## Sept fichiers du correctif

- `src/lib/zernio.ts`
- `src/lib/sutra-auto-helpers.ts`
- `src/app/api/cron/auto-learn/route.ts`
- `scripts/run-ci.mjs`
- `scripts/test-auto-learn-analytics.mts`
- `scripts/test-auto-learn-route.mts`
- `scripts/test-auto-learn-memory.mts`

Ce document et l’entrée `false` de `git.deploymentEnabled` pour `fix/sutra-analytics-evidence-20261110` dans `vercel.json` complètent le lot de neuf fichiers. Les autres options Vercel sont conservées.

## Vérification

Résultats obtenus sur la base exacte ci-dessus et les sept fichiers du correctif, sans modifications étrangères au lot :

| Contrôle | Résultat |
| --- | --- |
| Nouveaux tests, code original | 3 réussis, 46 échoués, 0 ignoré sur 49 : reproduction des défauts |
| Nouveaux tests, code corrigé | **PASS — 49/49**, 0 ignoré |
| Régressions existantes OAuth, publication et comptes multiples | **PASS — 74/74**, 0 ignoré |
| TypeScript global, `tsc --noEmit --incremental false` | **PASS**, code de sortie 0 |
| ESLint sur les sept fichiers modifiés | **PASS**, code de sortie 0 |
| Application du patch sur la base immuable et contrôle des espaces | **PASS** |

Les trois nouveaux scripts sont enregistrés dans le lanceur CI. Les tests exécutent les vrais adaptateurs et gestionnaires avec des frontières HTTP et base de données simulées. Le nombre de tests échoués sur le code original ne représente pas un nombre de défauts distincts.

## Sources officielles

- [Zernio — Analytics](https://docs.zernio.com/core/analytics) : paramètres `postId`, `accountId`, `profileId`, mesures par destination dans `platformAnalytics` et identité de publication.
- [Zernio — Changelog](https://docs.zernio.com/changelog) : réponse HTTP 202 pour les publications encore en cours, état de synchronisation et mesures indisponibles.

## Limites

**NON TESTÉ** : base PostgreSQL réelle, application des migrations et du trigger `updated_at`, fournisseur Zernio réel, build complet et environnement de production. Aucun déploiement ni publication sociale réelle n’a été réalisé.

**PARTIEL** : les revérifications réduisent les courses concurrentes sans garantir une transaction atomique entre les tables et le fournisseur, ni la génération d’insights exactement une fois. Le workflow `auto-trends` conserve sa politique existante et n’exploite pas le nouveau booléen de confirmation de `recordMemory`.

Ces preuves qualifient ce correctif ciblé ; elles ne constituent pas une validation de mise en production de SUTRA.
