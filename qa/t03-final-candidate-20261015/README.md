# T03 — candidat final durable, 15 octobre 2026

**PASS LOCAL. Aucun défaut produit démontré restant dans les parcours contrôlés.** Livraison QA/documentation uniquement ; aucun moteur, adaptateur, SQL canonique, montage ou publication modifié. Cela ne garantit pas l'absence de tout bug.

## Base et corrections déjà intégrées

Candidat T01 relu avant écriture et après tests : `cb3f893c35599a6c9c50a4d23c82013c10c5f3ae`. Worktree isolé `sutra-t03-final-candidate-20261015`, branche `codex/sutra-t03-final-candidate-20261015`. AGENTS/politique/LOCKS/handoffs lus, POLICY_OK, claim `SUTRA-T03-20261015:FINAL-CANDIDATE-CB3`. T01 conserve intégration/production/migrations, T04 adaptateurs, T05 média, T06 social, T07 UI.

- Trois blobs T03 de `ee3f7017da762c72163440706064ad08df84f761` identiques : musique désactivée/null, refus des résultats invalides, checkpoint voix corrompu et ACK de persistance corrigés sont déjà intégrés.
- Les **14 empreintes** du dernier banc `T03-FINAL-DURABLE` / clôture `6fe40857f793f0605488182dcd19924a76809c96` sont inchangées. Réutilisation de ses **29 scénarios distincts** (10 nouveaux +19 intégrés) sans les rejouer : `invariants.json` et `../t03-durable-closure-20261015/README.md`.
- Les **20 empreintes** du manifeste T07 scheduler/cancel, dont ses huit fichiers produit, correspondent exactement. Le GET T01 requis est intégré, SHA256 `9e0d5b5bc953f35327a3648867333ee1a16a10ef97b0a0a02a5989fdd891d5a1`. Leurs preuves UI/contrat sont réutilisées, pas relancées.
- `integration-proof.json` lie ces constats aux sources finales, dépendances, reçus T01 et SHA. Les preuves CI T01 `38797929920` copiées et attribuées concernent ce SHA : contrats1054PASS/7SKIP historiques, durable18PASS, PostgreSQL16/7/46PASS et groupes RLS/social. Ces groupes se recouvrent : **ne pas les additionner**. Aucun PASS global/release anticipé.

## Nouveau risque couvert : vraie route → vraie transaction SQL

`api-postgres.test.mts` importe les vrais GET/POST production, pipeline-submit et video-queue ; pont Supabase simulé vers les vraies fonctions PostgreSQL. Session synthétique et worker fournisseur entièrement simulés. Aucune invocation des adaptateurs ni octet média généré. PostgreSQL18.4 privé loopback, port aléatoire, environnement allowlist synthétique ; garde `qa/t08/offline.cjs` refuse réseau externe et lecture `.env`. Aucun secret chargé.

| Scénarios nouveaux | Preuve |
|---|---|
| ACK submit perdu après commit, GET sans mutation puis cancel ; même intent refusé après annulation | Un job, un quota libéré, zéro worker |
| Soumission encore non commitée | GET404 et cancel=false ne prouvent pas l'annulation ; après commit GETqueued puis cancel=true |
| ACK cancel perdu ou malformé après commit | Deux scénarios ; HTTP503, GETcancelled, replay false, jamais une seconde génération |
| Erreur SQL pendant cancel | Règlement quota et changement d'état rollback ensemble ; reprise du même cancel réussit |
| Lecture SQL indisponible et autre utilisateur | 503 expurgé/404 ; aucune mutation RPC ni worker |
| Cancel gagne entre checkpoint durable et finish | Pas de succès ; reçu acquis conservé ; worker obsolète ne termine pas |
| Finish gagne puis cancel | Résultat null valide pour musique explicitement désactivée ; même reçu rejoué, consommation unique |
| Douze livraisons HTTP concurrentes | Un worker, un checkpoint, une réservation ; onze réponses202 |
| Douze cancels après expiration du bail | Une libération ; écriture du worker obsolète rejetée |
| Opération distante incertaine | `reconciliation_required`, GET sans mutation, POST409 ; acquis et identifiant distant conservés |
| ACK finish perdu | Lecture du reçu SQL valide ; succès confirmé sans deuxième règlement |
| Erreur SQL pendant finish | HTTP503, aucun done ni data prématuré, réservation et acquis conservés ; retry trop tôt202 |

**13 scénarios distincts validés** : premier passage11PASS/2FAIL de fixture ; rejeu des seuls deux corrigés2PASS/0FAIL. Les FAIL initiaux restent dans `api-postgres.log/json` : payload SQL direct sans `input.userId`, et colonne inventée `lease_expires_at` au lieu de `lease_until`. Correction de fixture seulement, aucun changement produit. Suppression ultérieure d'un paramètre inutilisé du mock `select` : comportement JavaScript inchangé, lint strict final vert. Le runner a reçu uniquement un sélecteur de tests pour ce rejeu.

Réservations : premier cluster12jobs =3consommés+9libérés ; deuxième2jobs =2libérés. **Zéro réservation restante dans les deux bases, clusters arrêtés**, logs `settlement.log`, `replay-two-settlement.log`, `pg-stop.log`, `replay-two-pg-stop.log`. Trois annulations de teardown explicites au premier passage. Cette clôture synthétique n'est jamais une règle de libération d'une vraie opération distante incertaine.

## Commandes exactes

Depuis la racine du worktree :

```sh
# Premier passage : 11 PASS /2 FAIL de fixture conservés.
node qa/t03-final-candidate-20261015/run.mjs
# Contre-épreuve des deux seules fixtures corrigées : 2 PASS.
node qa/t03-final-candidate-20261015/run.mjs 'still-uncommitted|12 cancellations'
node --require ./qa/t08/offline.cjs node_modules/typescript/bin/tsc -p qa/t03-final-candidate-20261015/tsconfig.json
node --require ./qa/t08/offline.cjs node_modules/eslint/bin/eslint.js qa/t03-final-candidate-20261015/api-postgres.test.mts qa/t03-final-candidate-20261015/run.mjs qa/t03-final-candidate-20261015/settle.mjs --max-warnings 0
```

Le runner lance `node --experimental-test-module-mocks --import tsx --test --test-timeout=15000 --test-concurrency=1 [--test-name-pattern=…] qa/t03-final-candidate-20261015/api-postgres.test.mts` avec son environnement privé. **Ne pas lancer l'enfant contre une base existante**. Paramètre facultatif : expression des noms concernés ; sans paramètre les13 tests. Binaires Homebrew PostgreSQL18 requis. Les journaux sont écrits dans ce dossier : préserver les preuves précédentes avant un nouveau run. T01 ne doit rejouer qu'après un changement pertinent de route, queue, SQL, dépendances ou contrat T07 ; aucun nouveau build global nécessaire pour ce lot QA.

## Transitions finales contrôlées

Le moteur existant reste unique. Les états job, vidéo et publication sont des domaines distincts, pas trois moteurs.

| Domaine | Contrat canonique et preuve |
|---|---|
| Job SQL/TS | `queued → processing → done / failed / queued / reconciliation_required` ; CHECK refuse `ready` sur un job. Ancien worker rejeté par propriétaire+bail. |
| Annulation | `queued / processing / reconciliation_required → cancelled` ; ledger et état dans une transaction ; terminal rejoué sans nouvelle réservation. |
| Retry/expiration | `next_run_at` durable, backoff30,60,120…900s ; lease expiré donne un seul nouveau propriétaire ; tentatives épuisées mises en réconciliation. Ancienne fixture process worker réellement interrompu puis repris, invariant. |
| Incertitude fournisseur | Intention persistée avant soumission, résultat durable avant succès ; pas de retry payant aveugle ni fallback. Récupération par ID connu confiée à l'adaptateur T04 ; sans reçu sûr, quarantaine. |
| Génération auto | `planning`, `generating_script`, `generating_video`, `generating_audio`, `compositing`, `failed`. `ready`/`pending_approval` exigent stages, pistes requises et preuve d'export final. |
| Ancien `compositing_failed` | Non accepté par RPC/CHECK canonique ; `failed` est l'état d'échec utilisé. Aucun renommage aveugle de lignes historiques ni migration production ici. |
| Checkpoints | Dix frontières indépendantes : script, storyboard, scènes, images, voix, musique, sous-titres, composition, export, publication. `pending → complete/skipped`, terminal immuable, égalité du reçu avec le résultat. Erreur SQL à chaque frontière couverte par les29 preuves invariantes. |
| Média invalide/partiel | Pas de `done`/`ready` sans résultat concordant, voix/musique exigées et preuve finale liée à URL+SHA256, taille/durée/audio. Média brut ou reçu invalidé refusé. Validation physique des octets : T05. |
| Publication par compte | Génération ne passe pas les états `publishing/published/scheduled/partially_published/reconciliation_required/cancelled` en ready. Journal et reprise par compte T06 ; preuve CI sociale exacte réutilisée, aucun changement ni publication dans ce lot. |
| Budget | Réservation atomique avec job/intention, contention entre requêtes, consommation/libération uniques, ancien mois et ledger absent testés. Réconciliation incertaine conserve la réservation jusqu'à décision explicite. |

## Migration, sauvegarde et rollback à T01

Aucune nouvelle migration nécessaire ni proposée dans ce delta. Utiliser la migration déjà intégrée `migrations/20261015_final_durable_integrity.sql`, SHA256 **e8befa9e9fa602d80c483245bc71d07831fe56aad9ee05ed83dc2261a1d7805c**. Ne pas rejouer séparément l'ancienne proposition QA du14octobre. Six fonctions finales : checkpoint_video_job_v2, video_job_result_valid, finish_video_job, claim_video_job_by_key, claim_video_jobs, persist_video_job_video. Upgrade direct depuis v11, double rejeu et équivalence avec l'ancien chemin déjà prouvés, définitions/ACL/jobs/quotas inchangés par replay.

Ordre du dossier T01 :
1. `20261015_final_durable_integrity.sql` ;
2. `20261015_client_write_permissions.sql` ;
3. `20261015_social_authorization_history.sql`.

Les trois reçus `t01-*-restore.json` sont **des preuves T01 relues, pas des opérations T03**. Backup cohérent18:10UTC,141tables restaurées/comptages identiques ; migration checkpoint applique/rejoue/rollback avec définitions et ACL restaurées exactement,138tables de données inchangées. Les deux autres reçus confirment replay sûr, droits restaurés et historique social conservé. Les permissions affichées dans le reçu checkpoint incluent l'état restauré pré-migration ; elles ne constituent pas à elles seules une certification des privilèges finaux.

Application production exclusivement T01 sous autorisation. Vérifier à nouveau SHA, état attendu/CAS, backup+hash+restauration et fraîcheur (T01 annonce4h, échéance22:10UTC pour ce reçu). Arrêt si dérive ; après réponse distante perdue, relire avant mutation. Rollback des seules définitions/ACL capturées selon helpers T01 et état attendu, en ordre inverse des changements concernés ; ne pas écraser les écritures récentes avec un vieux dump. Rollback image et SQL sont distincts. Auth sauvegardée comme IDs de fixture seulement ; archive blobs non gelée transactionnellement : restauration totale identité+objets **NON TESTÉE**.

## Limites et livraison

**PASS** nouvelle jointure API/SQL,29 scénarios T03 invariants,annulation T07 intégrée,TS/lint ciblés. **FAIL restant T03 : aucun démontré.** Les deux erreurs initiales du nouveau banc et son warning ESLint sont conservés puis corrigés. **BLOQUÉ externe :** intégration/ACK du présent commit par T01/T08 ; qualification release globale indépendante (T01 a suspendu promotion après le défaut admin/webhook signalé par T02). Aucun correctif hors ownership.

**NON TESTÉ** production du candidat, transport Supabase/PostgREST distant, crash réel infrastructure, arrêt/remboursement fournisseur, génération facturée, GPU, stockage physique corrompu, publication réelle, parcours navigateur→API→base→fournisseur réel. Les quotas applicatifs ne prouvent pas la facture fournisseur. L'annulation durable arrête les futures prises du job ; elle ne prouve pas l'arrêt d'une opération distante déjà soumise. Le reçu T07 est persistant dans le même onglet (sessionStorage), pas une promesse de reprise multiappareil. Annulation `/create` et ordonnanceur autonome restent hors contrat livré selon T01/T07.

Préservation :1746 fichiers WIP T01 comparés,1745 inchangés ; seul son journal CI `ci-cb3f893-watch.txt` évolue, aucun fichier manquant. Aucun fichier T01 écrit par T03. Basecb confirmée. Clusters privés arrêtés sans supprimer les données/preuves ; aucune réservation fictive ouverte. Aucun secret lu, réseau fournisseur, push, fusion, migration distante, modèle Mac ou déploiement.

GitNexus : impacts avant création/ajustement, contexte exact cancel puis index local propre et analyse du delta avant commit. Runner réutilisé LOW/1appelant/0processus recensé, mais onze sites non résolus. Nouvelle fixture UNKNOWN (fichier sans appelant recensé), jamais assimilé à risque nul. Dernier graphe453flux tronqué :1316entrypoints,665callees et3walks non couverts ; exhaustivité UNKNOWN. La portée est bornée par le diff Git QA/docs ; détails de la détection finale conservés avec les preuves.


## Contrôles finaux du delta

GitNexus `detect-changes --scope staged` :43fichiers/84symboles/453flux, **CRITICAL** signalé avant commit. Le graphe associe notamment le nom générique `query` du banc à des flux Community/Admin étrangers ; le diff exact ne modifie aucun produit. Comparaison `main` :4403fichiers/4778symboles, **CRITICAL**, liste plafonnée, historique complet du candidat et non notre seul delta. Ces résultats partiels ne certifient pas une absence exhaustive d'impact. `detect-staged.log` et `detect-main.log` restent bruts ; l'actualisation finale après ajout des preuves est également conservée.

Sécurité : scan Gitleaks du code nouveau **PASS, zéro alerte**. Deux scans de l'index (sans/avec logs) rendent chacun exit1 avec les **mêmes trois alertes** : les empreintes SHA256 de la fixture initiale, du rejeu et de la version finale. Reconstruction exacte des trois sources à partir des deux corrections de fixture et du paramètre inutilisé supprimé ; comparaison aux reçus et aux lignes LF du diff scanné : **PASS après triage**, aucun secret. `gitleaks-triage.json` conserve les SHA des entrées scannées, classe chaque alerte ; les rapports expurgés et codes rouges bruts sont préservés. Portée : delta local scanné, pas configuration distante.

```sh
git diff --cached --no-ext-diff -- qa/t03-final-candidate-20261015/api-postgres.test.mts qa/t03-final-candidate-20261015/run.mjs qa/t03-final-candidate-20261015/settle.mjs | gitleaks stdin --redact --no-banner --report-format json --report-path qa/t03-final-candidate-20261015/gitleaks-code-redacted.json
git diff --cached --no-ext-diff | gitleaks stdin --redact --no-banner --report-format json --report-path qa/t03-final-candidate-20261015/gitleaks-full-redacted.json
```

À20:26UTC, T01 confirme que ses nouveaux changements CAS du planning restent distincts : routes d'annulation et moteur inchangés. HEAD T01 relu avant clôture :cb3f893. Le présent lot ne certifie pas le WIP T01/T02/T07 ajouté après ce candidat ; contrôle futur limité aux changements intégrés affectant les empreintes listées.
