# HANDOFF T01 — T08-HARNESS-01 — 2026-10-15

FIN_ECRITURE. Auxiliaire T01, pas T08. Base 56754679abed9aa1e51323c29aed5bef38bc17d0. Aucun commit créé.

Le classificateur exige désormais la méthode observée exacte : GET avec `caughtUnloadDiagnostic`, HEAD avec sa preuve native distincte `caughtHeadUnloadDiagnostic`. Toute mutation, méthode inconnue ou conflit de méthodes pour une même URL/navigation/fenêtre reste bloquant. Les erreurs brutes sont conservées. La branche cross-origin reste GET seulement et conserve les bornes antérieures.

Fichiers remis : `runtime-guard.mjs`, `native-controls.mjs`, `guard.test.mjs`, et ce dossier `method-boundary-20261015/`. Aucun fichier T08, produit, SQL, runner ou secret modifié. Aucun build complet, fournisseur, OVH ou déploiement. Modifications tierces présentes, dont AGENTS et le lot SQL T01, préservées.

## Commandes et preuves

Depuis `/Users/matissdornier/purama-worktrees/sutra-final-providers-20261013` :

- Avant : `node --test /Users/matissdornier/purama-worktrees/sutra-t08-acceptance-d21b7b4-20261015/qa/t08-acceptance-d21b7b4-20261015/harness-boundaries.test.mjs` → 2 PASS / 4 FAIL (`t08-before.tap`). Les quatre échecs reproduisent POST/PATCH/DELETE/undefined qualifiés abusivement.
- Après : `node --test qa/t01-final-20261015/browser-harness/guard.test.mjs qa/t01-final-20261015/browser-harness/method-boundary-20261015/t08-boundaries.test.mjs` → 78 PASS / 0 FAIL / 0 skip, 23,2 secondes (`after.tap`). Copie T08 adaptée uniquement pour l'import, provenance et hash vérifiés dans `t08-provenance.json`; source T08 inchangée.
- `npx --no-install eslint qa/t01-final-20261015/browser-harness/runtime-guard.mjs qa/t01-final-20261015/browser-harness/native-controls.mjs qa/t01-final-20261015/browser-harness/guard.test.mjs qa/t01-final-20261015/browser-harness/method-boundary-20261015/t08-boundaries.test.mjs` → PASS (`lint.txt`, vide, exit 0).
- `git diff --check -- qa/t01-final-20261015/browser-harness/runtime-guard.mjs qa/t01-final-20261015/browser-harness/native-controls.mjs qa/t01-final-20261015/browser-harness/guard.test.mjs` → PASS.
- Impact préalable : `node .gitnexus/run.cjs impact <symbol> --file <file> --kind Function --direction upstream --repo . --summary-only` pour classifyRuntimeErrors, nativeRuntimeControls, seed → UNKNOWN, symboles QA absents (`impact-*.txt`). Le premier appel non désambiguïsé à seed avait désigné un symbole produit sans rapport et annoncé CRITICAL ; résultat rejeté et avertissement communiqué avant édition. Appels directs QA consignés dans `direct-callers.txt`.
- `node .gitnexus/run.cjs detect-changes --scope all --repo .` → exit 0, mais ne couvre que des symboles AGENTS étrangers ; ce résultat ne certifie pas le graphe QA (`detect-changes.txt`).

## Portée des contrôles natifs

Node v26.0.0, Chromium 145.0.7632.6, WebKit 26.0, HTML synthétique HTTPS loopback sans SUTRA ni build. `native-results-G9dgxb/native-*.json` conserve les traces.

WebKit : huit diagnostics positifs GET/HEAD × goto/reload × sans query/_rsc reproduits et qualifiés séparément. Six diagnostics POST/PATCH/DELETE × goto/reload reproduits, zéro qualifié et six bloquants. Chromium : requêtes observées mais aucun diagnostic de cette catégorie ; flags GET/HEAD faux. Les contrôles CORS réels de fixtures affirmations/profil (lecture permise et refus), exception JS et promesse non gérée restent PASS.

Limites inchangées : pas de Safari natif, pas de CORS produit/live, pas de certificat de publication, pas de contrôle supplémentaire d'un vrai refus CORS attrapé pendant teardown. Ce résultat est une preuve locale ciblée ; CI sur SHA intégré et nouvelle acceptation indépendante T08 restent au chef. Aucun ACK T08 formulé. Hashes exacts des sources testées dans `summary.json`.
