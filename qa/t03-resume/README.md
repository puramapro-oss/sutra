# Validation T03 après intégration

Base exacte : `589732cb49959c1a576a3ba381b310cd594600ac`.
Worktree sans `.env*`, dépendances de T01 réutilisées en lecture seule. Aucun
serveur de production, fournisseur payant, publication, déploiement ou migration
distante. Les fournisseurs des tests sont simulés ; PostgreSQL et FFmpeg sont
réels, locaux et alimentés exclusivement par des données synthétiques.

Commandes exécutées depuis le worktree, Node 24 du cache local :

```sh
npm exec --offline --package=node@24 -- node scripts/run-ci.mjs contracts
PATH="$PWD/test-results/media-bin:$PATH" npm exec --offline --package=node@24 -- node scripts/run-ci.mjs media
npm exec --offline --package=node@24 -- node qa/t03-resume/run-postgres.mjs --full
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" LC_ALL=C NODE_OPTIONS="--require=$PWD/qa/t08/offline.cjs" npm exec --offline --package=node@24 -- node scripts/test-security-rls.mjs
npm exec --offline --package=node@24 -- node scripts/run-ci.mjs quality
npm exec --offline --package=node@24 -- node node_modules/eslint/bin/eslint.js qa/t03-resume/*.mjs scripts/test-pipeline-postgres.mts
python3 -m unittest discover -s deploy -p 'test_*.py'
npm audit --omit=dev --audit-level=high --json
```

Le premier profil `quality` donne typecheck/lint PASS mais build FAIL : Google
Fonts est bloqué par le garde réseau. Le FFmpeg système 9.0.2 sans libass/drawtext
donne six échecs média. Ces échecs initiaux restent dans les preuves. Résolution
locale sans changement produit/UI :

- `test-results/media-bin/ffmpeg` pointe vers le binaire déjà employé par T01 :
  `/Users/matissdornier/purama/sutra/.worktrees/sutra-t05-media-export-20261012/node_modules/ffmpeg-static/ffmpeg`.
- `run-gate.mjs` extrait les quinze déclarations Space Grotesk du CSS T01 et
  copie les trois vrais fichiers WOFF2 dans le cache du seul worktree T03.
  Le mécanisme de test `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` de Next lit ces octets ;
  aucun téléchargement n'est simulé comme réussi. Provenance/hash :
  `evidence/font-cache.json`. Le garde réseau et les credentials factices restent
  actifs pour build et navigateur. Ce mode prouve le build avec polices en cache,
  pas leur téléchargement ni l'intégration fournisseur.

```sh
npm exec --offline --package=node@24 -- node qa/t03-resume/run-gate.mjs build /Users/matissdornier/purama-worktrees/sutra-t01-integration-20261012/.next/static/css/048dadb9f478c4ab.css
npm exec --offline --package=node@24 -- node qa/t03-resume/run-gate.mjs browser /Users/matissdornier/purama-worktrees/sutra-t01-integration-20261012/.next/static/css/048dadb9f478c4ab.css
npm exec --offline --package=node@24 -- node qa/t03-resume/run-gate.mjs legacy /Users/matissdornier/purama-worktrees/sutra-t01-integration-20261012/.next/static/css/048dadb9f478c4ab.css
```

Les bases de test ont des noms uniques, un propriétaire factice et un port privé.
Les clusters démarrés par les runners sont arrêtés en `finally`, leurs données
conservées. `LC_ALL=C` évite l'échec de démarrage PostgreSQL lié à la locale macOS.
Après les derniers ajustements SQL, seuls les tests SQL et les vérifications
touchées sont rejoués. Les 17 tests d'interruption sont inclus dans les 428
contrats PASS et ne doivent pas être additionnés une seconde fois.

Les sorties `*-before-*` documentent les reproductions et l'environnement initial,
pas des échecs persistants. Les fichiers `*-result.json` donnent l'état final des
gates avec polices locales. `quality-results.json` conserve fidèlement l'échec
initial de téléchargement ; `build-result.json` fournit la reprise réussie.

GitNexus : index isolé `sutra-t03-resume-20261012`, stockage
`/Users/matissdornier/purama-worktrees/.gitnexus-t03-resume`. Impact préalable
`assertFinalMedia` CRITICAL (5 appelants directs/5 processus). Les fonctions SQL
ne sont pas indexées : impact UNKNOWN, revue directe et tests PostgreSQL requis.
Le graphe tronqué ne constitue pas une preuve exhaustive de non-régression.

Dernières vérifications après resserrement durée/type JSON : contrats428/7SKIP,
SQL pipeline12, RLS49, `tsc --noEmit --incremental false`, ESLint global
(0 erreur/111 avertissements) et build197 PASS. Média33, navigateur203/155axe,
legacy1022/25SKIP portent sur les scénarios inchangés ; pas de replay gratuit
inutile. Le navigateur a précédé le dernier garde durée/SQL, testé par les gates
ciblées précitées ; aucune preuve de provider ne peut en être déduite.

`legacy-summary.json` contient les statistiques du rapport complet conservé dans
`test-results/legacy/results.json` (1 022 attendus, 25 ignorés, 0 inattendu, 0 flaky).
Les copies de logs versionnées sont normalisées (ANSI et espaces terminaux retirés),
sans modification des résultats. `interruptions.txt` est la première exécution
isolée ; l'exécution finale de ses 17 tests est dans `contracts-contracts.txt`.

CI T01 : `SMARANA_READ_TOKEN` manque, run38289517548 échoue avant tests.
Le harnais T03 ne configure pas la CI T01. Ordre de replay DB testé : v10, v11,
journal T06, permissions T02. Aucun schéma distant modifié.
