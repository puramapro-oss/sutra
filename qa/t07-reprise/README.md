# T07 — reprise sur l'intégration 589732c

Base distante et locale vérifiée : `589732cb49959c1a576a3ba381b310cd594600ac`.
Branche : `codex/sutra-t07-ux-ui-reprise-20261012`. Ancienne livraison T07 conservée, déjà intégrée par T01.

## Reproduire

Checkout isolé sans fichiers d'environnement locaux. Node 24.21.0, npm 11.12.1, dépendances du lock T01 installées par `npm ci --ignore-scripts --no-audit --no-fund`. Aucun lockfile modifié.

```sh
npm exec --offline --package=node@24 -- node scripts/run-ci.mjs contracts
npm exec --offline --package=node@24 -- node scripts/run-ci.mjs quality
npm exec --offline --package=node@24 -- node scripts/run-ci.mjs browser
npm exec --offline --package=node@24 -- node scripts/run-ci.mjs legacy
PATH="$PWD/test-results/media-bin:$PATH" npm exec --offline --package=node@24 -- node scripts/run-ci.mjs media
python3 -m unittest discover -s deploy -p 'test_*.py'
actionlint .github/workflows/web-ci.yml
shellcheck tooling/git-askpass.sh
npm audit --omit=dev --audit-level=high
```

Le runner efface les credentials hérités, utilise des fixtures, bloque les connexions Node hors loopback et les lectures de fichiers d'environnement. Le navigateur intercepte les API et bloque les origines externes. Le profil browser effectue son propre build avec l'URL du service local injectée, puis utilise `next start`. Le profil legacy construit avec sa propre fixture, puis lance les projets Playwright historiques ; il ne constitue pas un test Safari/Firefox.

Test ciblé de développement : `scripts/test-ui-isolated.mjs --reprise-only`, avec `SUTRA_UI_FOCUS=flows`, environnement nettoyé et préchargement `qa/t08/offline.cjs`. Les journaux RED conservent les défauts initiaux. Le scénario « retour au script précédent » a ensuite reproduit un défaut résiduel du cache avant sa correction. Un délai de navigation de ce test a été porté à 15 secondes pour permettre la compilation à froid en développement, sans changer les assertions produit.

FFmpeg Homebrew 9.0.2 n'inclut pas les filtres `drawtext`/`subtitles` requis : premier essai conservé. Le média passe avec le binaire compatible déjà utilisé par T01, via un lien local en lecture `test-results/media-bin/ffmpeg` vers `/Users/matissdornier/purama/sutra/.worktrees/sutra-t05-media-export-20261012/node_modules/ffmpeg-static/ffmpeg`. Aucun fichier étranger modifié.

PostgreSQL 18.4 local : `scripts/test-security-rls.mjs` crée son propre cluster/socket privé, avec `LC_ALL=C` (premier démarrage sans locale refusé par macOS, journal conservé). Migration et concurrence utilisent un autre cluster jetable `initdb --auth=trust --username=sutra_t07_test_owner --no-locale --encoding=UTF8`, port loopback disponible, base `sutra_ci_t07`, puis :

```sh
SUTRA_DISPOSABLE_DB=1 DATABASE_URL_LOCAL=postgres://sutra_t07_test_owner@127.0.0.1:PORT/sutra_ci_t07 node scripts/test-migration-local.mjs
SUTRA_DISPOSABLE_DB=1 PGHOST=127.0.0.1 PGPORT=PORT PGUSER=sutra_t07_test_owner node --import tsx --test scripts/test-pipeline-postgres.mts
```

Les processus de ces clusters sont arrêtés par les harnesses ; leurs données de test sont conservées. Aucun accès à une base distante.

## Portée des preuves

- Sept nouvelles régressions navigateur : navigation pendant production, nom/largeur du sélecteur stock, erreur distincte du vide/reprise, réponse la plus récente/déduplication/clavier, modification du script/cache inchangé, retour au script précédent pendant une requête, absence de notification d'export après navigation.
- Axe vérifie les tags WCAG 2 A/AA, dont contraste, noms/rôles/états. Débordements et commandes hors écran sont aussi inspectés par le harnais. Lecture VoiceOver/NVDA native non qualifiée.
- Annuler le fetch client ne prouve pas l'annulation d'un job serveur. Aucun contrat API, quota, pipeline, publication ou fournisseur modifié.
- Le graphe GitNexus de la base est tronqué. Les impacts React non résolus restent UNKNOWN ; la revue directe et les tests complètent le graphe sans certifier son exhaustivité.
- Les journaux sources restent dans `test-results/`. Les copies de preuve n'ont que leurs espaces de fin de ligne normalisés. Le manifest final lie les preuves aux empreintes des sources et de la configuration testées.
