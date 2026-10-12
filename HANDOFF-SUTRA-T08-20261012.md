# HANDOFF SUTRA T08 — QA RED TEAM — 2026-10-12

**RELEASE_CERTIFICATION = BLOQUE.** Base auditée : `6a64fba103a084c71ecbfd1a07af53076af097c6` (S5), branche `codex/sutra-t08-qa-redteam-20261012`, worktree `/Users/matissdornier/purama-worktrees/sutra-t08-qa-redteam-20261012`.

Résultat local : **46 cas, 25 PASS, 21 FAIL**, dont handlers/infrastructure **23 PASS / 17 FAIL** et navigateur **2 PASS / 4 FAIL**. Aucune qualification PR3, fournisseur, DB distante, média réel ou release. Les FAIL sont conservés comme assertions de régression, pas masqués en échecs attendus. Commit local demandé explicitement pour remettre ces tests rouges aux propriétaires.

## Coordination et périmètre

AGENTS, POLITIQUE-GLOBALE, contrôle démarrage `POLICY_OK`, LOCKS racine et `.coord`, plans, brief, ERRORS, intégration S5 et handoffs existants inspectés avant création. Worktree créé depuis la base propre S5 ; WIP principal `renfort/r4-sutra-smart-split-double-effects@8ff4fd26` et autres worktrees préservés. Réservation T08 dans LOCKS racine. Aucun reset, stash, clean, suppression de worktree ou reprise du travail d'autrui.

Coordination T01 relue en cours de mission : cible canonique PR3 `7088a0a3e733de8d2e85f3576bd86627127da369`. Son instruction pour un WIP S5 déjà commencé est de préserver ce WIP et remettre uniquement un delta revu. Cette livraison est donc **preuve S5 séparée**, candidate à adaptation PR3, et non certification PR3. T01 conserve CI/dépendances/intégration ; T02 sécurité ; T03 orchestration ; T04 providers ; T05 médias ; T06 autonomie ; T07 UI. Aucun fichier produit modifié et aucun contrat produit changé.

Ajouts livrés : `qa/t08/**`, ce handoff, `BATON.md`, append `task_plan.md`. Dépendances réutilisées sans installation via symlink vers `sutra/.worktrees/a7-sutra/node_modules`. Aucun appel payant, publication réelle, migration, déploiement, push ou secret lu. Toutes les valeurs d'authentification et canaris des tests sont synthétiques.

## Matrice des exigences

PASS signifie uniquement la preuve bornée décrite, jamais une certification globale.

| Exigence | Statut | Preuve et limite |
| --- | --- | --- |
| Connexion, refus mauvais mot de passe, dashboard | PASS | B01 navigateur réel, GoTrue simulé ; fournisseur auth réel NON TESTE |
| Création authentifiée et refus sans session | PASS | 01–02, vrais handlers, DB/queue/providers simulés |
| Quota épuisé bloque génération | PASS | 03, réponse du service quota simulée |
| Réservation/remboursement quota | FAIL | 04–05, retours anticipés 402/500 gardent la réservation |
| Budget/accord hybride | FAIL | 16 concurrence ; B02 gate UI vérifiée mais génération ne part pas après accord |
| Génération simulée, checkpoints, reprise scène | PASS | 01/08/09, vrai pipeline, providers/montage remplacés |
| Ownership worker, doubles requêtes | FAIL | 06–07, génération sans claim et deux créations pour une même intention |
| Montage et édition sous-titres UI | PASS | B03, édition transmise à export ; rendu média réel NON TESTE |
| Export durable et versionnement concurrent | FAIL | 13–15, faux succès DB et numéros doublés |
| Validation manuelle | FAIL | 19 nominal PASS, 23 transition concurrente écrasée |
| Planification/configuration/DST | PASS | 19/20/36, calendrier local et validation payload ; déclenchement cron réel NON TESTE |
| Publication simulée et reprise partielle | FAIL | 19/24/25 PASS, 27–28 faux succès d'acquittement / panne DB classée permanente |
| Parcours complet continu création → publication | FAIL | B02 bloque ; segments standard/auto séparés, raccord durable NON TESTE |
| Pannes DB et erreurs partielles | FAIL | 05/13/14/27/28 ; 17/26 refusent correctement |
| Timeouts / annulation | FAIL | 08/09/31 PASS, 40 logger suspendu sans échéance locale |
| Concurrence / idempotence | FAIL | 07/15/16/23 ; modèle DB en mémoire, contraintes SQL NON TESTE |
| Reprise après interruption | PASS | 08 scènes manquantes, 25 plateformes échouées, 35 runs orphelins |
| IDOR applicatif sur vidéos/versions/publication | PASS | 11/12/21/22, propriétaires distincts injectés |
| Isolation RLS/organisations, stockage signé réel | BLOQUE | Pas de DB réelle qualifiée ; aucun SQL/migration autorisé dans cette mission |
| SSRF pré-requête du downloader | FAIL | 30, loopback/privé/metadata/IPv6 atteignent fetch intercepté |
| SSRF DNS rebinding / redirections réelles | NON TESTE | Réseau distant interdit, aucune simulation promue en preuve DNS |
| CSRF au handler create authentifié | FAIL | 39 accepte Origin étranger + text/plain ; exploitation navigateur/cookies NON TESTE |
| XSS titre éditeur | PASS | B03 texte littéral et absence du canari exécuté ; autres sinks NON TESTE |
| Cron auth fail-closed | PASS | 29 : 64 jetons refusés, jeton exact accepté, secret absent 503 |
| Câblage de tous les crons / planification déployée | NON TESTE | Gate historique non rejouée ; aucun déclenchement réel |
| Secrets dans réponses et logs | FAIL | 10/34 canari synthétique renvoyé/journalisé brut |
| Absence de secrets réels dans dépôt/infra | NON TESTE | Aucun `.env*` ni secret inspecté ; ce lot ne certifie pas leur inventaire |
| Observabilité / corrélation / réconciliation | FAIL | 32/35 PASS ; 33 statut terminal réécrit, 34 fuite, 40 attente non bornée |
| Charge raisonnable locale | PASS | 24 : 8 workers, 32 vidéos, 64 publications, 240 opérations du modèle, environ 3 ms |
| Accessibilité WCAG automatisée | FAIL | Axe mobile : contrastes + noms de boutons/selects/sliders manquants |
| Responsive horizontal à 390 px | PASS | Trois vues : scrollWidth = clientWidth = 390 |
| Clavier complet / lecteur d'écran | NON TESTE | Axe ne prouve pas ces parcours |
| Performance production / Core Web Vitals / DB charge | NON TESTE | Mesures locales de développement seulement |
| Certification release PR3/T01 | BLOQUE | Delta non intégré, défauts S5 à réconcilier, preuves externes absentes |

## Défauts reproductibles à remettre aux propriétaires

Reproduction backend : `node qa/t08/run.mjs contracts --test-name-pattern=T08-NN`. Tous les cas appellent les sources produit réelles à la base indiquée. Attendu = invariant porté par l'assertion. Aucun défaut n'est affirmé déjà présent sur PR3 sans requalification.

| ID / priorité | Propriétaire destinataire | Localisation S5 | Attendu → constat |
| --- | --- | --- | --- |
| 04–05 / P1 | T03, revue T01 quota | `src/app/api/create/route.ts:41` | Quota libéré si aucun job ne part → réservation conservée après accord absent ou INSERT DB échoué |
| 06 / P1 | T03 | `src/app/api/create/route.ts:126` | Sans claim, zéro travail → deux visuels générés et assemblage exécuté |
| 07 / P1 | T03 | `src/app/api/create/route.ts:85` | Même Idempotency-Key simultanée → deux vidéos distinctes ; protection queue interne insuffisante pour cette entrée |
| 10 / P1 | T02 + T03 | `src/app/api/create/route.ts:173` | Erreur publique expurgée → `Bearer T08_SYNTHETIC_CANARY_ONLY` dans les détails |
| 13–14 / P1 | T03 orchestration export, T05 contrat | `src/app/api/video/export/route.ts:128` | Échec UPDATE/INSERT signalé → HTTP 200 malgré l'erreur DB retournée |
| 15 / P1 | T03 + T01 DB | `src/app/api/video/export/route.ts:146` | Versions distinctes/transaction → deux versions numéro 1 dans le modèle sans contrainte SQL |
| 16 / P1 | T02 + T03 | `src/lib/hybrid-approval.ts:70` | Un seul consommateur → huit validations réussissent ; UPDATE sans compare-and-swap |
| 23 / P1 | T06 + T03 | `src/app/api/auto/videos/[id]/route.ts:71` | Transition worker préservée → `publishing` devient `ready` après lecture ancienne |
| 27 / P1 | T06 | `src/lib/autonomy/publisher.ts:257` | Acquittement durable exigé → résultat succès malgré `{error}` du RPC finish |
| 28 / P1 | T06 | `src/lib/autonomy/publisher.ts:295` | Erreur DB réessayable → contenu considéré absent, échec permanent |
| 30 / P1 | T02, contrat T05 | `src/lib/ffmpeg-io.ts:126` | Refus URL privée avant I/O → quatre URLs dangereuses atteignent le fetch stub ; zéro vraie requête |
| 33 / P2 | T06 + T08 observabilité | `src/lib/autonomy/observability.ts:26` | Premier terminal immuable → `ok` écrasé par second `error` |
| 34 / P1 | T02 + T06 | `src/lib/autonomy/observability.ts:45` | Redaction erreur libre → canari Bearer brut sur stdout |
| 39 / P1 | T02 + T03 | `src/app/api/create/route.ts:17` | Requête simple cross-origin rejetée → HTTP 200, effets métier simulés ; exploit cookie réel à confirmer |
| 40 / P2 | T06 + T08 observabilité | `src/lib/autonomy/observability.ts:19` | Logger ne bloque pas le cron → promesse pendante quand transport DB suspendu ; garde 50 ms diagnostique |
| B02 / P1 | T07 + T03 consommateur | `src/app/(dashboard)/create/page.tsx:112`, `src/hooks/useVideoGeneration.ts:179` | Confirmer déclenche create → zéro appel, « Plan validé » désactivé et erreur « Plan non valide ». Le callback appelle startGeneration avec l'ancien état React ; diagnostic cohérent avec la trace navigateur |
| A11Y / P1 | T07 | login/create/editor mobile | Voir sélecteurs dans `qa/t08/evidence/results.json` ; boutons sans nom, selects/sliders sans label, contrastes insuffisants |

Le fichier observabilité participe au lot autonomie actif ; T08 remet ses défauts sans éditer ce produit partagé. T01 arbitre les corrections transversales, notamment quota/DB/export. Aucun transfert d'ownership implicite.

## Gates et preuves

- Contrats : `node qa/t08/run.mjs contracts`, **23 PASS / 17 FAIL**, zéro skip, TAP joint. Charge en mémoire bornée, aucune charge distante.
- Navigateur : `T08_CHROMIUM=.../chromium_headless_shell-1217/.../chrome-headless-shell node qa/t08/run.mjs browser`, **2 PASS / 4 FAIL**. B02 rejoué seul après amélioration de la fixture à un plan local non vide : même échec, zéro create. Aucune répétition des PASS inchangés.
- `node qa/t08/run.mjs lint` : PASS, warning préexistant `.eslintignore` uniquement. `node qa/t08/run.mjs typecheck` : PASS. Aucun fichier produit changé ; gates historiques complètes/build non rejouées. Next dev a réellement compilé les trois vues ; ceci n'est pas un build de production.
- Axe : login 12 nœuds contraste ; create 2 boutons + 2 selects sans nom et 20 nœuds contraste ; editor 7 boutons + 2 inputs + 1 select sans nom et 17 nœuds contraste. Aucun overflow horizontal constaté à 390 px. Mesures DOM interactif locales : environ 98 / 203 / 453 ms ; compilation à froid, police de secours et mocks empêchent toute conclusion de performance production.
- GitNexus : index propre à ce worktree, `--index-only`, protections `.env*` archivées sous `qa/t08/gitnexusignore.template`, aucune injection de fichiers produit. Impact FakeDb : zéro appel résolu, risque UNKNOWN, pas preuve d'absence. Graphe final signalé **TRUNCATED** (966 candidats d'entrée, 3091 callees, 8 walks coupés ; 13395 nœuds, 29185 relations, 517 flows). Analyse finale `detect_changes --scope staged` jointe ; ne certifie pas un impact exhaustif. Diff Git direct fait autorité sur les chemins modifiés.
- `detect_changes` avant commit : 17 chemins, 111 symboles, 0 processus résolu, risque annoncé LOW ; synthèse `qa/t08/evidence/gitnexus.json`. Les manifestes de preuve ajoutés ensuite ne modifient aucun symbole.
- Manifest SHA-256 des sources/test/configurations et métadonnées des dépendances joint ; pas un digest intégral des dépendances installées. TAP normalisé uniquement pour retirer les espaces de fin de ligne ; original brut local conservé. Trace B02 finale et journaux bruts conservés localement ; preuves compactes versionnées. Aucun PASS basé sur du WIP produit.

## Reprise T01 / condition de certification

1. Consommer uniquement les nouveaux tests et preuves, pas les fichiers produit S5. Adapter les doubles aux contrats PR3 réels et revoir le delta de chaque propriétaire.
2. Sur HEAD intégré figé et dépendances T01 figées, requalifier les 21 cas rouges, puis les tests touchés par les corrections. Un cas S5 devenu obsolète doit être documenté, pas silencieusement déclaré PASS.
3. Obtenir séparément la preuve DB/RLS/contraintes/concurrence réelle, le média synthétique final validé, les scénarios complets avec raccord durable, a11y/clavier et performance production.
4. Les actions externes interdites restent hors de cette livraison ; aucun déploiement/publication n'est requis ni exécuté par T08 pour clôturer le lot local.
