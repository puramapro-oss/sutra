# T03 — pipeline durable, livraison locale du 15 octobre 2026

**PASS local : 148 tests exécutés, 0 FAIL final, 0 SKIP**, TypeScript et lint ciblés. La proposition SQL est testée sur PostgreSQL 18 privé, arrêt confirmé. **BLOQUÉ pour intégration : port SQL canonique et réception du lot par T01, puis recette indépendante T08.** Aucun verdict de production ou de certification globale.

Base confirmée par le handoff T01 : `49c166d4c15412d2a3c1246c216cf0df319f2df0`, documentaire après le produit testé `3855665fa79e3cc2171124d864a834214d6ac617`. Les corrections T03 `47f6896` et `bfe5a0a` et la migration `20261014_durable_checkpoint_integrity.sql` étaient intégrées avant ce delta. Branche `codex/sutra-t03-final-durable-20261015`, worktree homonyme isolé. Le commit de livraison est celui contenant ce dossier ; son SHA exact est transmis dans le miroir coordinateur.

## Défauts reproduits et corrections

| Risque précis | Cause et correction | Preuve |
| --- | --- | --- |
| Faux résultat final / quota consommé sans résultat exploitable | Le worker et `finish_video_job` acceptaient tout résultat non nul. Contrat désormais lié aux checkpoints de chaque sous-étape ou à l'export final mesuré, aux scènes et aux pistes exigées. `assertFinalMedia` existant est réutilisé sans modification. SQL proposé équivalent. | `before-new.log` : 1 PASS/18 FAIL sur les 19 premiers cas ; `before-postgres.log` : 3 PASS/9 FAIL sur les 12 premiers cas. Après : 25 tests applicatifs et 20 SQL PASS. |
| Checkpoint pending figé, livraison concurrente ou écriture DB échouée | Promotion pending autorisée ; checkpoint terminal immuable ; livraisons identiques sérialisées ; mémoire modifiée seulement après ACK DB. Le storyboard dérivé du script acquis possède son ACK indépendant. | Promotion, conflit, 24 doubles livraisons, perte d'ACK storyboard, reprise sans régénérer le script. |
| Voix durable partielle/corrompue relancée ou acceptée | Vérification base64 canonique, manifeste entier, morceaux présents et SHA256 obligatoire pour les morceaux. SHA également écrit avant les nouveaux petits blocs. Tout fragment/intent incertain interdit une nouvelle synthèse. | Six corruptions, reprise des blocs valides, écriture du payload perdue, régressions 5/24 Mo. |
| Étapes optionnelles incompatibles et synthèse inutile | `all` normalise musique/images absentes en skipped ; anciens reçus vides complets restent immuables. Narration vide : zéro nouvelle voix ; une opération vocale antérieure reste réconciliée. | `before-final-review-new.log` : 24 PASS/1 FAIL ; après 25 PASS. |
| Retry immédiat après redémarrage / confusion avec états sociaux | Proposition SQL : backoff durable partagé entre claim ciblé et batch ; opérations incertaines ou tentatives épuisées mises en réconciliation ; RPC de génération limité aux états de génération. | Claims concurrents, 12 reprises, backoff 30 puis 60 s, épuisement, quota conservé, refus des états sociaux. |
| `ready` malgré scènes invalides ou audio acquis absent du média | Contrôle SQL ready aligné avec la fin de tâche : scènes non vides/non sentinelles, audio mesuré exigé dès qu'une piste existe, même optionnelle. | `before-final-review-postgres.log` : 18 PASS/1 FAIL ; après 20 PASS. |
| T08-CANCEL-01 : diagnostic SQL exposé / faux ACK d'annulation | `cancelJobByKey` expurge SQL et transport et exige un booléen explicite ; ACK perdu/invalide = erreur, même clé réessayable sans libération supplémentaire. | Copie inchangée du test T08, provenance `cancellation-source.txt` : 3/1 → 4/0 ; ACK/transport : 1/8 → 9/0. |

Les premiers passages intermédiaires sont conservés. Les journaux ont seulement leurs espaces de fin de ligne et lignes vides finales normalisés ; les empreintes du manifeste correspondent à cette forme. Six anciennes fixtures de `test-t03-orchestration-fixes.mts` fournissaient des résultats incompatibles avec leur type de job : seules ces données ont été adaptées, assertions conservées (63/6 → 69/0). Les erreurs intermédiaires de types/fixtures sont résolues. Le premier runner PostgreSQL avait échoué en écrivant son manifeste après les tests : son journal rouge est conservé, aucun code de sortie inventé pour ce manifeste absent.

Le contre-test de dimensions fractionnaires confirme un refus SQL déjà présent. Son premier oracle exigeait un code applicatif alors que PostgreSQL renvoyait `invalid input syntax for type integer` ; cet oracle a été corrigé pour reconnaître les deux refus. **Ce n'est pas un défaut produit corrigé**, et aucune modification SQL supplémentaire n'en découle (`before-dimension-postgres.log`).

## Commandes exactes et résultats

Depuis ce worktree, Node 26 et dépendances identiques à T01 (symlink existant réutilisé). `verify.py` lance les commandes indiquées dans les reçus JSON, avec environnement synthétique et garde hors réseau : secrets, sockets et processus média interdits. Le runner PG n'autorise que son cluster privé loopback, sans identifiants ambiants.

| Commande | Résultat final | Périmètre |
| --- | --- | --- |
| `python3 qa/t03-final-durable-20261015/verify.py new` | 25 PASS | Résultats, étapes, storyboard, concurrence, voix, optionnels. |
| `python3 qa/t03-final-durable-20261015/verify.py affected` | 69 PASS | `test-pipeline-interruptions.mts` 17 ; `test-t03-durable-reliability.mts` 12 ; `test-t03-orchestration-fixes.mts` 35 ; `test-production-queue.mts` 5. |
| `python3 qa/t03-final-durable-20261015/verify.py salad_recovery` | 16 PASS | Worker réel avec transport simulé : timeout après POST, réponse perdue, lease expiré, remplaçant concurrent, checkpoints et ACK perdus. |
| `python3 qa/t03-final-durable-20261015/verify.py auto_export` | 5 PASS | Export/AUTO et gros checkpoints vocaux. |
| `python3 qa/t03-final-durable-20261015/verify.py cancellation` | 4 PASS | Tests HTTP T08 copiés sans modifier son worktree. |
| `python3 qa/t03-final-durable-20261015/verify.py cancel_ack` | 9 PASS | ACK booléen, réponses malformées et erreurs transport. |
| `node qa/t03-final-durable-20261015/postgres.mjs` | 20 PASS | Transactions SQL réelles, 12 connexions concurrentes, proposition appliquée deux fois sur fixture. |
| `python3 qa/t03-final-durable-20261015/verify.py typecheck lint` | PASS / PASS | Trois fichiers produit, tests T03 modifiés et nouveaux tests QA ; zéro avertissement lint. |

Les 5 tests `cancel_regression` sont déjà dans les 69 : ne pas les additionner. Les tests T06 réutilisés et les rejeux rouge/vert ne sont pas ajoutés aux 148. Les reçus `after-*.json` donnent commandes, exit codes et empreintes. `auto_export` précède seulement les deltas annulation et narration vide, vérifiés séparément ; les tests d'annulation précèdent seulement le delta narration vide. Les autres tests applicatifs et SQL sont sur leurs fichiers finaux. Aucun build/gate globale inchangée rejoué : le build historique reste celui de 3855665, pas une preuve du candidat à venir.

## Machine d'états et checkpoints

Autorité des jobs : CHECK SQL de `video_jobs`, fonctions transactionnelles existantes et proposition ci-jointe. Les états métier de vidéo et le journal social restent des projections distinctes ; pas de deuxième orchestrateur.

| Transition du job | Conditions et budget |
| --- | --- |
| soumission → queued | Clé logique unique, réservation atomique existante. Double livraison partage la tâche. |
| queued → processing | Backoff écoulé ou première tentative ; un seul claim, lease et nombre d'essais persistés. |
| processing expiré → processing | Nouveau propriétaire ; chaque écriture de l'ancien propriétaire est refusée. Un intent distant acquis ne permet pas de nouveau POST. |
| processing → queued | Échec réessayable connu, quota réservé conservé ; backoff proposé 30/60/120/240/480/900 s. |
| processing → reconciliation_required | Réponse distante incertaine ou essais épuisés ; résultats acquis et réservation conservés. Aucune relance automatique payante. |
| processing → done | Lease courant, résultat final conforme ; consommation unique dans le mois de réservation. Échec SQL = rollback, résultat conservé et reprise du règlement seulement. |
| processing → failed | Échec définitif confirmé ; libération unique. |
| queued/processing/reconciliation_required → cancelled | RPC atomique existant ; libération unique, aucune écriture tardive. Un ACK perdu reste une annulation non confirmée jusqu'à relecture/répétition sûre. |
| done/failed/cancelled | Aucun claim automatique ; réconciliation explicite nécessaire hors chemin terminal. |

`videos` génération : draft/generating/ready/failed. `sutra_auto_videos` génération : planning/generating_script/generating_video/generating_audio/compositing/ready/pending_approval/failed, tous testés contre les contraintes SQL. `compositing_failed` est refusé par le CHECK et par le RPC proposé ; le code courant utilise failed et conserve les acquis. Pas de réécriture historique présumée nécessaire sans inventaire T01. Les transitions intermédiaires peuvent être rejouées à partir des checkpoints ; aucune monotonie artificielle n'est ajoutée.

Checkpoints indépendants : script → storyboard dérivé → scènes individuelles/collection → images → voix → musique → sous-titres → composition → export. Chaque résultat est conservé avant passage suivant ; interruption avant/après intent, résultat ou ACK testée. Les étapes facultatives portent skipped explicitement. Les anciens reçus finaux à huit étapes restent lisibles ; le storyboard manquant est dérivé à la reprise d'un script, sans appel fournisseur, sans réécrire les anciens jobs terminés.

Publication : `stage:publication` pending est un passage de relais, jamais une réussite de publication. Le journal T06 par identité de production/plateforme/compte conserve les résultats, réconcilie les inconnus et ne réessaie que les destinations explicitement échouées ; les succès restent acquis. `partially_published` reste social, n'est jamais rétrogradé par un rejeu de génération. Preuve **PASS réutilisée** : `publication-proof-reuse.json` compare 25 fichiers, dépendances statiques/tests/config inclus, identiques au candidat CI3855665 ; tests partiels, reprise GET sans POST et historique réparable de `test-social-publication.mts`. Aucune modification T06, aucun verdict sur son nouveau lot OAuth du 15 octobre.

## Proposition SQL à T01

`proposal-final-durable.sql` remplace quatre fonctions : `finish_video_job`, `claim_video_job_by_key`, `claim_video_jobs`, `persist_video_job_video` ; ajoute le prédicat pur `video_job_result_valid`. Aucune table, colonne ou valeur d'enum ajoutée, aucune donnée historique réécrite. Le nouveau helper n'est pas accessible à PUBLIC ; les ACL des fonctions remplacées sont conservées. Proposition uniquement, **aucun fichier migration canonique modifié et aucune production appliquée**.

T01 doit porter ce SQL dans une migration canonique, contrôler ACL/définitions/rollback sur sa copie de référence, et adapter ses fixtures terminales devenues invalides (`qa/t03-orchestration-fixes-20261014/finish-postgres.test.mts`, `qa/t03-durable-reliability-20261014/postgres.test.mts`, `scripts/test-security-rls.mjs`). Ces fichiers sont restés intacts. La proposition et le produit forment un lot d'intégration commun ; ne pas annoncer la protection SQL avant son application vérifiée. Le choix du backoff est livré pour revue T01 ; aucun délai métier absolu d'expiration des jobs n'a été inventé.

## Ownership, impact et limites

Réservations exactes `FINAL-DURABLE`, `FINAL-DURABLE-DELTA`, `FINAL-DURABLE-FIXTURES`, `FINAL-DURABLE-CANCEL` dans les deux LOCKS racine. Policy-check PASS au démarrage. `preservation-final.json` : HEAD T01 inchangé, 100/100 fichiers surveillés identiques, aucun disparu. Adaptateurs T04, validation/montage T05, réseaux T06 et configurations non modifiés.

GitNexus avant modification : `checkpointStage` CRITICAL, 6 appelants directs/5 processus ; `hasCompletedJobResult` CRITICAL, 2/5 ; `executeProductionStep` CRITICAL, 2/5 ; `runAssembly` CRITICAL, 1/5 ; voix LOW, 2/1 ; annulation LOW, 1/1 (route production). Avertissement communiqué. SQL non indexé : UNKNOWN, lecture directe et preuve PG. Index final tronqué (1182 entrées et 677 callees omis, 3 coupes budget) : exhaustivité UNKNOWN. Analyse staged avant commit :87 fichiers/77 symboles/366 flux, CRITICAL ; elle inclut les helpers de tests homonymes comme `createServiceClient`, tandis que le diff produit reste limité aux trois fichiers réservés. Comparaison demandée à main :2747 fichiers/3027 symboles, liste plafonnée ; elle comprend toute l'intégration historique, ne représente pas le delta T03. Revue directe des chemins/symboles et tests ciblés, sans extrapolation de couverture. Reçus CLI `gitnexus-detect-*.txt`.

**FAIL finaux sur les tests exécutés : 0. BLOQUÉ : intégration SQL/T01 et ACK indépendant T08. NON TESTÉ : transport PostgREST/DB distante, fournisseurs réels, GPU, paiement, publication/consentement, ordonnanceur continu, charge/SLA, rollback de production et nouveau build global.** La réservation testée est le quota mensuel vidéo, pas un débit financier fournisseur. Annulation locale ne prouve ni arrêt distant ni remboursement. Un ancien bloc vocal sans SHA permet seulement de contrôler sa syntaxe, pas son authenticité historique. Les erreurs inconnues sont conservées pour réconciliation : disponibilité parfois bloquée afin d'éviter une seconde dépense.

Aucun secret lu, affiché ou copié ; aucune requête fournisseur, génération facturée, IA Mac, publication, fusion, push ou déploiement. La clôture est locale et bornée aux risques ci-dessus, sans promesse de zéro bug.
