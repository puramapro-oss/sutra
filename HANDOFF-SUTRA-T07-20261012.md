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
