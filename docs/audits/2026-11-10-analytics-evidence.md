# SUTRA — mesures vérifiées pour l’apprentissage automatique

Date : 10 novembre 2026. Qualification initiale sur la [PR #9](https://github.com/puramapro-oss/sutra/pull/9), commit `305e802cfb18b31b8366458c58b868c2a37348fa`. Le rapprochement décrit plus bas conserve les évolutions de cette PR jusqu'au commit `3e15b4dd407b9cad3f1899cb33bdac1ec8568ba1`.

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

## Qualification initiale

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

## Rapprochement avec la base actualisée

La PR #9 a intégré les corrections statistiques, navigation mobile, reprise de publication et contrôles CI de la PR #10. Le rapprochement conserve le commit existant de la PR #11, `265103459e5bd13d0754959ada1e8162dfc57279`, et la nouvelle base `3e15b4dd407b9cad3f1899cb33bdac1ec8568ba1`. Il ne crée pas une nouvelle proposition concurrente.

Les 63 fichiers modifiés en amont sont conservés. Les 61 fichiers hors `scripts/run-ci.mjs` et `vercel.json` ont été comparés par leur empreinte Git et sont identiques à la nouvelle base. Le lanceur CI est exactement celui de cette base, auquel sont ajoutés une seule fois les trois tests analytiques. Les contrôles de mémoire, promotion et navigateur social restent présents. Le seul conflit de fusion réel concernait `vercel.json` : les deux entrées `deploymentEnabled: false` sont conservées. Les trois sources applicatives et les trois nouveaux scripts de test sont identiques à ceux de la PR #11 déjà qualifiée.

Le delta par rapport à la base actualisée reste limité aux neuf fichiers de ce lot, y compris ce compte rendu. Les manifestes, le lockfile, `next.config.ts` et les consignes du dépôt sont inchangés.

### Vérifications et rattachement au dernier parent

Le premier gel local, `82f67f9721cb952898cd816363303f73b617d21e`, rapprochait la base `846bf6ef` et la PR #11. Une contre-vérification par Git natif a ensuite détecté `3e15b4dd`, alors que les métadonnées de la PR renvoyaient encore l'ancienne tête. Ce dernier commit ajoute ou modifie 20 fichiers de bancs PostgreSQL, de documentation et de reçus. Aucun fichier produit, SQL, manifeste, configuration Next, workflow, runner CI ou Vercel n'a changé ; aucun fichier enregistré dans les 1 533 contrats n'a changé.

Les résultats ci-dessous ont été exécutés sur le premier gel. Ils sont conservés avec leur identité, sans être présentés comme de nouvelles exécutions sur `3e15b4dd`. Les sources applicatives et les tests de contrats correspondants sont identiques dans le rapprochement final. Les contrôles globaux de types et de lint du nouvel arbre, qui contient les bancs QA actualisés, doivent être rafraîchis avec le build sur l'exécuteur externe.

Le [reçu natif amont](https://github.com/puramapro-oss/sutra/blob/3e15b4dd407b9cad3f1899cb33bdac1ec8568ba1/qa/native-qualification-20261110/RECEIPT.json) rapporte notamment neuf groupes de migration sociale, 261 contrôles RLS, 30 contrôles de permissions et 51 tests durables sur PostgreSQL 16.15, ainsi que 21 groupes navigateur et 12 tests de reprise. Ces résultats amont sont conservés, sans les additionner aux présents contrats ni prétendre les avoir réexécutés. Ils ne qualifient pas les appels réels d'apprentissage analytique contre le fournisseur et la base distants.

| Contrôle exécuté | Résultat |
| --- | --- |
| Installation verrouillée, Node 24.22.1 / npm 11.9.0 | **PASS** — `npm ci --ignore-scripts --no-audit --no-fund --progress=false`, 1 090 paquets, lockfile inchangé |
| Contrats généraux | **PASS — 1 526 réussis, 0 échec, 7 ignorés**, sur 1 533 tests inscrits ; les 49 tests analytiques sont inclus |
| Reprise des soumissions | **PASS — 18/18** |
| Promotion | **PASS — 162/162** |
| Planification, composition et publication | **PASS**, trois contrôles distincts du lanceur |
| TypeScript global | **PASS**, `tsc --noEmit --incremental false` |
| ESLint global | **PASS**, 0 erreur et 96 avertissements dans les fichiers hors de ce lot |
| Contrôle des empreintes, des conflits et des espaces | **PASS**, aucun conflit restant |
| Build complet local | **BLOQUÉ** dans ce runtime, selon les essais détaillés ci-dessous |

Ces sous-contrôles sont rapportés séparément ; aucun total cumulé n'est revendiqué. Le runner applique son environnement de fixtures, filtre les credentials et refuse les accès réseau inattendus. Les scripts de cycle de vie des dépendances n'ont pas été activés pour cette installation.

La dépendance privée `@purama/smarana` reste épinglée à `bc3469eb595485714b2044790105acfc5e3b0f31`. Ses 21 fichiers suivis ont été lus via le connecteur GitHub authentifié. Les empreintes de chaque blob, des arbres et du commit exact ont été vérifiées avant de les utiliser comme miroir local de cette seule révision. La réécriture d'URL Git était limitée au processus d'installation. Aucun jeton ni fichier non suivi n'a été copié, aucun stub n'a remplacé la dépendance et les manifestes n'ont pas été modifiés. L'échec d'accès initial et deux installations interrompues par SIGKILL sont conservés dans les reçus ; l'installation finale sérialisée est sortie avec le code 0.

Le premier build à heap 1 536 Mo a compilé l'application en 52 secondes, puis a reçu SIGKILL au contrôle TypeScript. Un essai diagnostique à 1 024 Mo a également reçu SIGKILL, avec une dernière mesure de RSS à environ 1 326 Mo et de heap utilisé à 623 Mo. Le dernier essai à 512 Mo a produit une erreur explicite V8 de mémoire insuffisante après 16 secondes. Ces résultats ne prouvent pas la cause précise des deux SIGKILL et ne constituent pas un build complet réussi. Aucun contrôle TypeScript ni réglage de compilation suivi n'a été supprimé. La compilation complète doit être relancée sur un exécuteur disposant d'une capacité suffisante.

### Sept tests connectés non exécutés

| Tests ignorés | Dépendance nécessaire |
| --- | --- |
| INSEE : présence de clé, SIRET valide, SIRET fictif, clé refusée — 4 tests | Activation explicite `INSEE_LIVE=1`, clé INSEE et accès à l'API |
| Karma Split : écriture d'une facture de test, archives et mouvements des pools — 1 test | `KARMA_SPLIT_DB=1`, base Supabase isolée et initialisée, credentials de test et migrations correspondantes |
| LTX : insertion, lecture et nettoyage de `video_generations` — 1 test | `LTX_TRACK_DB=1`, base Supabase isolée, credentials de test et profil attendu initialisé |
| OpenTimestamps : estampillage public et aller-retour de la preuve — 1 test | `OTS_NETWORK=1` et accès aux calendriers publics ; ce test ne vérifie pas l'ancrage Bitcoin |

Les essais en base écrivent des données : ils ne sont pas exécutés contre une base de production par hypothèse. Ces sept exclusions sont **NON TESTÉES**, séparées des 1 526 réussites.

### Analyse d'impact

GitNexus 1.6.12 a indexé les sources rapprochées avec un seul worker, avant la mise à jour de ce compte rendu. La comparaison à `846bf6ef` identifie **9 fichiers, 118 symboles, 8 flux**, avec un risque agrégé **HIGH**. Les requêtes ciblées retrouvent `auto-learn` pour l'adaptateur et l'analyse, et `auto-learn`/`auto-trends` pour la mémoire. Le handler HTTP n'a pas d'appelant résolu dans le graphe : son entrée repose sur la convention de routage Next et ses tests exécutent le vrai handler.

Le graphe annonce ses limites : huit fichiers volumineux exclus, flux tronqués et recherche plein texte indisponible faute d'extension FTS. Une absence de lien n'est pas une preuve d'absence d'usage. Cette analyse complète les contrôles de sources et les tests ; elle ne qualifie pas les fournisseurs, la base distante ou la production.

## Sources officielles

- [Zernio — Analytics](https://docs.zernio.com/core/analytics) : paramètres `postId`, `accountId`, `profileId`, mesures par destination dans `platformAnalytics` et identité de publication.
- [Zernio — Changelog](https://docs.zernio.com/changelog) : réponse HTTP 202 pour les publications encore en cours, état de synchronisation et mesures indisponibles.

## Limites

**NON TESTÉ pour ce correctif analytique** : exécution sur une base PostgreSQL réelle avec son trigger `updated_at`, fournisseur Zernio réel et environnement de production. Les validations PostgreSQL des autres parcours sont décrites séparément dans le reçu amont. **BLOQUÉ** : build complet sur le runtime local de cette reprise. Un éventuel contrôle externe doit être relié séparément au SHA publié. Aucun déploiement ni publication sociale réelle n’a été réalisé.

**PARTIEL** : les revérifications réduisent les courses concurrentes sans garantir une transaction atomique entre les tables et le fournisseur, ni la génération d’insights exactement une fois. Le workflow `auto-trends` conserve sa politique existante et n’exploite pas le nouveau booléen de confirmation de `recordMemory`.

Ces preuves qualifient ce correctif ciblé ; elles ne constituent pas une validation de mise en production de SUTRA.
