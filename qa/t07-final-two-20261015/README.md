# T07 — deux fonctions finales, 15 octobre 2026

Livraison frontend locale sur **cb3f893c35599a6c9c50a4d23c82013c10c5f3ae**, branche `codex/sutra-t07-final-two-20261015`. Le SHA livré est le commit contenant ce dossier, transmis dans le miroir T01/T08. Aucun backend, moteur, migration ou harnais appartenant à T01 modifié.

## Intégration antérieure et défauts reproduits

`prior-integration.json` confirme les huit sources de **483d1973ab114d000f602fc8c4c5aa2e3f31b055** identiques dans le candidat T01 (import f29bce5). L'annulation UI durable et le contrôle global de préférence sont donc déjà intégrés ; ce lot n'en crée pas une seconde version.

La page `/auto/schedules` ne permettait ni de choisir son fuseau ni de modifier/pause/reprendre un planning existant. Une réponse PATCH perdue provoquait une deuxième écriture au retry, sans GET préalable. Reproduction desktop/mobile : **3 PASS / 6 FAIL**, conservée dans `before/`.

Correction limitée à `src/app/(dashboard)/auto/schedules/page.tsx` et au nouveau helper `src/lib/auto-schedule-client.ts` : création/édition/pause/reprise, fuseau IANA validé, conservation de l'identité et des champs opaques, intention figée et verrou synchrone, lecture avant écriture/retry, confirmation stricte du corps reçu, conflit explicite, erreur/deadline visibles. Un planning tiers arrivé avant la lecture reste conservé. Aucun changement de règle de récurrence : bimensuel signifie ici **toutes les deux semaines**, et mensuel la première occurrence de chaque jour choisi du mois, conformément au moteur existant.

## Tests exécutés et preuves

Toutes les requêtes navigateur sont loopback, identité et consentements légaux de fixture ; fournisseurs simulés, aucune génération. Runner HTTPS isolé, garde sockets serveur, interception des API non attendues. Aucun secret chargé. Les essais s'exécutent sur Chromium, viewport375×900 et1440×900, Next en mode développement.

| Commande (depuis ce worktree) | Résultat |
|---|---|
| `node qa/t07-final-two-20261015/run.mjs before` | **3 PASS / 6 FAIL** avant correction, résultat rouge conservé |
| `node qa/t07-final-two-20261015/run.mjs after-repro` | **9 PASS / 0 FAIL** ; mêmes assertions, double clic et retry après réponse perdue |
| `node --test qa/t07-final-two-20261015/contracts.test.mjs` | **8 PASS / 0 FAIL / 0 SKIP** : validation, intentions, conflits, 4 fréquences, IANA/DST, pause, déduplication du calcul canonique |
| `node qa/t07-final-two-20261015/run.mjs full --full` | **15 PASS / 2 FAIL** : échecs contraste pendant animation, tous les parcours fonctionnels PASS |
| `node qa/t07-final-two-20261015/run.mjs accessibility --a11y` | **3 PASS / 0 FAIL** : contrôles affectés rejoués après stabilisation, mêmes règles axe, clavier/focus/labels/absence de débordement |
| `node_modules/.bin/tsc --noEmit --incremental false` | **PASS** séquentiel, `types-sequential.log`. Premier essai simultané au serveur FAIL TS6053 car Next régénérait ses types ; brut `types.log` conservé |
| `node_modules/.bin/eslint 'src/app/(dashboard)/auto/schedules/page.tsx' src/lib/auto-schedule-client.ts qa/t07-final-two-20261015/*.mjs --max-warnings 0` | **PASS**, `lint-final.log` |

Ne pas additionner les essais recouvrants. Détails machine dans chaque `results.json`, journaux bruts conservés. L'accessibilité initiale a mesuré MAIN à opacité0,458/0,451 ; après700ms, opacité1 et **zéro violation axe**, avec une catégorie `incomplete` contraste par viewport (éléments partiellement masqués, détail conservé). Ce n'est pas une certification exhaustive de contraste ni de lecteur d'écran. Captures `accessibility/form-375.png` et `form-1440.png` affichées et examinées. Les captures `full/list-*` sont prises pendant la transition et ne servent pas de preuve visuelle stabilisée.

Couverture fonctionnelle supplémentaire : éditer sans perdre id/thèmes ; pause en erreur, double clic et conservation d'une modification tierce ; reprise après réponse perdue et rechargement ; fuseau invalide/jours manquants refusés avant requête ; quotidien sans jours, mensuel ; suppression ACK perdu et reload ; conflit distant sans écriture ; ACK200 incohérent jamais présenté comme succès ; GET malformé/503/deadline avec reprise. Aucun appel externe, mutation inattendue, erreur runtime ou hydratation détecté dans ces campagnes.

## Mesures

Dans le même scénario de réponse perdue aux deux largeurs : **2 PATCH / 0 GET avant → 1 PATCH / 1 GET après**. Le second essai ne réécrit plus une sauvegarde confirmée par GET. Pas d'optimisation spéculative ni de gain de latence revendiqué : l'édition, nouvelle fonction sans équivalent antérieur, prend372ms mobile et364ms desktop avec fixture120ms par réponse. Le GET bloqué rend une erreur en11,48s navigation comprise, avec timeout requête10s. Aucune mesure de production/réseau fournisseur.

## Critères demandés et limites exactes

| Critère | Verdict borné et propriétaire restant |
|---|---|
| Ordonnanceur configurable depuis l'interface | **PASS local simulé** création, édition, pause, reprise, fuseau ; **BLOQUÉ exécution autonome réelle**, runtime désactivé et aucun statut vérifiable fourni par T01 |
| Annulation durable production/tâches | **PASS antérieur intégré** UI `/production` 52/52 optimisé de483d197 ; aucun nouveau moteur. **BLOQUÉ clôture globale** : cascade de toutes les tâches et `/create` non couverts par le contrat reçu, nouveau rapprochement T03/T01 en attente |
| Redémarrage | **PASS local** relecture définition depuis GET, restauration par sérialisation du calcul ; preuve T03 existante de remplacement du worker conservée. **NON TESTÉ** fermeture onglet/navigateur ou autre appareil : reçu UI en sessionStorage, reload seul prouvé |
| Idempotence / doublons | **PASS local** double clic, retry GET sans replay, occurrences uniques du moteur. **BLOQUÉ concurrence API** : PATCH remplace le tableau sans CAS, deux clients peuvent lire A puis écraser mutuellement A+B/A+C ; le navigateur ne peut fermer cette fenêtre |
| IANA / DST | **PASS local** zones IANA, gap printemps et fold automne, une occurrence calculée |
| Quatre récurrences | **PASS local** quotidien/hebdomadaire/toutes les2semaines/mensuel selon moteur canonique ; pas de règle métier inventée |
| Tâches non commencées | **PASS local** pause empêche les futures occurrences non créées ; annulation d'un job SQL déjà créé reste contrat T03, aucun faux lien pause=cancel |
| Opération fournisseur commencée | **PASS de sécurité UI antérieur** pas de nouveau POST après cancelRequested, réconciliation en lecture. **NON TESTÉ réel** arrêt distant/remboursement ; rien de tel n'est promis |
| Quotas | **PASS existant T03, réutilisé** règlement atomique unique/rollback selon `6fe4085`, quatre blobs identiques (`backend-invariant.json`). Pas de preuve de remboursement fournisseur ; frontière HTTP+SQL finale attendue de T03 |
| Audit et UX | **PASS local** messages de sauvegarde/état inconnu/conflit/pause, identités conservées. **BLOQUÉ audit global** aucun contrat de journal d'audit complet ni écran de cascade reçu de T01 ; aucune fausse trace persistante ajoutée au frontend |

T03 a annoncé à20:15UTC un lot `qa/t03-final-candidate-20261015` sur cb3f893, pas encore reçu au gel de ce dossier. Sa preuve canonique précédente (29 tests distincts, 2 erreurs de fixture corrigées) n'est ni rejouée ni transformée en nouvelle validation du transport courant. Les quatre empreintes de son moteur/SQL correspondent exactement ; les autres garanties restent à rapprocher de sa livraison.

## Intégration T01 / revue T08

Importer ensemble les deux sources et leurs preuves, préserver les append propriétaires de BATON/task_plan. Adapter uniquement chez T01 son `qa/t07-final-ux-perf-20261015/planning-checks.mjs` : après erreur de suppression, utiliser **Vérifier et réessayer**, puisque supprimer reste verrouillé quand l'état est inconnu ; les jours ont désormais un nom accessible français complet. Aucun changement de ce harnais ici.

**BLOQUÉ** retest du SHA final tant que T01 n'a pas intégré ce lot et fourni son SHA. Le nouveau build optimisé et les suites globales sont centralisés chez T01 : **NON TESTÉS pour ce delta** ici, aucun PASS global cb3 réétiqueté. Commandes ciblées à appliquer au final : contracts + after-repro + full (stabiliser l'animation avant axe) ; les preuves invariantes d'annulation ne sont à rejouer que si leur code/contrat change. T08 reçoit les mêmes preuves PASS/FAIL sans compter deux fois les rejeux.

**NON TESTÉ** Safari natif, appareil physique, lecteur d'écran, publication, fournisseur/DB réels, charge et disponibilité continue. Aucun push, fusion, déploiement, migration distante, activation runtime, appel payant ni calcul IA sur Mac. La clôture de ce lot frontend ne vaut pas clôture des dix garanties système.

## Contrôles de livraison

Gitleaks expurgé du diff texte : **PASS**, zéro finding (`gitleaks-redacted.json`, entrée exacte `scan-input.txt`). Diff-check code/tests/docs/JSON : **PASS** ; journaux bruts conservés sans normalisation. GitNexus propre au worktree, impacts avant édition conservés : LOW pour fetch/save/toggle/delete résolus ; route Next non résolue UNKNOWN. Index final **23051 nœuds / 44846 arêtes / 372 flux**,1317 entrées et708 callees omis,3 traces coupées. `detect_changes --scope staged --limit 300` :53fichiers/97symboles/372flux, CRITICAL ; helpers de tests homonymes associés à des flux étrangers. Avertissement communiqué, revue directe bornée aux deux sources autorisées. `detect_changes --scope compare --base-ref main --limit 300` :4412fichiers/4581symboles de tout l'historique intégré, CRITICAL, sortie plafonnée. **Exhaustivité du graphe UNKNOWN**, jamais convertie en PASS. Les ajouts ultérieurs sont uniquement les reçus et cette documentation.

## Addendum CAS — contrat T01 du 15 octobre à20:26UTC

Le premier lot est le commit **4c856aee34d23717c9aa2ca0be441dafefa9bdfc**, réception confirmée T01 à20:33UTC. L'absence de CAS décrite ci-dessus correspond à cette première livraison ; elle est remplacée côté frontend par cet addendum, à intégrer **avec** la route propriétaire T01. Parent de ce delta :4c856ae, même branche. Ne pas déployer le premier lot seul avec la nouvelle route428.

Deux fonctions seulement : `saveSchedules` envoie `expectedSchedules` égal au GET frais exact, extensions comprises ; sur409, GET unique puis succès seulement si l'intention est déjà appliquée, sinon conflit visible/verrouillage conservé. Aucune seconde écriture automatique. `auto/settings.handleSave` n'envoie que ses neuf champs réellement éditables, jamais schedules/is_active/user_id ni les autres valeurs chargées. Ce correctif évite un428 légitime et tout écrasement de planning depuis les préférences générales.

| Commande | Verdict |
|---|---|
| `node qa/t07-final-two-20261015/run.mjs cas-before --cas` | **1 PASS / 10 FAIL**, preuve rouge avant ajout précondition et allowlist |
| `node qa/t07-final-two-20261015/run.mjs cas-after --cas` | **11 PASS / 0 FAIL**, mêmes assertions,375/1440 |
| `node qa/t07-final-two-20261015/run.mjs cas-regressions --full` | **17 PASS / 0 FAIL**, sauvegardes affectées, édition/pause/reprise, reload, ACK incohérent, erreur/timeout, clavier/axe/mobile |
| `node_modules/.bin/tsc --noEmit --incremental false` | **PASS**, séquentiel après arrêt du serveur, cas-types.log |
| `node_modules/.bin/eslint 'src/app/(dashboard)/auto/schedules/page.tsx' 'src/app/(dashboard)/auto/settings/page.tsx' qa/t07-final-two-20261015/cas-checks.mjs qa/t07-final-two-20261015/run.mjs --max-warnings 0` | **PASS**, cas-lint.log |

CAS testé : snapshot exact, double clic, ACK perdu puis GET sans replay,409 avec cible modifiée sans écraser,409 déjà appliqué confirmé par lecture,409 suivi de503 garde état inconnu sans diagnostic privé, allowlist réglages. **Fixture du contrat annoncé**, pas une preuve de l'UPDATE SQL réel. Les campagnes ont0accès externe,0mutation inattendue,0erreur runtime/hydratation. Captures cas-regressions/form-375.png et form-1440.png affichées ; focus et formulaire observés, barre mobile fixe visible, aucune certification exhaustive lecteur d'écran. Manifestes `cas-source-manifest.json` et `cas-validation.json` bornent la preuve ; le manifeste précédent demeure historique.

Les huit tests helpers/moteur déjà PASS sont réutilisés sans rejeu : ces sources n'ont pas changé. Les17régressions ont été rejouées car toutes les sauvegardes ont changé de contrat, pas pour recompter un PASS inchangé. Pas de nouveau build global : explicitement centralisé T01. Les nombres de campagnes se recouvrent.

**BLOQUÉ intégration finale** : T01 doit intégrer ce delta et sa route CAS, puis transmettre le SHA exact. Son candidat cb3 est actuellement vert en CI mais non promouvable pour d'autres défauts propriétaires ; il ne constitue pas la validation de ce nouveau lot. Reprise testable avec `--cas`, puis suites affectées sur cet exact SHA sans second build. **BLOQUÉ runtime autonome** : T01 confirme à20:26 que R30 reste OFF ; préférence/configuration ne signifie pas exécution serveur. **Annulation/quota/restart** : T01 renvoie aux preuves T03 ; nouveau reçu T03 annoncé à20:15 toujours en attente lors de cet addendum, invariants précédents conservés. Audit global, cascade `/create`, fermeture du navigateur et opérations fournisseur réelles ne deviennent pas PASS par l'ajout CAS.


Contrôles du commit CAS : gitleaks stdin du diff texte exact **PASS0finding** (`cas-scan-input.txt`, `cas-gitleaks-redacted.json`), diff-check des sources/docs/JSON **PASS**. Index propre23108nœuds/45013arêtes/372flux, mais1318entrées708callees omis et3traces coupées. `detect-changes --scope staged --repo sutra-t07-final-two-20261015 --limit 300` :42fichiers15symboles372flux,CRITICAL, tests casChecks associés à des flux étrangers ; les deux callbacks produit ne sont pas résolus dans la sortie, donc analyse directe complémentaire, pas certification exhaustive. Comparaisonmain4454fichiers4450symboles372fluxCRITICAL/plafonnée, historique distinct du delta. Avertissement communiqué, périmètre direct deux sauvegardes confirmé. Reçus et documentation ajoutés après cette analyse sans nouvelle modification produit.
