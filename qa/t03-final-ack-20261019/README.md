# ACK T3 — candidat ab935, 19 octobre 2026

**ACK technique T3 sur `ab935e59ca4e39776630f05b2ba6c0422c74ec62`**, limité aux contrôles ci-dessous. Branche `codex/sutra-t03-final-ack-20261019`. Aucun changement produit, SQL, dépendance ou adaptateur. Aucun défaut produit démontré dans ces essais ; ce résultat ne vaut ni garantie générale ni autorisation de production/WanGP. Les nouveaux défauts annoncés par T02/T04/T06 restent dans leurs périmètres et empêchent de transformer cet ACK en feu vert global.

## Intégration et fraîcheur

`integration.json` compare les blobs réels : `video-queue.ts`, `pipeline-state.ts` et `production-pipeline.ts` sont identiques à la livraison T3 `ee3f7017da762c72163440706064ad08df84f761`, puis `6fe40857f793f0605488182dcd19924a76809c96` et `451062793ab1a0de6757630e4aa7b946bbd15c52`. Les fixtures PostgreSQL ont reçu la table `activity_logs` ; la migration canonique contient désormais l'audit d'annulation atomique T1. Ce delta et la demande de retest du SHA exact justifient les essais SQL. GET/DELETE create et la réconciliation après POST incertain sont les composants T1 intégrés, réutilisés sans modification.

Les reçus `initial/receipt.json` et `followup/receipt.json` enregistrent commandes, codes retour et empreintes. Les historiques ne sont pas écrasés. Le lint initial a refusé `console.log` dans le nouveau test ; correction en écriture stdout structurée, puis quatre cas migration rejoués. Ce défaut de harnais n'est pas un défaut produit. Les quatre répétitions ne s'ajoutent pas au total distinct.

## Résultats

| Contrôle | Résultat | Preuve |
|---|---|---|
| Queue/RPC/API, contraintes SQL et annulation avec vraie DB privée | PASS, 46/46 | `initial/postgres.log` : 42 cas existants + 4 nouveaux cas migration |
| Checkpoints, interruptions, fournisseurs simulés, annulation T7/T1 | PASS, 135/135 | `initial/contracts.log`, dont 2 nouveaux cas de port visuel |
| Backoff persistant, claim ciblé et batch, 12 reprises concurrentes, tentatives épuisées | PASS, 2/2 | `followup/scheduled.log` ; sélection explicite des deux cas concernés |
| AUTO/EXPORT et publication simulée, reprise par compte | PASS, 28/28 | `followup/delivery.log` : 5 cas AUTO/EXPORT + 23 contrats T6 existants |
| Migration, sauvegarde et rollback après correction lint | PASS, 4/4 répétés | `followup/postgres.log`, `backup.json`, `rollback.json` |
| TypeScript des nouveaux tests et lint des quatre nouveaux scripts/tests | PASS | `typecheck-final.log`, `lint-final.log`, codes retour consignés dans `validation.json` |
| Réservations de toutes les fixtures et arrêt des deux clusters | PASS | reçus `settle-*.log`, marqueurs `T03_BACKUP_FIXTURE_SETTLED`, `pg-stop.log`, `stopped:true` |

**211 cas distincts PASS, 0 FAIL, 0 SKIP dans les sélections exécutées.** Les autres cas du fichier T1 ne sont pas revendiqués comme exécutés par le filtre des deux backoffs. Pas d'addition avec CI ou anciennes campagnes recouvrantes. Pas de nouveau build global : produit/configuration/dépendances inchangés ; CI historique exacte conservée par T1/T8, aucune qualification runtime du 19 octobre déduite de cette CI.

## Transitions effectivement contrôlées

La file existante reste l'autorité unique des jobs ; l'état de la vidéo et celui de chaque destination sociale restent des objets distincts, pas un nouveau moteur.

| Source | Destination/condition | Effet durable |
|---|---|---|
| Nouvelle intention | `queued`, clé logique unique + hash conforme | Une réservation atomique ; doublon identique retourne le même job ; conflit de payload refusé |
| `queued` éligible | `processing` | Claim verrouillé, compteur de tentative et bail ; batch `SKIP LOCKED` |
| `processing`, bail expiré | `processing`, nouveau propriétaire | Ancien propriétaire incapable de checkpoint/finalisation ; résultats acquis conservés |
| `processing` + erreur récupérable | `queued` | Backoff SQL partagé par batch et ciblage ; pas de consommation/libération prématurée |
| `processing` + réponse incertaine ou tentatives épuisées | `reconciliation_required` | Réservation et checkpoints conservés ; aucun nouveau POST automatique |
| `processing` + résultat valide durable | `done` | Une consommation, dans le mois de réservation ; ACK perdu relu depuis la DB |
| `processing` + échec définitif | `failed` | Une libération, état et compteur dans la même transaction |
| `queued` / `processing` / `reconciliation_required` | `cancelled` | Une libération et un événement d'audit atomiques ; écriture d'audit en erreur annule toute la transaction |
| `done` / `failed` / `cancelled` | Pas de nouveau claim | Livraison répétée sans nouvelle exécution/consommation ; annulation tardive ne réécrit pas le succès |

Les six états de `VideoJob` sont ceux des contraintes SQL. `compositing_failed` reste refusé ; l'échec d'assemblage utilise `failed` et conserve les acquis. La RPC génération accepte `draft/generating/ready/failed` pour `videos` et `planning/generating_script/generating_video/generating_audio/compositing/ready/pending_approval/failed` pour AUTO. Les états sociaux ne sont pas accessibles par cette RPC ; les vidéos déjà en publication ne sont pas écrasées par une reprise de génération.

`ready`/`done` exigent le reçu durable d'export mesuré, URL finale distincte du brut, hash SHA-256, dimensions/durée/fps cohérents et pistes requises présentes. Valeurs vides, partielles, invalidées, pseudo-succès booléens et erreurs SQL ne constituent pas des réussites. La validation physique T5 est injectée/simulée ici ; ces tests ne certifient pas un média réel ni l'intégrité actuelle d'un objet distant.

Checkpoints séparés : `stage:script`, `stage:storyboard`, `stage:scenes`, `stage:images`, `stage:voice`, `stage:music`, `stage:subtitles`, `stage:composition`, `stage:export`, `stage:publication`. Le storyboard est dérivé du script déjà acquis ; son échec d'écriture ne rappelle pas le fournisseur. Les acquis par scène/audio et les identifiants distants sont conservés. Musique désactivée : reçu `skipped/null` explicite réutilisable, jamais confondu avec une absence de résultat. Le journal T6 porte les reçus par compte ; publication partielle et programmée restent distinctes d'une publication complète. Ses contrats existants ont été exécutés en simulation, sans éditer T6.

Un résultat fournisseur reçu avant perte d'ACK est réconcilié avec son reçu SQL/ID distant. Sans ID ni résultat durable après intention payante, le job reste en réconciliation. Les compteurs de soumissions simulées montrent l'absence de second POST/fallback dans ces cas ; ils ne prouvent pas la facturation réelle du fournisseur. Annuler le job libère son quota applicatif, sans garantir l'arrêt d'un GPU distant ni un remboursement.

## Migrations, sauvegarde et rollback

Migration existante : `migrations/20261015_final_durable_integrity.sql`, SHA-256 `925fa5d28ee1724226fe7793767f409af85efe7a392d4991365284107d4ccccf`. **Aucune migration nouvelle proposée, aucune migration distante exécutée.**

Pré-requis de la fixture : schémas synthétiques et migration `20261006_auto_occurrence_integrity.sql`, puis `v10_durable_jobs_quota.sql`, puis `v11_pipeline_checkpoints.sql`. Upgrade direct v11 → migration canonique testé, ainsi que les fixtures historiques passant par le correctif du 14 octobre. Ordre du lot T1 : durable → `20261015_client_write_permissions.sql` → `20261015_social_authorization_history.sql`. Les deux dernières migrations relèvent des reçus T1/T2/T6, pas d'une exécution nouvelle T3.

Nouveaux essais : `pg_dump --format=custom` d'une DB synthétique, `pg_restore --exit-on-error` dans une seconde DB privée, égalité des lignes, définitions de fonctions, droits EXECUTE et contraintes. Application puis deux replays sans altération ; rollback des six définitions antérieures et retrait du helper ajouté, via la garde existante de T1 ; les écritures faites après migration restent présentes ; réapplication identique. Dérive des définitions et erreur SQL injectée au milieu du lot empêchent toute application partielle. Un défaut d'audit d'annulation ne libère aucun quota ; huit sessions concurrentes après rétablissement produisent un seul reçu et une seule libération.

Le test réutilise `DEFINITIONS`/`guarded_sql` de `qa/t01-consolidation-20261014/checkpoint-transition.py` et la recette de rollback de T1 ; il n'exécute pas leur transport distant. Dumps privés synthétiques conservés hors Git, empreintes dans `backup.json`. Aucun dump de données utilisateur, aucune suppression de DB existante. Pour une opération réelle, T1 doit établir son backup frais et son état attendu, utiliser le rollback correspondant à ces définitions et préserver les écritures concurrentes ; un ancien dump ne doit pas écraser les nouvelles lignes. DR complet auth/objets, permissions runtime et compatibilité de la version PostgreSQL de production : NON TESTÉS dans cette session (PostgreSQL local 18).

## Contrat pour T9 WanGP

Réutiliser le port `ProductionProviders.visual` et les checkpoints/leases existants. `port.test.mts` prouve deux obligations avec une callback synthétique : ID persisté puis interruption → reprise par consultation et 12 livraisons sans nouvelle soumission ; réponse perdue sans ID → quarantaine sans fallback. Il ne s'agit pas d'un adaptateur WanGP ni d'un test de son API.

Avant tout raccord T9/T4 : contrat de requête déterministe et clé d'idempotence stable ; intention confirmée avant soumission ; ID fournisseur durable avant polling ; récupération sans nouvelle génération ; délais bornés ; résultats invalides et refus de persistance propagés ; validation T5 avant finalisation. Le journal actuel `LtxJobState` et les exceptions SQL de checkpoints mutables sont spécifiques (`scene:N:ltx`, `asset:video:ltx`, branches v2/Salad). **Ne pas faire passer WanGP pour Salad/LTX.** Si WanGP requiert de nouveaux champs ou chemins mutables, T9/T4 doivent proposer ce contrat explicite à T1 avec migration idempotente et tests ; cette compatibilité de format reste NON TESTÉE. Pas d'activation T9 ni de changement de fournisseur par cet ACK.

## Commandes exactes

Depuis ce worktree, sans charger de secrets :

```sh
node qa/t03-final-ack-20261019/run.mjs
node qa/t03-final-ack-20261019/run.mjs followup followup
node --require ./qa/t08/offline.cjs node_modules/typescript/bin/tsc -p qa/t03-final-ack-20261019/tsconfig.json
node --require ./qa/t08/offline.cjs node_modules/eslint/bin/eslint.js qa/t03-final-ack-20261019/run.mjs qa/t03-final-ack-20261019/settle.mjs qa/t03-final-ack-20261019/migration.test.mts qa/t03-final-ack-20261019/port.test.mts --max-warnings 0
```

Les dossiers `initial` et `followup` existent : pour une reprise justifiée, donner un nouveau label, par exemple `node qa/t03-final-ack-20261019/run.mjs after-integration followup`. Le harnais refuse d'écraser une preuve. Commandes détaillées de chaque sous-test, PostgreSQL et settlement dans les reçus. L'environnement des simulations est limité à des identifiants factices ; préchargement `qa/t08/offline.cjs`, réseau externe et lecture `.env` refusés. Aucun accès au master de secrets nécessaire.

## Limites et transmission

PASS local borné ; FAIL produit restant T3 : aucun démontré. BLOQUÉ externe : qualification du parcours WanGP réel dépend du contrat/adaptateur T9 et d'une autorisation distincte ; certification globale indépendante de cet ACK, avec défauts d'autres propriétaires en cours. NON TESTÉ : fournisseurs/GPU, tarifs/facturation/remboursement, stockage et média réels, consentements/publications, ordonnanceur continu et SLA de production, restauration de toute l'infrastructure. Aucun changement de production, push ou fusion.

GitNexus exécuté avant édition et avant commit. Graphe partiel : `pipelineSteps` HIGH (11 appelants directs, 4 parcours), nom générique `run` CRITICAL sans UID résolu ; ces avertissements ne sont pas assimilés à une certification exhaustive. Le périmètre réel est contrôlé par le diff QA/docs, aucun symbole produit modifié. Détails des analyses et revue finale dans ce dossier.

À T1/T8 : intégrer les preuves/QA par chemins réservés, préserver les journaux communs ; SHA local et FIN_ECRITURE dans le miroir `T03-FINAL-DURABLE-20261015.md`. Sur le prochain candidat, comparer les empreintes produit/SQL/tests/dépendances et ne retester que les parcours affectés. Les nouvelles corrections T02/T04/T06 ne sont pas réputées couvertes par ce reçu ab935.

Contrôle final GitNexus staged : CRITICAL, 60 symboles QA/docs et 496 parcours annoncés, associations génériques non probantes ; comparaison main séparée conserve l'historique global et ne représente pas ce delta. Diff réel : aucun fichier src/migrations/config/dépendances modifié. Sécurité : scan sources/docs Gitleaks exit0 ; scan complet exit1 avec 48 alertes des reçus, toutes prouvées être des SHA-256 de fichiers par recalcul (`gitleaks-triage.json`), aucun résultat brut repeint en PASS.
