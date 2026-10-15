# Candidat final unique a70b913 — preuves réutilisables après contrôle exact

T01 a remplacé99dd par **a70b913ae31f7ce670aba595eab194851b5673eb** le15octobre22:49UTC : uniquement QA/docs, notamment sa fixture API/SQL et notre addendum5e005ff déjà intégré. **Vérification indépendante PASS : aucun delta produit/SQL/dépendances,30/30blobs produit identiques,20/20hashes par reçu exécuté et6/6sources QA identiques au nouveau SHA.** Détail : `qa/t07-final-wire-20261016/owner-final-a70-equivalence.json`.

Les campagnes physiques ont été exécutées sur99dd (5PASS Chromium,3PASS API/SQL) ; leur équivalence source exacte àa70 est prouvée, sans prétendre avoir relancé le navigateur sura70. T01 demande explicitement la réutilisation, pas une campagne identique. Aucun nouveau comportement à contre-tester. **FAIL actuel de ce lot :0.** CI exacte/ACK global restent à T01/T08, distincts du PASS local.

Pour intégrer cette livraison : les quatre sources QA et preuves avant sont **déjà dansa70**. Prendre seulement nouveaux `owner-*`, logs de graphe/sécurité, captures après et ajouts documentaires ; préserver vos BATON/task_plan/handoff. La branche de livraison conserve son parent99dd, aucun merge/rebase ni écrasement de votre candidat effectué. Le SHA local est transmis dans le miroir de coordination après commit.

Gates finales : syntaxe6PASS/lint cibléPASS ; gitleaks indexé0finding et diffcheck hors logs brutsPASS. GitNexus index actualisé, `detect-changes --scope staged` LOW/aucun flux affecté ; comparaisonmain HIGH/13flux (historique global5013fichiers), avertissement communiqué. Impacts préalables QA CRITICAL/homonymes archivés ; graphe tronqué1351points/834callees/43walks, revue directe des4sources QA obligatoire et réalisée. Aucune certification exhaustive.

---

# T07 — retest du candidat final T01 99dd4c1

**Candidat testé : `99dd4c16b7b15bb7f38cd4f73529d5dea4497005`. Branche de livraison : `codex/sutra-t07-audit-retest-99dd-20261016`.** Parent exact T01, aucun changement produit/backend/SQL. Les quatre sources QA de l'addendum `5e005ffc59c1947436e2e5e0f3a095c87a5f4009` sont appliquées ; le lot initial `6dec16c` est déjà intégré par T01. Ne pas réimporter les anciens correctifs frontend.

**PASS : 5 contrôles Chromium375/1440 + 3 contrôles API/SQL. FAIL actuel : aucun dans ces deux campagnes. AUDIT_GAP est corrigé par T01 et contre-testé ici.** Les FAIL historiques ci-dessous sont conservés, sans les présenter comme actuels. Ceci n'est pas un ACK global de CI ou de production.

## Commandes et preuves exactes

```sh
node qa/t07-final-wire-20261016/run.mjs owner-ui- --cancel-only --candidate=99dd4c16b7b15bb7f38cd4f73529d5dea4497005
node qa/t07-final-wire-20261016/run.mjs owner-audit- --audit --candidate=99dd4c16b7b15bb7f38cd4f73529d5dea4497005
```

Les préfixes ci-dessus sont déjà utilisés : en choisir de nouveaux si une nouvelle régression justifie un rejeu. `owner-ui-execution.json` / `owner-audit-execution.json` : exit0,20/20 empreintes sources conformes chacun,30/30 fichiers produit/dépendances conformes au SHA99dd, aucun mismatch. `owner-verification.json` rassemble les contrôles ; `owner-integration-delta.json` borne le delta depuis f360. Les quatre sources QA modifiées sont `run.mjs`, `wire.mjs`, `browser.mjs`, `audit.mjs` ; aucun nouveau moteur.

| Frontière | Verdict et constat |
|---|---|
| UI mobile375/bureau1440 | PASS5/0FAIL : double clic, ACK submit/cancel perdus, erreur GET visible puis reprise sans nouvelle soumission ; fournisseur déjà lancé simulé et fin tardive refusée. Quatre consentements réels dans la fixture légale, zéro erreur JS/hydratation, mutation inattendue ou sortie externe. |
| Base/quotas/audit depuis UI | PASS :4jobs cancelled,4événements uniques liés au même acteur/job et au reçu progress.effects, reserved0/released4 ; aucune annulation de nettoyage nécessaire. Deux reçus fournisseurs synthétiques conservés. |
| API et redémarrage | PASS3/0FAIL : HTTP200 annulation initiale, événement video_cancelled et metadata bornée exacts ; vrai restart PostgreSQL puis cancel répété200/cancelled=false, GET cancelled, même événement et même quota reserved0/released1. |
| Reprise de base | PASS :2redémarrages dans la campagne UI,1dans audit ; pg_postmaster_start_time différent, commande exit0, aucune erreur/timeout. Il ne s'agit pas d'un redémarrage du worker de production. |
| Atomicité en cas d'échec d'audit | Preuve propriétaire T01 réutilisée : `qa/t01-cancel-audit-20261016/after-postgres.json`,24PASS et empreintes toutes conformes au présent candidat. Tests SQL de rollback et annulations concurrentes ;25tests transition du propriétaire distincts, sans somme avec nos parcours. |
| Ordonnanceur configuré depuis UI | PASS12 antérieur f360 conservé pour les frontières invariantes : quatre fréquences, IANA/DST, sauvegarde/erreur/reprise, CAS, double clic, deux ticks cron canonique/une occurrence et pause.29sources et13invariants T03 identiques ; seules migration cancel et fixture de notifications ont changé. L'annulation affectée est rejouée ci-dessus, pas la suite planning inchangée. |
| Messages UX | PASS ciblé : confirmation du serveur, état inconnu/reprise, limite explicite sur arrêt fournisseur/remboursement ; captures `owner-ui-browser/cancel-recovered-375.png` et `cancel-inflight-1440.png` affichées. Aucun arrêt fournisseur réel promis. |

Avant correctif T01, les **mêmes nouvelles assertions audit UI** donnaient1PASS/4FAIL sur f360 (`audit-before-owner-*`, preuves importées exactement depuis5e005ff). Après :5PASS/0FAIL. Le diagnostic API initial était1PASS/1FAIL AUDIT_GAP (`audit-final-*`, conservé dans6dec16c) ; nouveau contrat enrichi :3PASS/0FAIL. Les suites se recouvrent : ne pas additionner leurs comptes comme des garanties indépendantes.

La cause et la correction sont backend propriétaire : `cancel_video_job` ne créait pas d'activité ; T01 ajoute l'événement et le reçu dans la même transaction que l'état/quota. T07 a adapté la fixture à la table canonique `activity_logs`, puis vérifié la correction. Aucune activité synthétique ajoutée par le frontend, aucun événement historique inventé.

## Limites et livraison

**BLOQUÉ côté produit/runtime :** dispatch autonome réelR30 toujours OFF ; annulation UI `/create`R74 et cascade globale d'un projet absentes du contrat reçu. Notre preuve concerne `/production` et la configuration de l'ordonnanceur ; pause n'annule pas les jobs déjà créés. Ces fonctions restantes doivent être attribuées par T01, sans deuxième moteur ni activation T07. La CI globale exacte relève de T01/T08 ; ses rouges ou son éventuel nouveau SHA QA ne sont pas certifiés par ce lot.

**NON TESTÉ :** routage HTTP Next complet et PostgREST/RLS distant (handlers réels relayés, session/transport simulés), arrêt/remboursement fournisseur réel, worker/cron déployé après crash, fermeture de navigateur/multiappareil, Safari natif/appareil physique/lecteur d'écran et audit déployé. Mocks gratuits pour tous les fournisseurs. Aucun secret, appel payant, publication, GPU, push, fusion, migration distante ou déploiement.

Pas de lenteur nouvelle démontrée dans ce retest ; mesures de sauvegarde du planning conservées plus bas, aucune optimisation ni amélioration revendiquée. Syntaxe6PASS/lint cibléPASS dans `owner-local-checks.json`. GitNexus et sécurité finaux sont consignés dans les fichiers `gitnexus-owner-*` / `owner-gitleaks.*` ; la limite de graphe partiel/homonymes demeure.

---

# Historique conservé — candidat f360 avant correction audit T01

# T07 — interface, annulation et ordonnanceur sur candidat T01

Base testée **f36013ae8b3bd7d9a702f7aebfdff1ac430c05f5**, branche `codex/sutra-t07-final-wire-20261016`, worktree `sutra-t07-final-two-20261015`. Livrable QA/docs uniquement. Aucun fichier produit, moteur, SQL canonique ou configuration modifié. Les corrections T07 `4c856ae` puis `03de132` sont intégrées par consolidation T01 : les trois blobs produit finaux correspondent exactement, sans présumer une relation d'ancêtre Git.

**PASS ciblé : 12 scénarios Chromium, 375 et 1440 px. FAIL restant : journal d'annulation absent dans le contrat canonique testé. BLOQUÉ : correction backend propriétaire et nouveau candidat T01.** Aucun PASS global/release. CI38809803219 reste rouge selon T01 (private-download Chromium et social-reload WebKit, pris en charge par T01).

## Frontière effectivement exécutée

Vraie interface Next dev HTTPS loopback, identité `legal-test@example.invalid`, connexion et quatre consentements légaux via le parcours existant. Playwright relaie seulement `/api/auto/config`, `/api/production` et `/api/video/status/:id` vers les **vrais handlers importés** ; session et transport Supabase sont simulés, requêtes/RPC exécutées dans PostgreSQL18.4 privé loopback avec les migrations canoniques. Ce relais ne prouve ni le routage HTTP Next complet ni le transport distant PostgREST/RLS. Les autres mutations API inattendues sont refusées et comptées.

Worker remplacé par une attente contrôlée qui écrit un reçu fournisseur synthétique avec le vrai checkpoint SQL. Aucun adaptateur fournisseur exécuté, aucune image/vidéo/musique générée, aucune publication. Garde réseau `qa/t08/offline.cjs`, environnement allowlist avec clés factices, aucun fichier secret lu. Le cron existant est invoqué manuellement dans la fixture : **aucun second ordonnanceur, aucune activation du dispatch réel**.

## Matrice des garanties

| Risque | Verdict et preuve |
|---|---|
| Configuration depuis l'UI | PASS : création/sauvegarde SQL des quatre fréquences sur les deux largeurs ; un seul PATCH malgré deux clics synchrones. |
| IANA, DST, récurrences | PASS : Europe/Paris persisté, quotidien/hebdomadaire/toutes les deux semaines/mensuel ; prochaines dates calculées depuis les objets sauvegardés. Passage printemps 2027 et automne 2026, doublon d'entrée dédupliqué. Mensuel testé : premier jour choisi du mois ; biweekly signifie toutes les deux semaines, pas deux dates fixes par mois. |
| Erreur de sauvegarde et reprise | PASS : erreur visible, état SQL inchangé, retry explicite avec lecture canonique, sauvegarde puis rechargement. Aucune erreur interne synthétique exposée. |
| Annulation avant démarrage | PASS : submit commis avec ACK perdu, aucun worker appelé ; cancel commis avec ACK perdu, même intention conservée ; refus d'une nouvelle prise du job annulé. |
| Reprise après redémarrage | PASS : quatre vrais redémarrages PostgreSQL privés, chacun prouvé par changement de `pg_postmaster_start_time()`, exit0 et stdout conservés. Reload du même onglet puis GET ; GET indisponible visible, reprise ensuite sans POST de soumission. Ce n'est pas une fermeture de navigateur ni un redémarrage du service de production. |
| Double clic / quota | PASS : une soumission et une annulation par intention, libération une fois ; quatre jobs production annulés, reserved0/released4 avant le scénario auto. |
| Fournisseur déjà lancé | PASS limité : reçu synthétique conservé, lease/worker retirés, fin tardive refusée, aucune fausse réussite affichée ; message explicite sans promesse d'arrêt fournisseur ni remboursement. Aucun arrêt distant réel testé. |
| Occurrence auto | PASS : planning créé/modifié par UI → handler → SQL → deux invocations du cron canonique → un seul job/une seule vidéo auto. Pause UI bloque la nouvelle occurrence ; elle ne supprime pas le job déjà créé. La contention parallèle reste couverte par les preuves T01/T03/T08 invariantes, sans doublon de banc. |
| Audit | PASS : identité de job, état, timestamps et reçu fournisseur durables. **FAIL : aucun événement d'annulation dans activity_logs après HTTP200**, reproduction distincte ci-dessous. État courant ≠ historique des actions. |
| Messages et rendu | PASS ciblé : erreurs/reprise/annulation, avertissement moteur non vérifiable, absence de débordement horizontal du planning. Captures finales bureau/mobile affichées après fin des transitions. Contraste exhaustif/lecteur d'écran/Safari natif/appareil physique NON TESTÉS dans ce delta. |

`final-browser/results.json` contient 12PASS/0FAIL ; `final-browser/database.json` contient les requêtes, RPC, états et quatre redémarrages. Zéro sortie réseau externe, mutation inattendue ou erreur JS/hydratation recensée. Après preuve, le job auto encore en attente est annulé **uniquement pour le nettoyage de la fixture** : compteurs finaux reserved0/released5. Cela ne démontre pas un bouton d'annulation auto dans l'interface.

## Défaut transmis à T01/T03 et T08

`audit.mjs` applique le schéma canonique privé, ajoute la table `activity_logs` extraite de `setupSchema`, soumet via le vrai POST avec ACK perdu puis annule via POST valide. HTTP200/data.cancelled=true ; job cancelled ; quota reserved0/released1 ; **activity_logs vide** et aucun trigger non interne sur video_jobs dans ce schéma. `audit-final-browser/results.json` : 1PASS état/quota, 1FAIL `AUDIT_GAP`. Le SQL réellement chargé est conservé dans `cancel-function.sql`.

Cause directe : `migrations/v11_pipeline_checkpoints.sql:208`, `cancel_video_job`, ne met à jour que quota et job ; branche cancel de `src/app/api/production/route.ts` sans event. `record_video_job_event` existant exige processing + lease, donc ne peut pas simplement être appelé après annulation. T01/T03 doivent définir/corriger l'événement transactionnel et idempotent ; aucun journal parallèle frontend ajouté. Ce banc ne certifie pas les triggers éventuels d'une base distante.

Transmission initiale dans `.coord/handoffs/SUTRA-20261012/T07-SCHEDULER-CANCEL-20261015.md`. Retest attendu sur le prochain SHA du propriétaire, sans fusion T07. R30 dispatch runtime OFF et R74 annulation `/create` absente restent les limites T01 déjà connues ; la preuve présente concerne `/production`, pas une cascade globale de toutes les tâches d'un projet.

## Commandes et historique des corrections du banc

Préfixe neuf obligatoire pour préserver les preuves :

```sh
node qa/t07-final-wire-20261016/run.mjs final-
node qa/t07-final-wire-20261016/run.mjs audit-final- --audit
node node_modules/eslint/bin/eslint.js qa/t07-final-wire-20261016/*.mjs
```

- `first-` : 11PASS/1FAIL ; pont SQL sans `.lte`, nettoyage issu du banc T03 attendait son autre nom de DB. Corrigés dans le banc seulement. Le libellé restart de cette première campagne est invalide : `DISCARD ALL` n'était pas un redémarrage serveur.
- `restart-` : 12PASS et quatre redémarrages effectifs ; captures prises trop tôt pendant les transitions. La capture stdout du restart héritée du processus PostgreSQL imposait une attente inutile. Version finale utilise un fichier log, contrôle aussi l'absence de timeout et l'heure du postmaster.
- `audit-` : requête fixture cancel sans `idea`, rejet400 ; ce rouge ne démontre pas un défaut produit. `audit-contract-` corrige ce corps selon le contrat réel et reproduit seulement le manque d'audit.
- `final-` : 12PASS/0FAIL, quatre redémarrages prouvés, captures stabilisées, cleanup PASS et cluster arrêté. Nouveau passage justifié par corrections du pont/restart/captures ; aucune répétition de la CI globale.
- Six fichiers `.mjs` : `node --check`, PASS ; ESLint ciblé PASS sans avertissement. TS/lint/build produit inchangés : preuve check CI exacte f360 rapportée par T01 réutilisée ; aucune nouvelle compilation globale concurrente. La CI navigateur globale reste FAIL, distincte du présent PASS.

Les hashes par campagne et commandes effectives sont dans `*-execution.json`. `integration-manifest.json` compare 23 sources T07 (22 identiques ; seule route auto/config modifiée par T01 pour CAS/validation, testée ici) et 14 invariants T03 identiques. Aucun cumul artificiel des suites historiques qui se recouvrent.

## Mesures et limites

Sauvegarde clic → fermeture éditeur après handler/SQL : premier passage109–139ms, médiane110,5ms ; final110–148ms, médiane114ms, huit observations par campagne, même fixture/machine/Chromium dev. `performance.json` conserve les valeurs. Aucune lenteur produit reproductible démontrée, aucun code optimisé et aucune amélioration revendiquée. Ce n'est ni un benchmark production ni une promesse de latence.

GitNexus utilisé avant changements de symboles QA : nouveaux symboles introuvables/UNKNOWN, index tronqué ; revue directe du diff et des imports, aucun appelant produit introduit. Résultats de détection avant commit et sécurité consignés dans les logs dédiés et le handoff. Pas de certification exhaustive du graphe.

NON TESTÉ : infrastructure déployée, redémarrage du worker réel/cron système, fermeture d'onglet ou reprise multiappareil, facturation/annulation distante réelle, génération payante, publication réelle, crash matériel/corruption, Safari/appareil physique. Aucun push, merge, migration distante, déploiement, activation GPU ou modification de production.

Reçu audit final : `audit-final-execution.json` lie la reproduction FAIL aux cinq sources QA du parcours audit figées, dont `wire.mjs` et `checks.mjs` actualisés. Nouveau passage demandé par T08 pour éliminer la dérive des hashes de la preuve précédente. T01 a pris AUDIT_GAP le 2026-10-15 à22:36UTC, scope SQL réservé `SUTRA-T01-20261016:CANCEL-AUDIT`; aucun correctif parallèle T07.

Gates de livraison : hashes `final-execution` et `audit-final-execution` tous conformes aux sources figées (20/20 chacun); gitleaks diff indexé zéro finding; syntaxe6PASS/lintPASS. `git diff --cached --check -- . :!*.log` PASS. Les huit avertissements de ligne vide finale des logs bruts sont conservés pour ne pas réécrire les preuves. GitNexus `detect_changes --scope staged` CRITICAL/159flux liés à des homonymes `output`; `--scope compare --base-ref main` exécuté. Index tronqué :1350points/834callees/43walks, revue directe QA/docs uniquement, aucun certificat exhaustif.


## Addendum QA audit — 2026-10-15T22:43:45.975144+00:00

À la demande T0122:39, la fixture crée désormais la table canonique activity_logs avant les scénarios navigateur. Filtre `--cancel-only` : deux familles annulation sur375/1440 + garde réseau, aucun replay planning inchangé. Assertions ajoutées : un événement par tâche/acteur, reçu dans progress.effects, marqueur provider_submitted exact; scénario API audit prolongé par restart réel, second cancel sans doublon et GET de réconciliation. `--candidate=<SHA40>` enregistre le candidat et vérifie30sources produit/dépendances contre ses blobs, avec exit1 si dérive. Aucune modification produit.

**Avant correctif T01 :1PASS/4FAIL** `node qa/t07-final-wire-20261016/run.mjs audit-before-owner- --cancel-only --candidate=f36013ae8b3bd7d9a702f7aebfdff1ac430c05f5`. Quatre rouges uniquement sur événement absent; autres assertions UI/quota/reprise exécutées avec succès avant cette assertion. Aucun réseau/JS inattendu,30/30blobs candidat conformes, cluster arrêté. Reçu exact `audit-before-owner-execution.json`; ancien checkpoint6dec16c conserve sources et preuves initiales. Syntaxe des4fichiers modifiés PASS, lint6PASS. Après correctif : NON TESTÉ tant que SHA40 T01 absent. Nouveau SQL WIP non importé.
