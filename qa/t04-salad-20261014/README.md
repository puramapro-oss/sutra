# T04 Salad — preuve locale du 14 octobre 2026

Branche `codex/sutra-t04-salad-20261014`, base `14617333bfb21efe1f2a1c91888d3322dde20f5b` (code applicatif `e3b17117256269e281304cd4ab83bc722a6f7894`). Mission distincte réservée dans les deux LOCKS partagés. ACK T01 explicites pour les sept fichiers existants ; aucun pipeline/Shotstack/UI/OAuth/config/OVH modifié. Commit livré identifié dans `.coord/handoffs/SUTRA-20261012/T04-SALAD-20261014.md` du dépôt de coordination, après commit local.

## Résultats

| Contrôle ciblé | Résultat | Preuve |
| --- | --- | --- |
| Worker/client/checkpoint/routage propriétaire/capabilities/host/inspection | 42 PASS, 0 FAIL, 0 SKIP | `contracts.log` |
| Utilitaire legacy CPU, aucun Mac/fallback au propriétaire, garde client | 3 PASS | `legacy-e2e.log` |
| Régressions sélectionnées LTX/WAN/provenance/stock/coût | 9 PASS, 0 FAIL | `routing-regression.log` |
| TypeScript du scope | PASS | `typecheck.log`, `tsconfig.json` |
| ESLint du scope | PASS | `lint.log` |
| Format du diff | PASS | `git diff --check` |
| Secrets du diff staged | Voir `security-scan.log` et manifeste final | Gitleaks stdin, sortie expurgée |
| GitNexus | Impacts préalables puis detect-changes staged ; graphe tronqué | `gitnexus-final-index.log`, `gitnexus-detect-changes.log` |

Reproduction unique : `python3 qa/t04-salad-20261014/run.py contracts legacy-e2e routing-regression typecheck lint`. Le runner enregistre la commande précise dans son code et accepte `T04_NODE` pour un Node 24 local équivalent. Il construit un environnement fermé sans credentials hérités; `qa/t08/offline.cjs` interdit réseau externe et lecture `.env*`. Aucun install/build/gate globale. `verification.json` associe les empreintes du scope et dépendances aux résultats.

Les 42 contrats ont été rejoués après le dernier delta `readActive` ; TypeScript/lint également. Les preuves legacy (3) et régressions API (9) ont été réutilisées après ce delta worker exclusivement : elles ne parcourent pas la readiness du worker actif. Aucun PASS inchangé inutilement rejoué. Les fichiers `contracts.tap` (première passe 25 tests), `typecheck.txt`, `lint.txt` et `gitnexus-index.log` sont conservés comme étapes historiques et ne constituent pas la preuve finale.

## Ce que les tests prouvent

Configuration désactivée sans IO ; worker sans clé de compte/gateway ; authentification avant corps/DB ; origine Gateway protégée et bridge loopback stricts ; timeout en-têtes/corps, tailles bornées et erreurs sans diagnostic brut. Intention persistée avant POST, identité stable, soumissions concurrentes atomiques, CAS perdu, réponse perdue/404/restart et reprise GET-only, UNKNOWN permanent. Lecture du slot durable obligatoire avant ready, avec tests running/unknown/expiré/absence/erreur/résultat invalide. Aucun remplacement API, stock ou Mac.

Vrais petits fichiers MP4 **CPU synthétiques** contrôlés par ffprobe, contrôle SHA/poids de fichiers synthétiques en lecture seule, listener HTTP loopback réellement exécuté. Probes GPU/PyTorch sont injectés dans les fixtures et jamais lancés sur le Mac. Le smoke de l’entrypoint désactivé quitte sans connexion ni écoute. Le worker actif Linux/GPU n’a pas été démarré.

Le journal mémoire des tests est uniquement un double de contrat ; le host de production importe exactement `createSaladPersistence` de T01. T04 ne revendique pas ici une preuve PostgreSQL ni le candidat intégré T01. Celui-ci fournit la persistance réelle, `readActive()` via `load_job(NULL)`, les permissions à cinq fonctions et sa recette concurrente indépendante. Rien n’a été appliqué à distance.

## Portée de GitNexus et sécurité

L’analyse a été exécutée dans un stockage de graphe propre au worktree, sans modifier le graphe d’un autre terminal. Les impacts HIGH/CRITICAL ont été signalés avant édition (notamment téléchargement/checkpoint et estimation de coût). Relecture directe des callers et tests ciblés complètent l’analyse. Index final : 14883 nœuds, 28666 relations, 354 flows, mais **1027 entry points, 545 callees et 3 walks omis par budgets**. L’absence d’un flow n’est pas une preuve d’absence : certification exhaustive du graphe **UNKNOWN**. Scope Git/diff vérifié séparément ; aucun graphe/base/cache versionné.

Aucun secret réel lu ou copié, aucun `.env.local`, aucune sonde de fournisseur, aucune génération payante/GPU, publication, provisioning, migration, push, fusion ou déploiement. La source unique future reste le master privé, configuration T01 seule. La preuve RunPod/Shotstack/OAuth/Suno fraîche du coordinateur n’a pas été réinterprétée depuis l’ancien bilan.

## Activation restant hors de ce lot

T01 intègre/reteste les deltas des propriétaires, son preflight création, sa persistance et les fixtures T02/T03 (`generationTimeoutMs` + `readActive`). Il reste une image réelle par digest, mesures VRAM/CUDA/empreintes/profils, devis daté, budget explicitement autorisé, endpoint/token, rôle PostgreSQL restreint et consentement explicite à toute dépense/activation. Voir `src/lib/salad/container/README.md`. Ce sont des preuves de déploiement/qualification absentes, pas une autorisation d’effectuer ces actions. La vidéo seule passe par le moteur open source ; script/voix/musique/composition restent potentiellement payants.
