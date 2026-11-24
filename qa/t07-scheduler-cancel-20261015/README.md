# T07 — Ordonnanceur UI et annulation durable, 15 octobre 2026

## Base, périmètre et coordination

Base `d5d49a458e9e630ffbc1a433a7693a8cecd7dad5`, produit T1 `c7a7ebd876d36c521b1c30f6d487b7bb07f000a8` (CI38750974353 SUCCESS). Le lot frontend précédent `cbcf174` est déjà intégré. Branche `codex/sutra-t07-scheduler-cancel-20261015`. Réservations communes SCHEDULER-CANCEL et SCHEDULER-CANCEL:UI ; huit fichiers frontend seulement, aucun backend/SQL/config/runtime changé. AGENTS, politique et handoffs lus, POLICY_OK. Dépendances réutilisées à lockfile identique ; aucun secret lu ni environnement privé chargé.

ACK T1 lus dans `.coord/handoffs/SUTRA-20261012/T01-FINAL-INTEGRATION-20261015.md`, 18:07 puis 18:27/18:28 UTC. T1 confirme que `is_active` est une préférence, aucun endpoint ne prouve le fonctionnement du moteur. R30 exécution autonome reste BLOQUÉ. `/create` n'a pas le contrat cancel production et reste hors extension demandée. T1 a livré le GET de réconciliation dans son worktree, route SHA256 `9e0d5b5bc953f35327a3648867333ee1a16a10ef97b0a0a02a5989fdd891d5a1`, 29 nouveaux tests /57 avec régressions annoncés par T1. La route n'est pas copiée ici : son intégration conjointe et sa recette réelle restent à T1/T08.

## Défauts et correction

| Défaut démontré | Cause | Correction frontend |
| --- | --- | --- |
| Deux PATCH au double clic | verrou React visible après rendu seulement | verrou synchrone ; préférence absolue, GET avant retry après ACK perdu |
| Activation présentée comme un moteur opérationnel | `is_active` assimilé au runtime | statut de préférence séparé ; exécution serveur explicitement non vérifiable |
| Annulation/reprise absentes de Production | absence de reçu et commande UI | reçu par utilisateur dans sessionStorage avant envoi, UUID/contenu immuables, POST cancel original, GET suivi, restauration après reload |
| Faux succès possible après ACK cancel perdu/faux | statut réseau confondu avec annulation durable | strict `data.cancelled === true` ou statut serveur `cancelled`, référence conservée sinon |
| Pas de consultation après cancel sans jobId | aucun contrat de lecture par requestId dans la base | GET fourni par T1 ; récupération done/cancelled/processing, aucun POST génération après intention cancel, même sur404 |
| Loader sans limite, erreur GPU masquée | attente sans borne / notice générique | deadlines fetch+corps, erreur locale explicite et expurgée, aucune donnée de diagnostic privée affichée |
| Reçu illisible affiché comme « aucune demande » | état vide indépendant de l'erreur | état inconnu, erreur visible et génération bloquée, reçu préservé |

Aucun second moteur. Seul `{is_active}` est écrit : schedules, fuseaux IANA, occurrences et règles de publication ne sont pas réécrits. Reprise : GET jobId si connu ; sinon GET requestId+targetStep. Une absence404 permet uniquement à une reprise explicite **sans intention d'annulation** de renvoyer le POST original idempotent. Après cancelRequested, aucune branche ne renvoie une génération. 400/401/404/503/timeout/JSON invalide de consultation ne libèrent pas le reçu. Résultat récupéré n'est jamais annoncé comme média vérifié.

## Banc et commandes

Identité synthétique `legal-test@example.invalid`, login et quatre consentements réels du parcours dans la fixture (mentions, CGU, CGV, confidentialité). HTTPS loopback, garde Node offline et interception Chromium : toute origine externe ou mutation inattendue fait échouer le test. Fournisseurs, production, annulation, statut et configuration simulés. Aucun compte utilisateur réel, paiement, publication, génération, GPU ni appel OVH.

Node utilisé : `/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node` (Node24). Commandes depuis le worktree, remplacer `NODE` par ce chemin :

```sh
NODE --import tsx --test qa/t07-scheduler-cancel-20261015/client-contracts.test.mts
NODE --import tsx --test qa/t07-scheduler-cancel-20261015/status-panel.test.tsx
NODE node_modules/typescript/bin/tsc --noEmit --incremental false
NODE node_modules/eslint/bin/eslint.js 'src/app/(dashboard)/auto/layout.tsx' 'src/app/(dashboard)/auto/page.tsx' 'src/app/(dashboard)/production/page.tsx' src/hooks/useProductionGeneration.ts src/hooks/useAutoScheduler.ts src/components/production/ProductionRequestStatus.tsx src/components/auto/AutoSchedulerControl.tsx src/lib/production-intent-client.ts
NODE qa/t07-scheduler-cancel-20261015/run.mjs production-final --production
NODE qa/t07-scheduler-cancel-20261015/run.mjs storage-final --production --storage-only
NODE qa/t07-scheduler-cancel-20261015/run.mjs reconcile-final --reconcile-only
NODE qa/t07-scheduler-cancel-20261015/run.mjs reconcile-optimized --production --reconcile-only
```

Les dossiers de sortie sont immuables : choisir un nom neuf pour rejouer. `production-final` est le build optimisé AVANT le raccord GET T1. `storage-final` couvre le changement de texte d'état inconnu. `reconcile-final` cible ensuite le hook modifié et ses consommateurs sous Next dev, sans répéter le build global déjà demandé par T1. La garde dev a ensuite révélé deux erreurs d’hydratation DashboardChrome (wrapper SSR hidden / div client). `reconcile-final` =51 PASS/1 FAIL, trace brute conservée, rien filtré. Cette nouvelle anomalie justifie le build optimisé du code actuel et la seule suite concernée dans `reconcile-optimized`. La gate du candidat intégré avec routes T1 reste distincte. Ne pas additionner les scénarios recouvrants.

## Preuves conservées et échecs

- `before/results.json` : 4 FAIL. Trois défauts mobile reproduits (double PATCH, affirmation runtime, absence d'annulation) ; quatrième échec = page dev desktop vide, banc partiel, pas preuve produit.
- `smoke/results.json` : 7 PASS (375/1440, garde incluse).
- `after-1/results.json` : 38 PASS /4 FAIL. Deux erreurs GPU masquées corrigées dans le panneau ; deux pages dev vides, non reproduites dans le build optimisé.
- `production-final/results.json` : **46 PASS /0 FAIL /0 SKIP**, Chromium375×900 et1440×900, dont production, reprise, cancel strict, réponse tardive, stockage, quota/GPU, deadlines et garde réseau/runtime/hydratation.
- `client-contracts.log` : **4 PASS**, isolation/validation stockage, deadline lecture du corps JSON, polling abortable.
- `status-panel-before.log` : 1 PASS /1 FAIL, puis `status-panel-after.log` : **2 PASS** après correction de l'état vide.
- `storage-final/results.json` : **3 PASS** sur le dernier texte, avant raccord T1.
- `reconcile-before.log` : bouton sans jobId désactivé. Première assertion SSR trop large recherchait aussi la classe CSS `disabled:` ; `reconcile-after.log` conserve ce faux rouge de banc, correction vers l'attribut HTML exact. `reconcile-panel-final.log` : **3 PASS**.
- `typecheck-reconcile.log` conserve un échec de banc TS6053 : types `.next/dev/types` régénérés pendant le lancement Next dev simultané. Ce n'est pas un diagnostic source ; retest séquentiel après arrêt du serveur dans `typecheck-closure.log`. Aucun fichier de type supprimé pour masquer l'erreur.
- `typecheck-final.log` PASS et `lint-final.log` PASS avant raccord GET ; lint =0 erreur/1 avertissement préexistant de directive ESLint média. Deux builds optimisés locaux précédents PASS, logs `production-final/server.log` et `storage-final/server.log`.

## Accessibilité, captures et mesures

Dix scans axe ciblés sur les deux panneaux en375/1440 : **0 violation** WCAG2A/AA/21AA ; quatre résultats `incomplete` de contraste (scheduler-ready et production-uncertain aux deux largeurs) empêchent une certification exhaustive. Focus clavier, boutons, statut `aria-live`, erreurs `role=alert`, labels et absence de débordement vérifiés. Captures affichées : scheduler-ready375, scheduler-error1440, production-uncertain375/1440. La première capture storage-final a été prise pendant l'opacité d'entrée : elle n'est pas une preuve de contraste final ; la capture du delta attend explicitement opacity1, sans modifier l'animation produit.

Comparaison avant/après dans les mêmes conditions Next dev + fixture300ms,375px : double clic = **2 PATCH →1 PATCH**. Aucune optimisation spéculative.

Mesures build optimisé local, fixtures,375/1440 : panneau auto prêt **99/97ms**, ACK activation **372/361ms**, ACK annulation **360/358ms** avec réponse artificielle300ms. Erreur GET config bloqué **10942/10951ms** ; POST production bloqué **31460ms**, cancel bloqué **10897ms**, navigation/interactions comprises. Le champ historique `auto_ready_ms_dev` de `production-final/results.json` est mal nommé : ce run utilise bien `--production` (log build), preuve brute conservée. Aucun gain de chargement avant/après ni SLA distant déduit d'une baseline dev partielle.

## Limites explicites

- **BLOQUÉ** R30 réel : exécuteur serveur désactivé, pas de port statut/fraîcheur. UI de préférence testée, aucune activation infrastructure.
- **BLOQUÉ intégration** : nouveau GET T1 requis avec ce frontend ; sur ancien backend, l'état demeure inconnu sans génération automatique. Recette route+UI intégrée et migrations/runtime par T1/T08 uniquement.
- **NON TESTÉ** durabilité PostgreSQL/runtime réel, annulation fournisseur déjà lancé/remboursement, publication, GPU et consommations réelles. Les tests sont simulés.
- `/create` : annulation serveur hors contrat et hors extension autorisée par T1 ; R74 global ne se ferme pas au seul motif du raccord `/production`.
- Reçu local durable après reload dans le même onglet seulement ; fermeture de l'onglet/autre appareil n'est pas couverte. Ce reçu n'est pas une file moteur. Le backend conserve l'identité durable.
- **NON TESTÉ** Safari natif, appareil mobile physique, lecteur d'écran réel, toute l'application/contrastes exhaustifs. Chromium responsive n'est pas un appareil physique.
- GitNexus : pré-impacts hook LOW, entrées Next UNKNOWN. Nouveau composant résolu incorrectement par nom : CRITICAL artificiel476 signalé avant édition, UID exact UNKNOWN ; revue directe = un seul consommateur production/page. Réindexations tronquées (candidats/chemins), graphes non certifiants exhaustivement. Aucun fichier GitNexus produit corrigé.

## Revue GitNexus finale

`analyze --index-only --skip-skills --name sutra-t07-scheduler-cancel-20261015 --workers 2` :22466 nœuds/43783 arêtes/367 flux,9,7s ;1302 candidats écartés,705 callees écartés,3 walks tronquées. `detect_changes --scope staged --limit 300` :87 fichiers/49 symboles/367 flux, CRITICAL, association des tests `checks` à de nombreux flux étrangers. Alerte annoncée ; ce graphe ne certifie pas la portée. Diff Git exact contrôlé : huit fichiers frontend réservés, aucun backend. `detect_changes --scope compare --base-ref main --limit 300` :4072 fichiers/4232 symboles historiques, liste plafonnée ; ce comparatif inclut tout l'historique candidat, pas seulement T07. Les exports CLI `.txt` eux-mêmes n'affichent qu'un extrait.

## Clôture locale

- **PASS** `reconcile-optimized/results.json` :52 PASS/0 FAIL/0 SKIP, Chromium375/1440, build optimisé du code final. Garde runtime/hydratation, réseau et mutations :0 incident ; quatre consentements fixture conservés. Les deux hydratations dev sont **NON REPRODUITES dans ce build optimisé**, aucune correction de DashboardChrome ni filtre d'erreur ajouté. Leur cause précise reste NON ÉTABLIE ; ne pas transformer le run dev en PASS.
- **PASS** TypeScript séquentiel (`typecheck-closure.log`, exit0), lint du delta produit (`lint-reconcile.log`, exit0) et des neuf sources QA (`lint-qa.log`, exit0), SSR3PASS. Helper4PASS antérieur inchangé. Build du delta final PASS (`reconcile-optimized/server.log`).
- Captures finales affichées : `reconcile-optimized/reconciled-result-375.png` et `receipt-unknown-375.png` (opacité finale attendue). Résultat, erreur, texte et référence ont des états distincts ; aucune refonte.
- Mesures du delta final : récupération GET après réponse perdue365/367ms (375/1440, fixture200ms), confirmation cancel359/363ms (fixture300ms), expiration lookup10907ms. Ce sont des mesures locales synthétiques, sans assertion de SLA ou de performance distante.
- Preuves de l'ordonnanceur :46PASS du run optimisé précédent, dont les scénarios auto inchangés ; les52nouveaux PASS ciblent production/reprise et recouvrent ses anciennes régressions. Ne pas sommer46+52 comme scénarios distincts.
- Manifeste des huit fichiers produit, dépendances/config de test et neuf sources QA : `source-manifest.json`. La prochaine gate doit porter sur le SHA intégré par T1 avec son GET de réconciliation et sa correction de confidentialité auto/config.

## Contrôles de livraison

- **PASS** scan Gitleaks du diff textuel staged (`gitleaks-text.json`, aucun finding, exit0). Le scan incluant `--binary` conserve deux alertes expurgées `sourcegraph-access-token` dans les sections de patch binaire des captures PNG `reconcile-final/receipt-unknown-1440.png` et `reconcile-optimized/receipt-unknown-1440.png` ; triage des sections dans `gitleaks-triage.json`. Ce sont des alertes de représentation binaire, pas une clé de configuration détectée dans le code. Le scan brut reste exit1 et n'est pas renommé PASS.
- **PASS** `git diff --cached --check` sur code, documentation et tests en excluant seulement les journaux `.log` bruts. Le contrôle intégral conserve des diagnostics de whitespace provenant des sorties de build (retours chariot et lignes finales), sans réécrire ces preuves.
- Le log dev conserve également deux avertissements de mise à jour React avant montage ; aucun incident runtime/hydratation dans le run optimisé final.

Dernier `detect_changes --scope staged` après ajout des journaux :137fichiers/55symboles/367flux, CRITICAL (`detect-closure.txt`), mêmes associations étrangères et sortie plafonnée. La revue des chemins staged confirme exactement8fichiers produit autorisés ; le reste est QA et documentation T07.
