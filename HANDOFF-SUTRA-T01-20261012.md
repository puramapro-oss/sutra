# SUTRA T01 CHEF — 2026-10-12

**T01_CODE_COMMITTED / T01_SCOPE_PASS / INTEGRATION_BLOCKED_OWNER_DELIVERIES.**
La gate globale reste **FAIL**, pas de certification release.

Code livré : `19ea35fbbfe99a978f119f3939ff9935362191dc`.
Branche : `codex/sutra-t01-integration-20261012`.
Worktree : `/Users/matissdornier/purama-worktrees/sutra-t01-integration-20261012`.
Base : PR3 `7088a0a3e733de8d2e85f3576bd86627127da369`.

## Préservation et autorité

AGENTS, politique canonique, deux LOCKS, plans/handoffs, branches, worktrees, processus visibles et WIP inspectés avant écriture. Contrôle de démarrage : `POLICY_OK`. Réservation T01 dans les deux LOCKS ; coordination dans `purama/.coord/handoffs/SUTRA-20261012/`.

Les cinq références demandées restent ancêtres du code livré, vérifiées par `git merge-base --is-ancestor` :

| Référence | SHA préservé |
| --- | --- |
| main demandé | `35c137fc0bc0bd5ff6e54c3ef44ef8b6e46b2fc5` |
| PR1 | `a322e53d046b02005b3e05b91f42083a5ca20b1e` |
| PR2 | `e1bdd1b5489721aef7b7b8a42e946e2dee1202e8` |
| correctif | `05d164daafff3502ab764d852742f5e1bf17a8ca` |
| PR3 | `7088a0a3e733de8d2e85f3576bd86627127da369` |

Le nom local `main` pointait déjà sur `a6568e81c108d911ff827756c9b0ab20c9ae1c97`, tandis que la référence demandée `35c137f` était conservée. Aucun déplacement de branche principale. Checkout canonique `renfort/r4-sutra-smart-split-double-effects@8ff4fd26` intact ; les six fichiers suivis initialement modifiés y ont les mêmes SHA-256 en fin de contrôle. Fichiers non suivis et anciens worktrees conservés. Aucun reset/stash/clean, suppression de worktree, push, déploiement, publication ou migration de production.

## Lot T01 livré

- Installation autonome : configuration ESLint PURAMA embarquée à l'identique avec provenance ; suppression du lien externe `../packages`. SMARANA fixé au commit déjà verrouillé `bc3469eb595485714b2044790105acfc5e3b0f31`, transport HTTPS. Aucune nouvelle version SMARANA.
- Trois corrections transitives compatibles : `bn.js 4.12.5` (override limité à bitcore-lib), `moment 2.31.0`, `dompurify 3.4.16`. Next `16.3.8` inchangé.
- CI web distincte : contrats, média synthétique, typecheck/lint/build webpack, PostgreSQL 16 jetable. Actions fixées par SHA, permissions lecture, logs conservés même sur échec. Installation privée avec scripts désactivés, puis rebuild sans jeton dans l'environnement.
- Runner local : environnement enfant borné et valeurs synthétiques, refus d'un checkout avec fichiers `.env*` locaux, test réseau OTS désactivé. Les erreurs de lint restent bloquantes ; le build est néanmoins exécuté pour fournir sa preuve séparée.
- Garde avant tout SQL destructif du test : confirmation explicite, IP loopback littérale, port et nom `sutra_ci_*`, aucun paramètre de requête. Onze cas positifs/négatifs.
- Stub média : port éphémère communiqué par IPC depuis le processus lancé ; aucun rattachement accidentel au serveur d'un autre terminal.
- ESLint : sorties console et longueur autorisées pour les harnais de tests ; règles produit inchangées. Artefacts générés exclus, ancien `.eslintignore` supprimé.

Aucun fichier `src/` ni migration produit modifié par T01.

## Tests exacts et portée

Exécutés localement sur macOS arm64, Node `24.21.0`, npm `11.12.1`. PostgreSQL local `18.4`, distinct du service CI prévu `16`. Résultats complets dans `qa/t01/evidence/` ; commandes internes et codes de sortie dans `qa/t01/verification.json`.

| Commande | Résultat |
| --- | --- |
| `npm exec --yes --package=node@24 -- npm ci --ignore-scripts --no-audit --no-fund` puis `npm exec --yes --package=node@24 -- npm rebuild --no-audit --no-fund` | PASS, 1116 packages |
| `npm exec --yes --package=node@24 -- node scripts/run-ci.mjs contracts` | PASS : 244 tests, 243 PASS, 1 SKIP OTS réseau ; suites schedule/composition/publication PASS |
| `npm exec --yes --package=node@24 -- node scripts/run-ci.mjs media` | PASS 3/3 ; fichier synthétique réel H264/AAC, 896×512, 16 fps, 6 s, delta audio/vidéo 0 |
| `npm exec --yes --package=node@24 -- node scripts/run-ci.mjs quality` | **FAIL exit 1** : typecheck PASS, lint FAIL, build PASS (197/197 pages) |
| `./node_modules/.bin/eslint eslint.config.mjs scripts/run-ci.mjs scripts/local-engine-stub-server.mjs scripts/test-local-engine-e2e.mts scripts/test-migration-local.mjs tooling` | PASS, 0 erreur et 0 avertissement |
| `SUTRA_DISPOSABLE_DB=1 DATABASE_URL_LOCAL=postgres://matissdornier@127.0.0.1:51269/sutra_ci_t01 npm exec --yes --package=node@24 -- node scripts/test-migration-local.mjs` | PASS, 13 contrôles v10 sur notre cluster jetable ; cluster ensuite arrêté |
| `actionlint .github/workflows/web-ci.yml` ; `shellcheck tooling/git-askpass.sh` | PASS |
| Test askpass à valeur synthétique : deux prompts GitHub autorisés, deux domaines ressemblants refusés | PASS 4/4 ; aucune vraie clé utilisée |
| `npm audit --omit=dev --audit-level=high` | PASS au seuil high ; **5 modérées, 2 faibles**, 0 haute/critique |
| `git diff --cached --check` | PASS avant commit code |

Lint global : `src/lib/ltx.ts` 329 lignes effectives (T04), `src/lib/production-pipeline.ts` 356 (T03), `src/lib/sutra-auto.ts` 333 (T06), limite canonique 300. Ces fichiers sont identiques à PR3 dans T01. Le journal de gate contient 135 avertissements ; deux directives inutiles des tests T01 ont ensuite été retirées, avec lint ciblé vert. Ces dernières éditions et la ligne d'aide SQL sont uniquement des commentaires ; aucun comportement changé après la gate.

L'audit résiduel vient d'OpenTimestamps et de sa chaîne request/uuid/elliptic. Pas de `npm audit fix --force` ni remplacement automatique par la suggestion `opentimestamps@0.0.0`. Correction structurelle à examiner avec T02 sans casser l'ancrage existant.

La CI GitHub n'a **pas été exécutée** : pas de push. Son installation exige un `SMARANA_READ_TOKEN` limité à la lecture du dépôt privé, à configurer côté dépôt ; aucun jeton lu ici. Les PR de forks sans ce secret échouent explicitement à l'installation. Build webpack local vérifié ; Turbopack, EAS/Store et workflow mobile préexistant non qualifiés par cette livraison. Les avertissements Next middleware/Edge restent visibles.

## Matrice des huit lots

État observé, avec chemins/HEAD/WIP dans `qa/t01/coordination-snapshot.json`. Un WIP n'est jamais un payload accepté. Les handoffs finaux des propriétaires doivent fournir des commits, pas une copie de leur checkout.

| Lot | Base observée | Livraison / décision d'intégration |
| --- | --- | --- |
| T01 CI/dépendances/intégration | PR3 | Code `19ea35f`, preuves locales ci-dessus ; gate globale rouge conservée |
| T02 sécurité | PR3, nouveau worktree `security-pr3` | A suivi l'alerte T01 ; ancien S5 propre préservé. Handoff final attendu. Downloader PR3 conservé, extension audio/images annoncée, auth/OAuth/RLS/stockage à recevoir |
| T03 pipeline | PR3 | WIP jobs/checkpoints/routes/export, aucun commit de lot reçu. Réservation exacte T03 non trouvée dans les deux LOCKS lors du contrôle ciblé : ACK propriétaire à consigner. Extraction max-lines et arbitrage export requis |
| T04 fournisseurs IA | S5 `6a64fba` | WIP LTX V2, handoff attendu. PR3 possède déjà le contrat durable ; revue de delta obligatoire, aucun remplacement de fichier S5 |
| T05 média/export | S5 `6a64fba` | WIP FFmpeg/Shotstack/probe/export. Collision T03 et contrat probe PR3 préexistant ; revue sémantique obligatoire |
| T06 social/autonomie | PR3 | WIP journal de publication/revocation/schedules ; réservation publication et calendrier confirmée par sa note. Handoff final attendu ; extraction max-lines requise |
| T07 UX/UI | PR3 | WIP interface et test navigateur ; backend exclu. Handoff et preuves responsive/axe du commit final attendus |
| T08 QA/red-team | S5 `6a64fba` | Brouillon de handoff observé : 46 cas, 25 PASS/21 FAIL annoncés sur S5, non requalifiés ici. Attendre commit ; ses nouveaux tests seront candidats à adaptation PR3, jamais certification PR3 implicite |

## Contrats à réconcilier, conflits et doublons

1. **T03/T04, LTX** : conserver les exports PR3 `LtxJobState`, `LtxJobPersistence`, `LtxJobError`, `durableLtxJob`, ainsi que le paramètre de persistance des appels. Intention enregistrée avant POST non idempotent, identifiant avant polling/téléchargement. Une intention déjà commencée sans ID impose `SUTRA_RECONCILIATION_REQUIRED`, pas une nouvelle soumission. Endpoint/fingerprint doivent rester compatibles. Les nouveaux modules T04 doivent adapter ce contrat pour les callers T03.
2. **T03/T05, export** : collision observée sur `src/lib/export-pipeline.ts` et `scripts/test-auto-export-queue.mts`. Arbitrage transmis : T03 possède `executeExportJob`, état/DB/jobs/checkpoints ; T05 fournit composition/probe/résultat média et remet son hunk au propriétaire du caller. Un seul éditeur final par symbole, ACK encore attendu.
3. **T02/T05, téléchargement/probe** : conserver `downloadVideoBytes` PR3. Extension `downloadMediaBytes` annoncée par T02, à recevoir avant câblage FFmpeg. PR3 possède déjà `media-probe.ts` depuis `05d164d` : `MAX_VIDEO_BYTES`, `ExpectedVideo`, `VerifiedVideo`, `assertMediaProbeAvailable`, `verifyVideoBytes`. La création du même chemin dans S5 n'autorise pas son écrasement. Garder vérification de vrais octets/décodage, protocole local FFmpeg et refus de média invalide.
4. **T05/T06, publication** : conserver `durableRenderJob`, `verifyAndStoreRenderedVideo` et checkpoint `verified` dans l'export. La preuve de publication lie l'URL courante à un SHA-256 de 64 caractères. Le journal T06 ne remplace pas la validation média ; stockage privé/URL signée doivent rester compatibles avec T02.
5. **T02/T06, comptes** : T06 conserve compte révoqué/historique et résultat fournisseur honnête ; l'échec ou le booléen false de déconnexion ne doit pas devenir un succès local. T02 possède OAuth/auth, T06 DELETE comptes/publication. Contrat final à tester après réception.
6. **T03/T06, régressions** : collision observée sur `scripts/test-release-regressions.mts`. Réunir les assertions par scénario après commits, sans choisir une version de fichier au détriment de l'autre. T03 conserve orchestration ; T06 publication/calendrier.
7. **Doublons historiques** : annulation/reprise S1 `e35d79c`/`f3fd3fa` et S5 `bc25535`, variantes `computeNextRun` et corrections UI historiques. Aucun cherry-pick automatique. PR2 timezone/DST et PR3 restent la référence pour comparer les deltas.
8. **T08** : ses résultats S5 ne prouvent pas les mêmes défauts sur PR3. Brouillon routé aux propriétaires : quota/claim/idempotence/export T03 ; CSRF/erreurs/SSRF T02 avec callers ; publication/observabilité T06 ; confirmation de génération et accessibilité T07. Rejouer uniquement les scénarios réellement adaptés au commit intégré.

La comparaison directe S5→PR3 confirme des divergences dans `ltx.ts`, `shotstack.ts`, `video-compositor.ts`, `export-pipeline.ts` et le probe. Aucun merge ou cherry-pick effectué.

## GitNexus et preuves

Index propre à T01. Impacts avant changements : `sq` du test migration LOW, 1 caller direct, 0 processus rapporté ; stub/constantes ESLint UNKNOWN, aucun caller résolu, pas preuve d'absence. Diff direct des chemins et tests ciblés complètent cette limite.

`node /Users/matissdornier/purama/.gitnexus/run.cjs detect-changes --scope staged --repo sutra-t01-20261012` avant commit code : 17 fichiers, 20 symboles, 0 processus rapporté, risque LOW. Graphe **TRUNCATED** : 792 candidats d'entrée, 595 callees et 1 walk coupés. Aucune certification exhaustive revendiquée.

`qa/t01/verification.json` lie le payload au commit code par SHA-256 de chaque fichier relu via `git show 19ea35f:<path>`. Les preuves de WIP étrangères sont seulement des observations de préservation/coordination. Les docs de cette clôture sont un commit distinct ; aucune dépendance envers un fichier produit non committé.

## Reprise unique

**Blocage externe de l'intégration : livraisons finales propriétaires T02–T08 non reçues et arbitrages partagés non acquittés.** T01 est livrable localement ; le SUTRA intégré ne l'est pas encore.

À réception : vérifier commit/base/ownership, relire chaque delta contre PR3, résoudre les trois collisions et les contrats ci-dessus, intégrer uniquement les hunks acceptés, ajouter les nouveaux tests pertinents à la CI puis rejouer les seules preuves touchées. Gate globale finale requise sur ce HEAD intégré, dont lint produit vert et requalification des cas T08. Ne pas rejouer les PASS T01 inchangés. Aucune action de production n'est nécessaire à cette reprise.
