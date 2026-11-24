# T01 auxiliaire — barrière de lecture sociale

Base `72f406b940b7e3cdfb27873751a4059375646f25`. FIN_ECRITURE, fichiers remis à T01 ; aucun commit, build, devserver, fournisseur ou environnement distant lancé.

CI `38745298450` conservée : 283 PASS / 1 FAIL, seul WebKit/social. À la navigation 6 le diagnostic `user_notifications` arrive 6 ms après début du goto ; le document précédent vient de charger 104 ms avant. L'instrumentation ne trace volontairement pas cette query pendant unload. L'absence de matching-fetch n'établit donc pas l'absence d'un fetch pendant teardown. La garde a correctement rejeté cet inconnu ; cette preuve reste rouge.

## Delta exact

- `qa/t07-final-ux-perf-20261015/run.mjs` : branche `--social` seulement, installation du helper après la garde runtime, sauvegarde `fixture-read-barrier.json`.
- `fixture-read-barrier.mjs` : avant un goto depuis `/settings/social`, exige un GET exact des notifications de l'identité synthétique, origine fixture, main frame et document courant. Attend HTTP 200 **et requestfinished**, donc corps terminé, puis un tour de tâche du document. Absence, abort, status non 200, changement de document ou délai 15 s produisent FAIL. Aucune relance, networkidle, interception/modification de fetch ou suppression d'erreur. Reçu limité à URL synthétique, méthode, statut, document et horodatages, sans corps de réponse.
- `barrier.test.mjs` : 18 tests, dont contrôles HTML natifs Chromium/WebKit, délais, corps incomplet, absence, origine/query dupliquée, iframe/document périmé, POST/PATCH/DELETE/HEAD, échec HTTP/transport, vrai refus CORS, exception et rejet JavaScript.

`runtime-guard.mjs`, `guard.test.mjs`, `native-controls.mjs` et `social-checks.mjs` sont byte-for-byte identiques à HEAD (`summary.json`). La couverture malformed/slow sociale reste inchangée. Les méthodes inconnues et les mutations ne bénéficient d'aucune nouvelle qualification.

## Validation exacte

```
node --test qa/t01-final-20261015/browser-harness/social-read-barrier-20261015/barrier.test.mjs
```

18 PASS / 0 FAIL / 0 skip, 8075.699542 ms. `test-results-final.txt`, reçus du dernier dossier `results-*` référencé dans `summary.json`.

```
node node_modules/eslint/bin/eslint.js --max-warnings 0 qa/t07-final-ux-perf-20261015/run.mjs qa/t01-final-20261015/browser-harness/social-read-barrier-20261015/fixture-read-barrier.mjs qa/t01-final-20261015/browser-harness/social-read-barrier-20261015/barrier.test.mjs
git diff --check
```

Deux commandes PASS. SHA-256 des trois sources dans `summary.json`.

Impact préalable `node .gitnexus/run.cjs impact runScenario --file qa/t07-final-ux-perf-20261015/run.mjs --kind Function --direction upstream --repo . --summary-only` et même commande pour `installFixtureReadBarrier`/son fichier : UNKNOWN, symboles QA absents. Appels directs recensés dans `direct-callers.txt`, uniquement runner social et test. `node .gitnexus/run.cjs detect-changes --scope all --repo .` : exit 0, ne voit que des symboles AGENTS étrangers, donc aucune certification exhaustive du graphe QA.

## Limites conservées

Le premier témoin HTML beforeunload seul n'a pas reproduit l'erreur WebKit locale : reçu rouge 15/16 conservé dans `test-results.txt` et `results-nkFZgX`. L'ajout explicite de pagehide reproduit le diagnostic bloquant (aucune qualification) ; après attente du GET, zéro erreur. Ce témoin montre un mécanisme de lecture différée ; il **ne prouve pas** la cause React exacte du rouge CI. Chromium n'émet pas ce diagnostic dans le témoin avant, résultat conservé.

WebKit Playwright 26.0 et Chromium 145.0.7632.6, pas Safari natif. Aucun certificat CORS produit/live. L'exécution ciblée de l'application exacte et la CI du nouveau SHA restent à T01 dans son sandbox sans secrets. Ne pas déclarer le rouge applicatif résolu avant cette exécution.
