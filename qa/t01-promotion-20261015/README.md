# SUTRA — consolidation finale T01 du 15 octobre 2026

## Candidat et promotion

Candidat immuable **c7a7ebd876d36c521b1c30f6d487b7bb07f000a8**, branche `codex/sutra-final-providers-20261013`, poussé sans force. [CI exacte 38750974353](https://github.com/puramapro-oss/sutra/actions/runs/38750974353). Les reçus de cette consolidation remplacent les états de livraison anciens, sans effacer leurs échecs.

À 14:54 UTC : **CI complète SUCCESS**, qualité/contrats/base PASS sur le SHA exact. Certification indépendante T08 du nouveau SHA attendue : **INTEGRÉ / TESTÉ, PROMOTION BLOQUÉE**. Le SHA a été transmis dans le handoff commun à 14:23 UTC, complété avec les preuves puis avec la CI verte à14:54UTC. Le terminal T08 original est resté à sa livraison `99ad7a5` ; le contrôle automatique de Terminal a été refusé par l'outil. Relais utilisateur demandé, aucun ACK supposé. Aucune nouvelle autorisation utilisateur de déployer n'est nécessaire ; il manque la certification demandée au terminal T08 original.

Production encore **86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164**, https://sutra.purama.dev. Contrôle14:50UTC : healthy, zéro redémarrage, même image/démarrage ; accueil et login200 avec TLS vérifié. Reçu `runtime-c7-gate-wait.json`. Aucun des trois apply SQL, aucune promotion et aucune activation d'observateur de ce lot. Les corrections et leur validation locale/CI ne sont donc pas annoncées déployées.

Candidat OVH construit et arrêté, réseau `none` : image `sha256:18409ecf323fddcf5ed40396de86c8330c4d9561bd09056776bd4b54f42036da`, cinq smokes HTTP et FFmpeg PASS. Reçu exact : `../t01-final-20261015/candidate.json`. Les 1074 entrées du manifeste correspondent aux fichiers locaux et aux blobs du commit ; ce contrôle de provenance n'est pas un test fonctionnel.

## Livraisons et défauts rapprochés

| Propriétaire | Dernière livraison intégrée | Résultat démontré |
|---|---|---|
| T02 | `8c416290ebdabe9b0e8a1fa9708f537c8c0a45f5` | T02-RPC-02 : message SQL interne remplacé par une erreur publique bornée ; 19 tests RPC. |
| T03 | `6fe40857f793f0605488182dcd19924a76809c96` | 29 scénarios distincts de reprise/ACK/checkpoints ; aucun nouveau produit concurrent. |
| T04 | `db93ef04165cb6aee9a26bd6b6e732a6c6127a1b` | Saisie masquée et validation Salad non générative, 27 tests ; aucune clé invalide envoyée. |
| T05 | `f0bb470d9c8b987391afb3893288e73f7f2f30a2` | Trois exports CPU 4K synthétiques vérifiés et réutilisés, sans réencodage identique. |
| T06 | `3edae7ae1d3c13ed2b385a9602a9ad8da6ca5b6d` | T06-INTEGRATED-01 : CAS de révocation aligné sur le timestamp PostgreSQL canonique ; routes/SQL 9 PASS. |
| T07 | `cbcf17423f3890ea5a225a2fbcefe4da2c5af6da` | Recette ciblée 142 assertions et 39 analyses axe ; produit inchangé dans cette livraison. |
| T08 | `99ad7a54b9fa9ac49733485ce79df40d1ff01afa` | 112 PASS directs sur parent `72f406b`, 1188 contrôles de provenance distincts ; échec CI72f conservé. |

T02–T07 partent de `56754679abed9aa1e51323c29aed5bef38bc17d0`. T08 `99ad7a5` part de `72f406b940b7e3cdfb27873751a4059375646f25`. Les imports ont comparé les deltas/blobs et exclu les journaux append-only étrangers. Les preuves T08 ne constituent pas une certification automatique du descendant c7.

T01 a corrigé T06-INTEGRATED-02 dans la migration sociale canonique : révocation legacy permise seulement avec provenance/identité/profil strictement établis, aucune autorisation inventée ; 27 tests SQL et application/rejeu/rollback sur copie privée PASS. T08-HARNESS-01 sépare GET/HEAD et mutations ambiguës dans la garde navigateur, avec contrôles natifs et négatifs. La CI72f a ensuite montré une lecture fixture interrompue pendant la navigation sociale WebKit : barrière explicite document/réponse/corps terminés avant navigation, sans élargir le classificateur ni modifier le produit. Preuve locale production isolée : 20 PASS, contre-tests barrière : 18 PASS.

La matrice T08 la plus récente porte **74 exigences : 57 PASS, 2 FAIL liés au même échec CI72f, 2 BLOQUÉS, 13 NON TESTÉS**. Les quatre anciennes causes reproductibles sont fermées par les 112 contrôles T08 sur72f. La correction de la dernière cause CI est dans c7 ; sa certification exacte demeure à recevoir. R30 (ordonnanceur autonome) et R74 (annulation durable depuis l'UI /create) restent des fonctions indisponibles, pas des PASS supposés.

## Preuves de tests

Les groupes se recouvrent : ne pas additionner leurs compteurs.

| Commande ou groupe exact | Résultat constaté sur c7 |
|---|---|
| `npm run check` | PASS : typecheck, lint, build. |
| `npm run test:contracts` | Groupe principal 990 PASS / 0 FAIL / 7 SKIP ; soumission durable 18 PASS ; planification/composition/publication simulées PASS. |
| `npm run test:media` | Groupes 49/12/32/25/3/31 PASS, aucun FAIL/SKIP ; 17 exports CPU frais du lot final. |
| `node qa/t08/run.mjs redteam` | PASS. |
| `npm run test:migration-local` | PASS, PostgreSQL16 jetable. |
| `node --import tsx --test scripts/test-pipeline-postgres.mts` | 16 PASS. |
| `SUTRA_TEST_PG_BIN="$(pg_config --bindir)" node scripts/test-security-rls.mjs` | 261 assertions PASS. |
| `SUTRA_TEST_PG_BIN="$(pg_config --bindir)" node scripts/test-final-write-permissions.mjs` | 30 PASS. |
| `SUTRA_TEST_PG_BIN="$(pg_config --bindir)" node scripts/test-final-social-history.mjs` | 27 PASS. |
| `SUTRA_TEST_PG_BIN="$(pg_config --bindir)" node qa/t06-integrated-retest-20261015/run-postgres.mjs history` | 9 PASS. |
| `node --import tsx --test scripts/test-salad-persistence.mts` | 7 PASS. |
| `node --import tsx --test --test-concurrency=1 qa/t03-orchestration-fixes-20261014/finish-postgres.test.mts qa/t03-durable-reliability-20261014/postgres.test.mts qa/t06-social-recovery-20261014/test-postgres.mts qa/t01-final-20261015/durable-postgres.test.mts` | 46 PASS, aucun FAIL/SKIP. |
| `node --test qa/t01-final-20261015/browser-harness/guard.test.mjs qa/t01-final-20261015/browser-harness/social-read-barrier-20261015/barrier.test.mjs` | 90 PASS / 0 FAIL / 0 SKIP. |
| `node qa/t08/run.mjs browser-redteam` | 210 contrôles PASS,165analyses axe,0erreur navigateur. |
| `node qa/t07-frontend-fixes-20261014/browser.mjs --production` | 25 assertions PASS. |
| `node qa/t07-final-ux-perf-20261015/run.mjs --final-integrated` | 20 familles PASS,0FAIL : par moteur22/10/9/15/34/9/31/5/3/4assertions, Chromium/WebKit, une build. |
| `node scripts/run-ci.mjs legacy` | 1022 PASS / 0 FAIL / 25 SKIP,0flaky. |
| `python3 -m unittest discover -s deploy -p 'test_*.py'` | 77 PASS / 0 FAIL / 0 SKIP. |
| `python3 -m unittest discover -s qa/t01-consolidation-20261014 -p 'test_*.py'` | 25 PASS / 0 FAIL / 0 SKIP. |
| `python3 qa/t01-final-20261015/social-history-transition-test.py` | 12 PASS / 0 FAIL / 0 SKIP. |
| Simulation promotion exacte, commande inline du workflow | 8 PASS / 0 FAIL / 0 SKIP ; recouvre le groupe77. |
| `npm audit --omit=dev --audit-level=high` | PASS AU SEUIL HIGH ;2low/5moderate,0high/critical. |

Les 7 SKIP contrats préexistants sont quatre appels INSEE live, deux écritures DB live historiques et un appel OpenTimestamps. Les25SKIP legacy :10répétitions API hors desktop,1desktop-only,2mobile-only,6parcours limités par mur auth et6annotations sans description ; titres, projets et annotations exacts dans `ci-c7a7ebd-quality.json`. Aucun rouge transformé en skip. Les commandes et résultats bruts sont conservés dans la CI et les artefacts `ci-c7a7ebd-*` ; les fixtures ne sont pas des preuves fournisseur réelles. Les reçus JSON completed/quality/database/contract-counts fixent SHA, commandes, empreintes et compteurs distincts.

Les diagnostics navigateur bruts restent conservés ;0erreur inattendue sur20familles. Qualification WebKit limitée au banc synthétique, pas une certification Safari/iOS public. Les7alertes npm production de la chaîne OpenTimestamps et les alertes de développement qualifiées parT02 restent documentées, sans mise à jour forcée incompatible ni promesse de zéro vulnérabilité.

## Migrations, sauvegarde et rollback

Backup protégé `/opt/purama/apps/sutra/backup-t01-coherent-f91xwtcz`, 13:21:11 UTC : six artefacts, 141 tables restaurées et comptages égaux. Expiration de la gate de fraîcheur à17:21:11UTC. Auth complet/sessions et gel atomique des blobs ne sont pas couverts ; aucune restauration globale Supabase revendiquée.

Trois migrations testées sur copies privées, double application puis rollback vérifiés sans perte de données :

1. `20261015_final_durable_integrity.sql` — six fonctions durables ; SHA256 `e8befa9e9fa602d80c483245bc71d07831fe56aad9ee05ed83dc2261a1d7805c`.
2. `20261015_client_write_permissions.sql` — DML/colonnes/RLS ; SHA256 `3776c0c57fb83523c83a6ba4ada5d8cc55ccab8205765743bc527126ad340e6c`.
3. `20261015_social_authorization_history.sql` — historique atomique et révocation legacy stricte ; SHA256 `d2f6a9cb380a15285759085cdf602701f0d9d785d4a7f76f2061438d38ab9ddc`.

Après CI et ACK T08 exacts seulement, commandes déjà autorisées :

```sh
python3 qa/t01-consolidation-20261014/checkpoint-transition.py apply --source-ref c7a7ebd876d36c521b1c30f6d487b7bb07f000a8 --ci-run 38750974353 --proof-dir qa/t01-final-20261015
python3 qa/t01-final-20261015/client-permissions.py apply --source-ref c7a7ebd876d36c521b1c30f6d487b7bb07f000a8 --ci-run 38750974353
python3 qa/t01-final-20261015/social-history-transition.py apply --source-ref c7a7ebd876d36c521b1c30f6d487b7bb07f000a8 --ci-run 38750974353
python3 deploy/ovh.py deploy --source-ref c7a7ebd876d36c521b1c30f6d487b7bb07f000a8 --ci-run 38750974353 --schema-ready --proof-dir qa/t01-final-20261015
```

Rollback applicatif préparé, exécutable seulement après snapshot de cette promotion :

```sh
python3 deploy/ovh.py rollback --source-ref c7a7ebd876d36c521b1c30f6d487b7bb07f000a8
```

Si l'observateur a été installé, désactiver d'abord uniquement `purama-sutra-observer.timer`. Rollbacks SQL séparés par helpers et états attendus, sans écrasement intégral des données ; l'historique social créé est conservé. Issue SSH incertaine : inspecter le reçu protégé et le processus avant répétition ou compensation.

## Cron, fournisseurs et seuls essais réels restants

L'observateur de file est prêt/testé et strictement lecture seule ; aucun claim, appel HTTP, fournisseur ou dispatch. Son installation attend la promotion. Les workers générateurs et ordonnanceurs de publication restent désactivés. L'absence d'exécuteur et cette désactivation volontaire sont distinctes d'une mauvaise configuration.

Les contrôles runtime gratuits du précédent SHA ont authentifié RunPod health (clé limitée à l'endpoint, zéro worker), Shotstack stage/v1 templates, Suno via l'API tierce sunoapi.org et Zernio PURAMA avec ownership Matiss. Ils ne prouvent aucun rendu. Les pilotes de recontrôle depuis le nouveau runtime sont prêts ; non exécutés tant que ce runtime n'est pas déployé. Aucun secret affiché/copié au rapport.

Essais réels encore absents :

- Après promotion : santé/logs/base, nouvelles migrations, observateur, navigateur public desktop/mobile, session de recette à droits existants, GET fournisseurs et DNS/TLS. Ils restent à la charge de T01, sans génération/publication.
- Session personnelle et consentements légaux/OAuth des réseaux souhaités depuis https://sutra.purama.dev/settings/social ; [documentation Zernio](https://docs.zernio.com/guides/connecting-accounts). Aucun compte connecté ni consentement accepté automatiquement.
- Salad : clé master malformée au dernier contrôle T04, organisation/projet absents. Saisie masquée via `qa/t04-salad-access-20261015/Saisie-Salad.command`, valeurs depuis https://portal.salad.com/. L'image CUDA/GPU24Go, modèle, stockage durable et interruption réelle restent non qualifiés ; aucun démarrage avant budget chiffré autorisé.
- Génération/rendu fournisseur réels, consommation du budget et qualité IA, puis chaîne distante complète. Aucun HTTP200 ou test simulé n'est une preuve de génération. Publication réelle exclue de l'autorisation actuelle.
- Safari/iOS et lecteur d'écran sur appareil physique ; alertes délivrées/SLA distant ; restauration Supabase complète incluant auth/sessions et cohérence des blobs. Aucun résultat annoncé sur ces dimensions.

## Préservation et portée de certification

`preservation-c7a7ebd.json` conserve sept HEAD livrés, cinq commits historiques protégés et sept empreintes WIP étrangères inchangées. Les worktrees restent présents ; T02 conserve deux artefacts npm non suivis, les six autres worktrees livrés sont propres à ce contrôle. Aucun terminal fermé ni statut FERMABLE déduit d'un simple commit.

GitNexus impact/detect_changes exécutés avant les éditions/commit. Index partiel et comparaison historique main CRITICAL/tronquée explicitement signalés ; vérification directe des appels QA et blobs effectuée. Aucune certification exhaustive du graphe ou garantie zéro bug. Gitleaks staged PASS avec deux exclusions exactes de fixtures synthétiques, aucun secret ajouté.
