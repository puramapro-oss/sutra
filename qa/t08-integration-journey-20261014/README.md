# T08 — recette indépendante du parcours intégré

Base testée : `b7cf848d07fca2734db36a2e30d045ca312a3162`, produit `d8691d8ac6cf885f8e5522f361f45ebe229ec20d`. Branche `codex/sutra-t08-integration-journey-20261014`. Le HEAD T01 est encore cette base au reçu `provenance.json`. Aucun fichier produit modifié. Réservation `SUTRA-T08-20261014:INTEGRATION-JOURNEY` dans les deux LOCKS canoniques.

**13 scénarios indépendants PASS, 0 FAIL, 0 SKIP ; TypeScript ciblé PASS ; ESLint ciblé PASS, zéro avertissement.** Durée totale Node du parcours : 459,245584 ms, mesure de fixtures et non benchmark du service. Deux rafales bornées de douze requêtes concurrentes. Les nouvelles corrections T02–T07 ne sont pas encore intégrées : cette recette ne les certifie pas. Voir [matrice](MATRIX.md) et [plan du prochain candidat](SMOKE-T01.md).

## Exécution exacte

Depuis la racine du worktree, Node 24.21.0 utilisé :

```sh
/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node qa/t08-integration-journey-20261014/run.mjs
```

Le runner exécute, séquentiellement, dans un environnement réduit aux variables système PATH/HOME/TMPDIR et à des valeurs de test synthétiques :

```sh
node --experimental-test-module-mocks --import tsx --test --test-concurrency=1 scripts/test-t08-integration-journey.mts
node node_modules/typescript/bin/tsc --project qa/t08-integration-journey-20261014/tsconfig.json
node node_modules/eslint/bin/eslint.js scripts/test-t08-integration-journey.mts qa/t08-integration-journey-20261014/database.mts qa/t08-integration-journey-20261014/run.mjs --max-warnings 0
```

Utiliser le runner : il active `qa/t08/offline.cjs`, bloque les lectures `.env*`, borne chaque commande à 60 secondes et conserve les reçus JSON/logs. Le transport `fetch` des tests est entièrement remplacé par un simulateur fermé ; toute destination inattendue échoue. Aucune requête fournisseur n'est envoyée. Aucun secret maître lu/copié ; aucune installation. Dépendances réutilisées via lien vers le `node_modules` T01, manifestes package identiques. Les avertissements expérimentaux/de dépréciation de `mock.module` restent visibles dans le log ; ce ne sont pas des erreurs ESLint.

## Ce qui traverse réellement les composants

Routes create/export/publish/status → validation des demandes → identité d'idempotence → queue → worker → pipelines create/production/export → checkpoints/leases/persistance → contrat de composition → garde de validation finale → journal de publication → construction/analyse des requêtes Zernio. Le polling client `awaitGeneration` utilise la véritable route status. Les scripts unitaires T02/T03/T05 restent inchangés ; leurs preuves intégrées sont réutilisées.

Les seuls ports remplacés sont session, tables/RPC DB, synthèse et stockage des assets, rendu et mesures des octets, et transport Zernio. La fixture de tables/CAS réutilise `scripts/helpers/social-database.mts`, celle des mesures réutilise `scripts/helpers/media-validation-fixture.ts`. Le nouveau `database.mts` ajoute seulement les reçus RPC de la queue. **Ce n'est ni un login navigateur, ni une transaction PostgreSQL, ni un décodage/rendu média réel.** Le quota est vérifié à la frontière applicative ; aucune facture ou consommation GPU réelle n'est mesurée. Le correctif Suno en cours ajoutera un port à auditer avant de revendiquer sa reprise dans ce parcours.

| Cas | Risque vérifié indépendamment | Résultat |
| --- | --- | --- |
| J01 | Session absente 401 ; création/quota ; polling rendu interrompu ; reprise même ID sans nouvelle génération ; montage ; validation ; export ; planification 202 ; confirmation distante simulée avant published | PASS |
| J02 | Douze créations de même clé : un projet/job/intention, onze 202 ; vrai polling client/status ; même clé/autre contenu 409 | PASS |
| J03 | Refus quota 403 ou DB submission 503 : aucun projet orphelin ni effet fournisseur ; chemin nominal ensuite | PASS |
| J04 | Upload voix interrompu puis reprise : voix déjà synthétisée et assets résolus réutilisés | PASS |
| J05 | Échec écriture ready : publication refusée ; reprise sans nouveau rendu/vérification ; règlement unique de fixture | PASS |
| J06 | Autre client : status/export 404, publication 409 sans effet ; propriétaire Salad désactivé 503 avant nouveau job | PASS |
| J07 | Validation export refusée : ancien média prêt préservé ; reprise validation sans second rendu | PASS |
| J08 | Deux destinations, une échouée : état partiel explicite ; réconciliation puis retry de la seule destination échouée | PASS |
| J09 | Preuve finale absente ou accès compte révoqué : aucun envoi | PASS |
| J10 | Reçu de rendu perdu après soumission : intention durable, réconciliation requise ; aucun second rendu ni faux succès | PASS |
| J11 | Douze publications concurrentes : un POST média, un journal ; reprise répare les projections | PASS |
| J12 | Nouvel export après planification : conflit média 409, intention précédente jamais remplacée silencieusement | PASS |
| J13 | Date passée après export : refus explicite ; aucune publication immédiate implicite | PASS |

## Défauts et provenance

Aucun nouveau défaut produit démontré par ces treize scénarios. Un défaut du **harnais** a été corrigé : `structuredClone` direct des arguments RPC échouait sur les callbacks du contrat de composition. Cause : la fixture ignorait la sérialisation JSON du transport Supabase. Correction : sérialisation/désérialisation JSON à l'entrée RPC, puis clones des valeurs transportées. Vérification : les 13 parcours et TS/lint passent. Aucun changement produit pour rendre le test vert.

Les défauts actuels signalés par T02/T04/T06/T07 figurent séparément dans la matrice ; ils appartiennent à leurs propriétaires et ne sont pas des découvertes T08. Leurs handoffs sont figés dans `owner-observations.json`. Ils interdisent d'assimiler un ancien PASS global à une certification sans réserve. T01 attend leurs SHA avant campagne unique.

`tested-source.json` fige 802 fichiers source/tests/dépendances/config. `provenance.json` fige les hashes du nouveau harnais et des fixtures/rapports réutilisés. Aucun changement produit entre d8691d8 et b7cf848. Les 873 empreintes du manifeste T01 sont identiques au worktree ; son champ historique base=111c134 n'est pas utilisé comme preuve du candidat final : `manifest-final.json` et CI38494320084 identifient d8691d8. Les reçus CI sont lus localement, pas reconsultés sur GitHub. Le premier échec média 111c134, corrigé dans d8691d8, et le timeout navigateur de la première tentative quality d8691d8 restent archivés par T01 ; seule la seconde tentative exacte est PASS.

## GitNexus et limites

Index propre au worktree : `sutra-t08-integration-journey-20261014`, indexation locale `--index-only --skip-fts`. Le contexte de `runVideoJob` retrouve create/export/production/auto/cron ; aucun de ces symboles produit n'est édité. Avant correction de la nouvelle fixture, impact exécuté mais symbole non encore indexé : UNKNOWN documenté. Après indexation finale, `journeyDatabase` : LOW, un appelant (le nouveau script), zéro processus affecté. `detect-changes` est exécuté sur le stage avant commit ; reçu conservé. Pas de revendication d'analyse exhaustive de sécurité à partir du graphe.

Résultat staged : **HIGH**, dix flux GET/POST associés aux helpers `rpc`/`failure`/`ok` de fixture. Avertissement communiqué avant commit. `context rpc` indique une borne inférieure (trois récepteurs non résolus) et attribue aussi des routes community/feedback/share à cette fonction de QA. Contrôle direct : aucun import de la fixture dans `src`, un seul import dans le nouveau test, aucun diff staged produit/config/SQL. Ces associations de noms ne prouvent pas une modification des routes ; le branchement RPC réel existe uniquement via les mocks du processus de test. Reçu complet `gitnexus-context-rpc.txt` ; risque graphe HIGH conservé, exhaustivité UNKNOWN. La portée de commit reste tests/preuves/docs.

Absence de worker/cron autonome OVH : constat T01 du 14 octobre, pas une mesure T08. Générations GPU, rendu facturé, export vidéo réel, publication réelle, consentements sociaux, performance distante et alertes bout en bout : NON TESTÉS. Les contrôles DB réels, navigateur et média existants sont des preuves T01 réutilisées, pas un parcours continu réel exécuté par T08. Aucun déploiement/push/fusion/migration/activation/service interrompu.
