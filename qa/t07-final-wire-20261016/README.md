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
