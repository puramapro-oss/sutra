# T03 — fiabilité durable, 14 octobre 2026

Base confirmée T01 : `e09fdaeafbf1ec8554a7b689fe3c44dd696d0140`. Branche locale `codex/sutra-t03-durable-reliability-20261014`. Les six fichiers du précédent lot T03 `fe99ebe` et le contrat Suno T04 `0e20845` sont identiques au candidat intégré ; aucune ancienne correction réimplémentée. Le blocage TypeScript historique du port Suno est résolu dans cette base.

## Résultats et défauts

| Risque / contrôle | Avant correction sur la base | Après / statut |
|---|---|---|
| Reprise d'un résultat final null ou skip musique contradictoire | 10 FAIL / 1 PASS | PASS : 12 tests, dont un nouveau cas positif d'exécution musique désactivée |
| Diagnostic RPC exposé dans la réponse publique (T02-FINAL-01), erreur transport et codes métier | 7 FAIL / 6 PASS | PASS : 13 tests, codes 400/403/409 et réponse 503 expurgée ; un seul appel RPC |
| SQL : fin sans résultat, remplacement de checkpoint, claim épuisé non mis en quarantaine | 6 FAIL / 7 PASS sur SQL canonique | PASS : 13 tests avec **proposition SQL appliquée uniquement à une fixture locale** |
| Régressions worker/persistance/musique du lot précédent, concernées par les deux fichiers modifiés | Preuve précédente intégrée | PASS : 35 tests ciblés rejoués après ce delta |
| TypeScript, lint ciblé | — | PASS, exit 0 ; zéro warning lint |
| Intégration et migration distante de ce delta | Non effectuées par T03 | BLOQUÉ pour la clôture intégrée : prise en charge T01 |
| Fournisseurs réels, GPU, génération, publication, production | Hors mandat | NON TESTÉ |

Total de cette campagne locale : **73 PASS / 0 FAIL / 0 SKIP** (12 + 13 + 13 + 35). Ne pas additionner aux 805 contrats du candidat T01. Les 4 tests `production-error.test.mts` sont une copie byte-identique du test auteur T02 ; ce n'est pas une seconde couverture indépendante. Les échecs avant correction sont conservés, pas requalifiés en PASS.

## Corrections produit

- `src/lib/video-queue.ts` : invariant commun du résultat final ; null n'est valide que pour production/music explicitement désactivée avec checkpoint `stage:music` skipped et value null. Réconciliation après ACK de fin perdu applique le même invariant.
- `src/lib/video-worker.ts` : contrôle du résultat en reprise et avant checkpoint final. Un résultat invalide passe en erreur de réconciliation, sans rejouer les fournisseurs.
- `src/lib/pipeline-submit.ts` : messages publics constants ; seuls trois codes métier exacts sont autorisés, les diagnostics SQL/transport restent hors réponse. Identité, quota, statuts et absence de relance inchangés. Attribution T01 `ACK-T03-SUBMISSION-REDACTION` respectée ; aucune route ni fichier T02 modifié.

## Proposition SQL pour T01 exclusivement

`proposal-durable-recovery.sql` remplace trois fonctions après v11, sans modifier les données historiques ni étendre les CHECK :

1. `finish_video_job` impose un résultat final valide avant done et règlement du quota.
2. `checkpoint_video_job_v2` verrouille la ligne puis accepte un replay identique, refuse un remplacement conflictuel de résultat, scène, stage terminé ou résultat intermédiaire/identité distante. Les journaux actuels LTX/Salad (`scene:N:ltx`, `asset:video:ltx`) et `mediaValidation` restent modifiables pour avancer/revalider. Toute nouvelle clé de journal mutable exige une revue explicite de ce contrat.
3. `claim_video_job_by_key` met les tentatives épuisées en `reconciliation_required`, comme le claim batch, en conservant checkpoints et réservation incertaine.

Cette proposition a été appliquée **deux fois** à la même base jetable pour vérifier son rejeu. Elle ne constitue pas une migration livrée à la production. T01 a réservé `migrations/20261014_durable_checkpoint_integrity.sql` et `scripts/test-pipeline-postgres.mts` dans les LOCKS. Comparer les définitions/ACL réellement en place avant adoption ; CREATE OR REPLACE conserve les ACL existantes. Les fixtures historiques aux lignes 77–81, 200–209 et 230 de ce test écrasent volontairement des checkpoints terminés : utiliser des jobs indépendants pour chaque scénario invalide en conservant toutes les assertions média. T03 ne modifie pas ce test ni une migration produit.

## Scénarios et portée de la preuve

PostgreSQL 18 réel, cluster privé loopback initialisé par le harnais, sans credentials ambiants. DDL videos extrait de `src/data/setup-schema.ts`, auto extrait des migrations canoniques, fonctions v10/v11 et contrainte auto 20261006. Les journaux pg-stop confirment l'arrêt de nos clusters ; aucun service tiers interrompu.

- Douze livraisons et douze clients concurrents : un résultat durable gagnant, refus des remplacements, une seule réservation libérée lors de l'annulation.
- Expiration de lease, refus de l'ancien worker, récupération ciblée épuisée en quarantaine, résultat et quota conservés.
- Un véritable processus fixture sort avec code 23 après l'enregistrement de l'identité distante ; le nouveau processus réconcilie par un poll simulé, zéro nouvelle soumission ; le troisième ne poll plus. C'est un redémarrage de processus de test utilisant `pipelineSteps`, pas une preuve de worker distant déployé ni de redémarrage du serveur PostgreSQL.
- ACK fournisseur perdu avec identité persistée : récupération ; absence d'identité après intention incertaine : aucune relance automatique. Musique échouée après vidéo acquise : vidéo conservée.
- Rollback SQL réel (division par zéro après checkpoint dans la transaction) : aucune intention ni appel simulé payé validés ; retry sûr seulement après absence d'intention confirmée.
- Checkpoints indépendants script, scènes, images, voix, musique, sous-titres, composition, export, publication préservés en reprise ; aucun appel social réel.
- CHECKs SQL existants compatibles avec les états planning/script/video/audio/compositing/failed ; états inventés rejetés. Auto ready/pending_approval exige preuve finale et pistes demandées via la validation existante, réutilisée sans la modifier. Résultat brut et musique obligatoire absente refusés.

Les tests ne certifient pas l'absence de tout défaut, une panne physique disque, un kill au milieu de chaque instruction, ni le comportement d'un fournisseur réel. Les adaptateurs T04, médias T05 et publication T06 restent hors édition. Les budgets testés sont les compteurs durables de quota et leur réservation/libération ; aucun débit financier réel.

## Commandes exactes

Depuis le worktree T03, dépendances réutilisées après comparaison package/lock avec T01, aucune installation ni build global :

```sh
python3 qa/t03-durable-reliability-20261014/verify.py new
python3 qa/t03-durable-reliability-20261014/verify.py affected
T03_TEST_NODE=/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node python3 qa/t03-durable-reliability-20261014/verify.py submission
node qa/t03-durable-reliability-20261014/postgres.mjs after
python3 qa/t03-durable-reliability-20261014/verify.py typecheck lint
```

Node 24.21.0 déjà disponible est utilisé pour la copie T02 (module mocks), Node 26.0.0 pour les autres commandes. `verify.py` réduit l'environnement à des fixtures synthétiques et charge la barrière réseau/lecture secrets/processus média existante. `postgres.mjs` n'autorise que son cluster loopback ; initdb utilise mmap/posix pour éviter la limite shmget Mac sans toucher aux autres services. Les commandes développées, exit codes et empreintes sont dans `after-*.json`. Les variantes `verify.py before new`, `verify.py before submission` et `postgres.mjs before` ont produit les preuves rouges conservées avant correction.

`harness-initial-null-rejected.log` est une erreur initiale du harnais (p_initial null invalide pour create), corrigée par une fixture `{}` ; elle ne compte pas comme défaut produit. Les métadonnées des premières exécutions comprennent aussi le hash du test worker nouveau, modifié ensuite : il n'est pas une dépendance des suites affected/submission. Leurs vrais fichiers d'entrée restent inchangés, contrôlés dans le manifeste final ; leurs PASS ne sont pas rejoués sans delta.

Les gates CI/build globales du candidat T01 sont réutilisées seulement pour les chemins inchangés. Cette livraison exige une recette intégrée T01 après import, notamment SQL et fixtures historiques ; elle n'annonce pas une CI fraîche pour le delta.

## GitNexus et sécurité

Impacts avant édition archivés : `runVideoJob`, `finishJob`, `submitVideoJob` **CRITICAL**, cinq appelants directs routes/cron ; avertissement communiqué avant modification. SQL non indexé : UNKNOWN. Index privé rafraîchi, 17 922 nœuds, 34 748 relations ; troncatures de flux consignées. `detect_changes --scope all` associe des flux hors SUTRA et ne mappe qu'un symbole sur les trois fichiers produit : **exhaustivité UNKNOWN**, pas une certification du périmètre. Le contrôle staged précommit et le diff exact sont archivés séparément ; revue directe limitée aux trois fichiers réservés.

Aucun secret réel lu/chargé/copier, aucun accès fournisseur ou distant, GPU, IA Mac, publication, push, fusion ou déploiement. Scan Gitleaks limité au contenu de ce lot avec sortie expurgée ; manifeste et liste exacte des fichiers livrés joints. Le WIP T01 et les autres worktrees sont préservés.

Précontrôle de présentation : le diff-check des journaux bruts a signalé des espaces de fin de ligne. Seul ce formatage a été normalisé après le commit produit ; contenu et verdicts inchangés, empreintes brutes conservées dans security.json. Aucun test produit rejoué pour ce changement documentaire.
