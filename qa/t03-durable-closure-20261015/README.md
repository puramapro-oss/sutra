# T03 — clôture durable sur le candidat T01, 15 octobre 2026

**PASS LOCAL : zéro défaut produit démontré restant dans les parcours contrôlés.** Ceci ne garantit pas l'absence de tout bug. Livraison exclusivement QA/documentation ; aucune modification produit, migration canonique ou adaptateur. Branche `codex/sutra-t03-durable-closure-20261015`.

## Base réconciliée avant écriture

- HEAD T01 confirmé `56754679abed9aa1e51323c29aed5bef38bc17d0`, produit testé `d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2`, CI T01 `38677062190` verte. Le delta entre ces deux SHA est documentaire.
- Les trois blobs produit T03 de `ee3f7017da762c72163440706064ad08df84f761` sont identiques au candidat : `video-queue.ts`, `pipeline-state.ts`, `production-pipeline.ts`. Les corrections de musique désactivée, reçus invalides, checkpoints voix corrompus et ACK SQL sont donc déjà intégrées.
- T01 a porté la proposition dans `migrations/20261015_final_durable_integrity.sql` et adapté les anciennes fixtures SQL. L'ancien handoff « migration/intégration en attente » est remplacé sur ces points par ce constat. Preuve : `integration-source-manifest.json`.
- AGENTS, politique, LOCKS et handoffs lus ; `POLICY_OK`. Claim `SUTRA-T03-20261015:DURABLE-CLOSURE`. T01 seul conserve le SQL canonique, T04/T05/T06 restent intacts. 49 fichiers WIP T01 inventoriés inchangés ; ce nombre ne prétend pas couvrir récursivement les répertoires non suivis.

## Tests exacts et résultats

Environnement nettoyé : uniquement PATH/HOME/TMPDIR et paramètres synthétiques. Aucun `.env` chargé. PostgreSQL 18.4 privé sur loopback, port aléatoire, garde `qa/t08/offline.cjs` contre sockets externes et lecture de secrets. Aucune requête fournisseur. Les seules soumissions simulées sont des compteurs en mémoire.

| Contrôle | Résultat et preuve |
|---|---|
| Nouvelle fixture cumulative SQL + reprise | **10 PASS / 0 FAIL / 0 SKIP**, `postgres-new.log/json` |
| Fixtures T01 réellement intégrées : checkpoints + finish/ACK | **19 PASS / 0 FAIL / 0 SKIP**, partie correspondante de `postgres.log/json` (13 + 6) |
| TypeScript ciblé | **PASS**, `types.log` |
| ESLint des trois nouveaux fichiers exécutables | **PASS**, `lint.log`, zéro warning |
| Secrets du diff livré | **PASS**, gitleaks expurgé, zéro finding, `gitleaks-redacted.json` |
| Réservations de fixture | **PASS**, quatre bases à `reserved=0`, `initial-fixture-settlement.log` et `settlement-new.log` |
| Préservation source et WIP T01 | **PASS**, manifestes d'intégration et préservation |

Premier passage : **29 tests, 27 PASS / 2 FAIL**. Les deux FAIL appartenaient au nouveau banc : comparaison `undefined`/`{}` après rollback d'un premier checkpoint, et diagnostic attendu trop générique au lieu de `SUTRA_FINAL_MEDIA_PROOF_REQUIRED`. Les deux corrections concernent uniquement les assertions. Rouge conservé (`before-fixture-correction-*`, également `postgres.log/json`). Rejeu des seuls dix tests modifiés : tous PASS. **Ne pas additionner le rejeu aux 29 tests distincts.**

Commandes exécutées :

```sh
# Premier runner, initialement sans sélecteur : les 3 fichiers ci-dessous.
node qa/t03-durable-closure-20261015/run.mjs
# Commande enfant exacte, environnement synthétique créé par le runner :
node --import tsx --test --test-concurrency=1 qa/t03-durable-closure-20261015/postgres.test.mts qa/t03-orchestration-fixes-20261014/finish-postgres.test.mts qa/t03-durable-reliability-20261014/postgres.test.mts
# Après correction des deux assertions : seuls les nouveaux tests.
node qa/t03-durable-closure-20261015/run.mjs new
./node_modules/.bin/tsc -p qa/t03-durable-closure-20261015/tsconfig.json
./node_modules/.bin/eslint qa/t03-durable-closure-20261015/postgres.test.mts qa/t03-durable-closure-20261015/run.mjs qa/t03-durable-closure-20261015/settle.mjs --max-warnings 0
```

Le runner final accepte `new` (défaut), `integrated` (19 tests existants), `all` (29 tests distincts). Pour T01, si un delta pertinent justifie une nouvelle recette : `node qa/t03-durable-closure-20261015/run.mjs all`. Ne pas lancer directement la commande enfant contre une base existante ; le runner crée et arrête son cluster privé. Binaire Homebrew configurable uniquement par modification explicite du banc sur une autre machine.

Le premier cluster a été rouvert uniquement pour annuler ses 15 jobs synthétiques laissés ouverts par les anciennes fixtures, vérifier tous les compteurs puis l'arrêter. Premier redémarrage refusé par PostgreSQL faute de `LC_ALL=C` dans l'invocation manuelle ; diagnostic conservé, corrigé dans l'invocation seulement. Le runner fixe déjà `LC_ALL=C`. Aucun test vert rejoué lors de cette clôture.

## Risques précisément exercés

- Migration cumulative directement après v11, sans dépendre du patch du 14 octobre ; double rejeu, puis comparaison des six définitions/ACL avec le chemin historique v11 → 14 octobre → canonique. Jobs, checkpoints et compteurs inchangés par les rejeux.
- Douze livraisons du même intent : un job et une réservation ; conflit de hash refusé. Douze intents distincts avec quota un : un seul admis. Échec de création de ligne vidéo : transaction complète annulée, aucune réservation orpheline.
- Panne SQL à chacune des dix frontières script, storyboard, scènes, images, voix, musique, sous-titres, composition, export, publication : mémoire non avancée sans ACK et acquis conservés au redémarrage. Storyboard testé séparément après script déjà durable.
- Échec SQL avant intention : zéro soumission. Résultat durable mais ACK perdu : reprise depuis SQL, une seule soumission simulée.
- Musique en timeout après vidéo acquise : budget et vidéo conservés ; seconde soumission bloquée ; réconciliation d'un identifiant distant existant via une seule lecture simulée.
- Annulation sans ledger : échec SQL et rollback intégral. Ledger synthétique restauré : douze annulations concurrentes, un règlement. Annulation du mois précédent sans toucher un autre job du mois courant.
- Résultat explicitement non vérifié : refus de `done` et `ready`, checkpoints acquis immuables. Musique explicitement désactivée : résultat `null` valide, un seul débit après expiration de lease et élection concurrente d'un nouveau propriétaire.
- Rejeu des deux fixtures T01 adaptées : arrêt réel d'un processus worker puis remplacement, dix étapes conservées, conflit de résultats, backoff/exhaustion, état SQL, pistes requises, ACK perdu, annulation concurrente avec finish, panne du ledger.

## Transitions et migration à T01

| Domaine | Contrat conservé |
|---|---|
| Job | `queued → processing → done / failed / queued / reconciliation_required` |
| Annulation | `queued / processing / reconciliation_required → cancelled`, règlement atomique unique |
| Retry | Backoff durable 30, 60, 120…900 s ; lease expiré permet une nouvelle prise, ancien propriétaire rejeté ; tentatives épuisées vers `reconciliation_required` |
| Incertitude distante | Acquis + réservation conservés, pas de resoumission automatique ; lecture de l'opération connue avant progression |
| Génération auto | `planning`, `generating_script`, `generating_video`, `generating_audio`, `compositing`, `failed` ; `ready`/`pending_approval` soumis aux preuves finales et pistes requises |
| Ancien état | `compositing_failed` rejeté par RPC/CHECK ; état canonique `failed`, acquis conservés |
| Checkpoints | `pending → complete / skipped` ; terminal immuable ; résultat lié aux étapes et au média exporté validé |
| Publication | Checkpoint génération `pending`, relais au journal par compte T06 ; aucun changement social dans ce lot |

**Migration déjà canonique :** `migrations/20261015_final_durable_integrity.sql`, SHA-256 `e8befa9e9fa602d80c483245bc71d07831fe56aad9ee05ed83dc2261a1d7805c`. Six fonctions finales : `checkpoint_video_job_v2`, `video_job_result_valid`, `finish_video_job`, `claim_video_job_by_key`, `claim_video_jobs`, `persist_video_job_video`. Aucun changement de table/colonne/enum ni transformation des anciennes lignes. **Aucune nouvelle migration proposée : ne pas réappliquer séparément l'ancienne proposition QA.** T01 reste seul responsable de l'application autorisée ; ici application en cluster jetable seulement, production NON APPLIQUÉE par T03.

## Limites et clôture

**FAIL restant : aucun dans le périmètre démontré. BLOQUÉ :** aucune correction T03 locale ; ACK indépendant/release relève de T01/T08, pas de ce banc. **NON TESTÉ ici :** transport DB distant, corruption réelle de stockage, GPU/fournisseurs facturés, disponibilité permanente, publication réelle, production. La preuve d'invalidation concerne les reçus non vérifiés/malformés ; la revalidation physique des octets reste T05. Les quotas applicatifs ne prouvent ni facturation ni remboursement du fournisseur. L'annulation n'est pas une preuve d'arrêt du fournisseur.

Publication partielle/par compte : aucun changement T06 ; preuve actuelle de CI T01 `d21b7b4` conservée, pas de réemploi aveugle de l'ancien reçu `3855665`. Suites globales/builds inchangés non relancés. Aucun secret lu, push, migration distante, fusion, calcul de modèle sur Mac ou déploiement.

Toutes les réservations de ce banc sont réglées, clusters arrêtés sans effacer les preuves/données. Cette annulation explicite de fixtures **n'est pas une politique de libération automatique des opérations réelles incertaines**. Les claims T03 seront clôturés dans les deux LOCKS au commit ; ils ne transfèrent pas le scope des autres terminaux.

GitNexus : graphe propre au worktree, impacts/détection conservés. La couverture de processus est tronquée ; exhaustivité UNKNOWN. Aucun symbole produit modifié. L'impact initial du nouveau runner non encore indexé était UNKNOWN, jamais présenté comme risque nul. La détection staged classe le delta faible (0 processus affecté recensé). La comparaison à `main` est CRITICAL sur 3482 fichiers de tout l’historique intégré, sans attribution à ce delta. Le dernier index signale aussi une recherche FTS dégradée (UTF-8 invalide) ; aucune exhaustivité revendiquée. Le diff Git exact borne ce lot à QA/docs. `git diff --check` est vert hors logs bruts : les espaces de rendu des assertions et lignes vides finales y sont conservés à l’identique.
