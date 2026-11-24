# SUTRA T07 — reprise du 12 octobre 2026

## Livraison courante

- Branche : `codex/sutra-t07-ux-ui-reprise-20261012`.
- Base T01 locale et distante vérifiée : `589732cb49959c1a576a3ba381b310cd594600ac`.
- Statut : **LOCAL_T07_DELTA_VERIFIED — INTEGRATION_T01_REQUIRED**.
- Code/preuves : `b2e7f3a89af740537f5b2e3fa8ab85d7a125dcda`. Le présent handoff est son commit documentaire enfant ; le SHA final poussé sera consigné dans `.coord/handoffs/SUTRA-20261012/T07-HANDOFF.md`. Les 44 empreintes source/configuration et les 39 empreintes de preuve sont vérifiées depuis ce commit avec `git show`.
- Worktree : `/Users/matissdornier/purama-worktrees/sutra-t07-ux-ui-20261012`.
- LOCKS : `SUTRA-T07-20261012:REPRISE-589732c`. Reprise limitée au delta UI ; ancienne branche T07 et WIP des autres propriétaires préservés. La livraison T07 initiale a déjà été intégrée par T01 : elle n'est pas réappliquée.
- Mandat courant : commit et push autorisés. Aucun déploiement, secret, appel payant, migration distante ou changement serveur. `vercel.json` désactive l'auto-preview pour cette seule nouvelle branche ; la garde T01 est conservée.

## Delta à intégrer

| Fichiers | Correction |
| --- | --- |
| `src/hooks/useProductionGeneration.ts` | Une réponse tardive conserve l'étape choisie pendant la génération ; progression bornée, résultats et cleanup protégés après annulation client. |
| `src/hooks/useEditorHandlers.ts` | Verrou synchrone d'export ; départ de l'éditeur annule le fetch client et supprime les notifications obsolètes. Ne prétend pas annuler le job serveur. |
| `src/hooks/useVideoGeneration.ts`, `src/app/(dashboard)/create/page.tsx` | Mots-clés rattachés au script courant ; requêtes identiques en cours dédupliquées, réponses dépassées annulées. Une étape inchangée conserve sa sélection ; modifier puis revenir à un script pendant une requête conserve le bon script. |
| `src/components/create/StockPicker.tsx` | Réponse la plus récente prioritaire, cleanup, déduplication et choix utilisateur préservés. Recherche nommée, focus visible, cibles de 44 px, état sélectionné annoncé, erreurs séparées du vide et chargement annoncé, responsive et motion réduit dans le design system existant. |
| `scripts/ui-isolated/t07-reprise.mjs`, `scripts/ui-isolated/t07-flows.mjs` | Sept régressions navigateur ajoutées au harnais de production existant ; neuf audits axe supplémentaires. |
| `vercel.json` | Garde anti-déploiement de la branche T07 uniquement. |
| `qa/t07-reprise/`, `BATON.md`, `task_plan.md`, présent handoff | Preuves et reprise coordinateur. |

Les cinq références protégées restent dans l'ascendance. Seize fichiers des zones PR3 (auth/session, navigation, modale, dépendances) sont strictement identiques à **T01 589732c**, y compris ses corrections post-PR3. [Préservation](qa/t07-reprise/preservation.json). Aucun lockfile ni contrat serveur modifié.

## Validation locale fraîche

Environnement : Node **24.21.0**, npm **11.12.1**, Next **16.3.8**, Chromium réel headless **145.0.7632.6**. Fixtures locales et connexions Node/navigateur externes bloquées pour les tests produit ; aucune lecture de fichier d'environnement. [Commandes reproductibles](qa/t07-reprise/README.md), [manifest source/configuration](qa/t07-reprise/source-manifest.json).

| Gate | Résultat |
| --- | --- |
| Typecheck, ESLint, production webpack | **PASS**, 0 erreur lint / 111 avertissements ; 197 pages générées. |
| Navigateur production `next start` | **210/210 PASS**, 320 / 375 / 768 / 1280 / 1440 px. |
| Axe WCAG 2 A/AA | **164 audits, 0 violation détectée** ; 0 exception navigateur / erreur d'hydratation capturée. |
| Legacy Playwright complet | **1022 PASS, 25 SKIP, 0 échec** en une exécution complète. |
| Contrats Node | **427 PASS, 7 SKIP** ; schedule/composition/publication PASS. |
| Médias locaux | **33 PASS** avec FFmpeg compatible. |
| PostgreSQL isolé | Migration **13**, concurrence **9**, permissions/RLS **49** PASS. Clusters de test arrêtés et conservés. |
| Python déploiement simulé | **9 PASS** ; aucun déploiement exécuté. |
| Actionlint / Shellcheck | **PASS** sur workflow / askpass. |
| Audit dépendances production | **0 haute/critique**, 5 modérées / 2 faibles ; seuil haute PASS. |

Les 25 skips legacy sont documentés dans [skips.json](qa/t07-reprise/evidence/legacy/skips.json) : 6 barrières d'authentification, 6 skips explicites sans motif, 13 variantes non applicables au projet desktop/mobile. Aucun test flaky.

Les sept skips des contrats concernent quatre tests INSEE réels, deux tests DB distante et un test réseau OpenTimestamps. Les tests PostgreSQL locaux séparés ne qualifient pas ces accès distants.

[Résultats navigateur](qa/t07-reprise/evidence/browser/results.json), [captures affichées et revues](qa/t07-reprise/evidence/browser/screenshots/) : connexion 320, stock 320/1440, bibliothèque 375, production 768, réglages 1280, dashboard 1440, éditeur 1280. Les parcours incluent formulaires auth, navigation mobile, création, production, bibliothèque remplie/vide/loading/error, modales, réglages, clavier et focus. Mesures locales sur dix navigations avec animations normales : DOMContentLoaded **19–185 ms**, load **37–306 ms**, aucune tâche >50 ms observée. Mode réduit/canvas contrôlé. Ce ne sont ni des mesures terrain ni des performances de fournisseurs réels.

Les essais RED conservés montrent les défauts client avant correction, dont la course du cache lors du retour au script précédent. Deux ajustements d'environnement sont documentés avec leurs échecs initiaux : FFmpeg Homebrew sans filtres drawtext/subtitles remplacé pour le test par le binaire compatible existant ; PostgreSQL lancé avec `LC_ALL=C` après refus macOS. Le code serveur n'a pas changé.

## Risques et blocages réels

- **Intégration T01 requise** : cette branche est une livraison propriétaire, sans merge ni déploiement. Revoir son delta depuis 589732c puis rejouer uniquement les gates touchées par l'intégration.
- **GitNexus limité** : impacts directs résolus LOW (un appelant des hooks/composant), callbacks React parfois UNKNOWN. Index de la base TRUNCATED (929 candidats d'entrée exclus, 519 callees ignorés et quatre coupures de parcours). Détection staged : **19 symboles, 5 flux, risque MEDIUM** dans création/production ; nouveau module de test revu directement. Le CLI abrège ses résultats ; aucune certification exhaustive du graphe. Preuves `impact-*.txt` et `detect-staged.txt`.
- **CI T01 externe bloquée** : run [38289517548](https://github.com/puramapro-oss/sutra/actions/runs/38289517548), SHA 589732c, échoue dans les trois jobs avant les tests car `SMARANA_READ_TOKEN` lecture seule manque. Initialisation PostgreSQL distante PASS. Lecture seule du résultat, aucun secret consulté/modifié. [Preuve](qa/t07-reprise/evidence/integration-ci.json). La branche T07 ne déclenche pas le workflow limité à main/T01.
- **Non qualifié** : VoiceOver/NVDA natif, Safari/Firefox, appareils physiques, Docker/Linux/OVH, OAuth/DB/fournisseurs réels et production payante. Les noms/rôles/états sont testés par Chromium/axe/clavier, sans attestation de lecteur d'écran natif.
- Les limites produit héritées de T01 restent explicites : fonctionnalités S5 hybride/versions/logger non intégrées ; édition de script sans régénération vocale ; contrat d'upload média manuel à qualifier par son propriétaire. Aucune correction serveur parallèle introduite.
- Build avec avertissement Next Edge `process.cwd`, dépréciation Node `module.register` ; 111 avertissements lint. Les alertes de sécurité modérées/faibles agrégées ci-dessus restent à suivre par T01, sans modification de dépendances dans ce lot.

## Archive — livraison initiale PR3 (supplantée par la reprise ci-dessus)

Les résultats et blocages ci-dessous sont historiques. En particulier, l'ancien lint FAIL et l'ancien statut « aucun push » ne décrivent pas la reprise sur 589732c.

# SUTRA T07 — UX/UI — 2026-10-12

## Livraison et propriété

- Statut : **LOCAL_UI_DELTA_VERIFIED — INTEGRATION_T01_REQUIRED**.
- Code et preuves : `96faec6197c5c0fa5a1ddbe09b72f946895e1637`.
- Base PR3 : `7088a0a3e733de8d2e85f3576bd86627127da369`.
- Branche : `codex/sutra-t07-ux-ui-20261012`.
- Worktree : `/Users/matissdornier/purama-worktrees/sutra-t07-ux-ui-20261012`.
- Mandat et ligne LOCKS : `SUTRA-T07-20261012:ux-ui`. Le checkout SUTRA principal et les autres lots sont préservés. Aucun push, déploiement, secret, base distante ou appel payant.
- Le commit descend des cinq références protégées `35c137f`, `a322e53`, `e1bdd1b`, `05d164d`, `7088a0a`. Seize fichiers PR3 protégés sont identiques à la base, dont session, middleware, callback, navigation, modale partagée et dépendances : [preuve](qa/t07/pr3-preservation.json).
- Les 39 empreintes de sources/tests/dépendances ont été vérifiées avec `git show 96faec6197c5c0fa5a1ddbe09b72f946895e1637:<path>`. Les preuves sont liées à ce code committé : [manifest](qa/t07/source-manifest.json).

## Correctifs livrés

| Périmètre | Comportement final |
| --- | --- |
| Responsive | Création, production, bibliothèque et réglages s'adaptent à 320 px : grilles et actions passent à la ligne, textes longs se replient, skeletons bornés à la largeur disponible. La citation est après le contenu et ne recouvre plus les actions. |
| Navigation et clavier | Onglets accessibles avec flèches, Home/End, focus mobile défilant et panneau nommé. Étapes de création annoncées, liens natifs sur les vidéos, commandes disponibles sur écran tactile. |
| Modales | Création de dossier, actions vidéo et affirmation réutilisent la modale PR3. Fermeture Escape, piège de focus et restauration du focus sont conservés ; formulaire de dossier soumis par Entrée. Choix de dossier borné en hauteur et noms sans espaces repliés. |
| Accessibilité | Labels des champs, états pressed/checked/busy, annonces de chargement/erreur, nom de progression ambassadeur et contrastes des textes secondaires. Les composants et couleurs du design system existant restent la base. |
| Bibliothèque | Erreur distincte du vide, reprise explicite, suppression échouée conservant la carte, pagination échouée conservant les lignes. Recherche toujours montée pendant le chargement, donc focus conservé. |
| Requêtes et rendu | AbortController et identité de requête empêchent une ancienne recherche de remplacer la nouvelle. Verrou synchrone empêchant deux requêtes de pagination dans la même frame. Onglets sans mesure de layout ni mise à jour React sur chaque resize ; miniatures différées. |
| Production et formulaires | Contrôles associés à leurs labels, actions occupées annoncées, erreurs visibles et bouton réactivé après échec. Aucun contrat de génération, de débit ou de provider modifié. |

Le delta touche 35 fichiers existants et deux modules de test ajoutés. Les chemins exacts figurent dans le manifest et dans `git diff --name-only 7088a0a 96faec6`. Aucun changement de `package.json`, lockfile, ESLint, API, session serveur, pipeline, publication ou finance. Le harnais PR3 `scripts/test-ui-isolated.mjs` est étendu avec `scripts/ui-isolated/t07-{flows,runtime}.mjs` ; T01 doit conserver cette extension lors de l'intégration de son tooling.

## Preuves fraîches

Environnement : Node **26.0.0**, npm **11.12.1**, Next **16.3.8**, Google Chrome **154.0.8037.94** headless réel. Dépendances exactes PR3 installées dans ce worktree. Aucun fichier `.env*` utilisé par l'agent ; configuration de test injectée par le harnais, service Supabase local fictif et interceptions des API navigateur. Trafic externe du navigateur bloqué.

| Vérification | Commande / preuve | Résultat |
| --- | --- | --- |
| Production | `SUTRA_CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' SUTRA_UI_PRODUCTION=1 SUTRA_UI_OUTPUT=/tmp/sutra-t07-production node scripts/test-ui-isolated.mjs` | **PASS**, build `next build --webpack`, 197/197 pages puis `next start` |
| Navigateur | Même commande ; [200 contrôles](qa/t07/browser-checks.txt) | **200/200 PASS** à **320, 375, 768, 1280, 1440 px** |
| Axe | [Résultats détaillés](qa/t07/browser-production.json), tags WCAG 2 A/AA | **145 audits, 0 violation détectée** |
| Runtime | Exceptions non interceptées et erreurs console d'hydratation capturées | **0** sur les parcours testés |
| Typecheck | `node_modules/.bin/tsc --noEmit` | **PASS**, exit 0 |
| Régressions session PR3 | `npm run test:auth-session` ; [sortie](qa/t07/auth-session.txt) | **31/31 PASS**, aucun skip |
| Lint du delta | ESLint sur les 37 chemins UI/tests du manifest ; [sortie](qa/t07/lint-delta.txt) | **PASS : 0 erreur, 4 avertissements** |
| Lint global | `node_modules/.bin/eslint --ignore-pattern '.gitnexus/**' .` ; [sortie](qa/t07/lint-global.txt) | **FAIL hérité : 7 erreurs, 108 avertissements** |
| Préservation | [Comparaison PR3](qa/t07/pr3-preservation.json), manifest vérifié depuis le commit | **PASS** |

Parcours : pages publiques et auth visuelle ; dashboard ; création automatique et six étapes manuelles ; sept étapes de production ; bibliothèque vide/remplie en grille et liste ; réglages Profil/Compte/Abonnement/Notifications/Apparence/Données. Contrôles supplémentaires : stockage navigateur refusé, redirection de connexion, recherche mobile, sidebar repliée, upload logo simulé avec persistance/rejet, thème, récupération de mot de passe, déconnexion et remember-me PR3, erreurs de profil, focus, dialogs et requêtes concurrentes.

Les animations normales sont contrôlées sur les cinq pages du studio à 320 et 1440 px. Le mode réduit désactive le canvas décoratif. Mesures locales sans throttling, cache chaud et services fictifs : DOMContentLoaded **20–35 ms**, événement load **30–47 ms**, aucune tâche >50 ms observée dans ces dix navigations avant axe. Ce ne sont ni un score Lighthouse, ni des Core Web Vitals terrain, ni une preuve de rapidité des providers. Onze [captures](qa/t07/screenshots/) sont conservées ; revue visuelle des vues mobiles, tablette et desktop effectuée. Les blancs de fin de ligne des journaux ont été normalisés sans modifier leurs résultats.

## Impacts, limites et reprises propriétaires

- GitNexus : 49 résultats conservés, 17 LOW et 32 UNKNOWN ; appels React non résolus ne signifient pas absence d'impact. Index local `sutra-t07-20261012` **TRUNCATED**. `detect-changes --scope all --limit 200` avant commit : **37 fichiers, 79 symboles, 10 flux, HIGH** ; avertissement communiqué. Les flux détectés concernent bibliothèque/création/production. Le CLI abrège la liste des symboles et le graphe ne certifie pas une couverture exhaustive. [Impacts](qa/t07/gitnexus-impacts.json), [delta](qa/t07/gitnexus-detect-changes.txt).
- **T01 — intégration/lint** : les sept fichiers en erreur sont strictement identiques à PR3 : tests auto composition/publication/schedule, test release regressions, `ltx.ts`, `production-pipeline.ts`, `sutra-auto.ts`. [Empreintes et preuve](qa/t07/lint-baseline.json). T01 a annoncé son correctif tooling `19ea35f` et transmet les trois erreurs produit à T03/T04/T06. Aucun mélange de dépendances T01 dans cette preuve ; l'intégration Node 24/lock T01 reste à valider par T01.
- Les quatre avertissements du delta concernent trois usages `<img>` existants et une navigation interne `location.assign` d'Abonnement. Build avec avertissement Next Edge Runtime sur `process.cwd` et dépréciation Node `module.register` ; compilation réussie.
- **T03 — contrat médias manuels préexistant** : `CreateHelpers.UploadZone` ne transmet actuellement que le nom dans son état local, sans contrat de remise du fichier au pipeline. L'accessibilité du sélecteur est corrigée ; l'upload réel des médias manuels n'est pas certifié. Conserver cette distinction lors du raccordement pipeline, sans remplacer l'upload durable du logo PR3.
- **T08 — diagnostic S5 B02** : le callback de confirmation et l'erreur « Plan non valide » signalés sur S5 `6a64fba` sont absents de `create/page.tsx` et `useVideoGeneration.ts` sur cette base PR3. Aucune transposition de ce correctif S5 ; T01/T03 devront requalifier le contrat de confirmation lors de l'intégration. Les constats axe T08 sur S5 ne qualifient pas PR3 ; les résultats T07 ci-dessus portent sur les parcours effectivement testés.
- **SIMULÉ** : identité, données, stockage, erreurs de génération et APIs distantes. **NON TESTÉ** : OAuth réel, DB/RLS distante, génération/export/publication payants, lecture VoiceOver/NVDA native, Safari/Firefox, appareils physiques, zoom système et réseaux contraints. Les noms/rôles/états accessibles sont vérifiés par Chrome/axe/clavier, sans attestation de lecteur d'écran natif.
- Affirmation quotidienne : migration vers le composant Modal PR3 et stockage tolérant aux erreurs vérifiés en source/build ; le déclenchement quotidien avec données réelles n'est pas couvert par la fixture.
- Aucune certification de release, déploiement ou Store. Reprendre par revue du delta committé T01, puis uniquement les validations touchées par l'intégration. Ne pas rejouer les PASS inchangés de ce lot.

## Documents de reprise

[BATON.md](BATON.md), [task_plan.md](task_plan.md), [validation machine-readable](qa/t07/validation.json). Ce handoff est un commit documentaire enfant du commit code/preuves ci-dessus ; il ne modifie pas le code testé.
