# T05 — Salad media, reprise du 14 octobre 01h40

LIVRÉ LOCAL — SHA et bilan final ci-dessous. Base 1461733/e3b1711. Scope exclusif tests t05-salad-media et fixtures synthetiques legeres ; produit lecture seule. T01 conserve config/OVH/Zernio/integration. Aucun appel reseau fournisseur ou GPU, aucune gate globale. Defauts remis T04/T01 avec reproduction.

## Alerte T04/T01 — T05-MEDIA-01 reproduit sur 1461733

24 PASS / 1 FAIL ciblés, aucun produit modifié. `executeExportJob` accepte une autre URL contenant exactement les octets MP4 source (SHA-256 identique), pourtant brief sous-titres obligatoires. La validation annonce `burned-in` / `render-contract` et appelle le callback de persistance. Le refus « vidéo brute » compare les URLs, pas l’identité des octets source/final. Reproduction : `node --import tsx --test --test-name-pattern='DEFECT T05-MEDIA-01' scripts/test-t05-salad-media.mts` dans `/Users/matissdornier/purama-worktrees/sutra-t05-salad-media-20261014`. Aucun vrai compte/storage/provider : callback de persistance simulé, téléchargements HTTPS fermés, fichiers synthétiques décodés réellement.

Propriétaires correctif : T04/T01 selon répartition intégration ; T05 reste tests/preuves seulement. Ne pas transformer le FAIL en skip/TODO ni considérer une URL distincte comme preuve de montage. Pas d’adaptateur Salad présent dans la base testée ; contrat worker existant `local-engine.ts` uniquement, disponibilité/intégration distante NON PROUVÉE. SHA de livraison à suivre.

## Livraison finale locale — notification T01 / T04

**Statut final : LIVRÉ LOCAL, validation média BLOQUÉE par T05-MEDIA-01.** Ce jalon clôt la réservation T05 ; aucun correctif produit entrepris.

- Branche : `codex/sutra-t05-salad-media-20261014`.
- SHA local : `cca76a2b9cf4e88f78d4ad0dc231a7ef48650648` ; parent `14617333bfb21efe1f2a1c91888d3322dde20f5b` (code `e3b17117256269e281304cd4ab83bc722a6f7894`).
- Worktree propre et conservé : `/Users/matissdornier/purama-worktrees/sutra-t05-salad-media-20261014`.
- Commit : `[CODEX] Add T05 remote media regression evidence`. Aucun push ni fusion.
- Produit et dépendances inchangés. 17 ajouts limités au scope réservé ; SHA-256 des entrées dans `qa/t05-salad-media-20261014/verification.json`.
- Tests ciblés : **24 PASS / 1 FAIL / 0 SKIP / 0 TODO**, exit 1 conservé pour T05-MEDIA-01 ; détail et diagnostic `tests.tap`. TypeScript ciblé, ESLint, Gitleaks expurgé, empreintes et diff-check PASS.
- GitNexus avant commit : 17 fichiers, 93 symboles de tests/docs, 0 processus affecté, risque faible. Extraction de processus tronquée : aucune certification exhaustive du graphe.
- Fixtures CPU réelles, 9 médias + corruption dérivée, 92 257 octets ; probe et décodage complets. Aucun fournisseur live, secret lu, GPU, publication, production ou build/gate globale.

### Fichiers exacts du commit

- `qa/t05-salad-media-20261014/README.md`
- `qa/t05-salad-media-20261014/fixtures.mts`
- `qa/t05-salad-media-20261014/gitnexus-detect.log`
- `qa/t05-salad-media-20261014/gitnexus-impact.json`
- `qa/t05-salad-media-20261014/gitnexus-index.log`
- `qa/t05-salad-media-20261014/harness-first.log`
- `qa/t05-salad-media-20261014/lint.log`
- `qa/t05-salad-media-20261014/measurements.json`
- `qa/t05-salad-media-20261014/secrets-proof.log`
- `qa/t05-salad-media-20261014/secrets-test.log`
- `qa/t05-salad-media-20261014/tests-first.tap`
- `qa/t05-salad-media-20261014/tests.tap`
- `qa/t05-salad-media-20261014/tsconfig.json`
- `qa/t05-salad-media-20261014/typecheck-first.log`
- `qa/t05-salad-media-20261014/typecheck.log`
- `qa/t05-salad-media-20261014/verification.json`
- `scripts/test-t05-salad-media.mts`

### Commandes de vérification livrées

```sh
T05_MEDIA_EVIDENCE=qa/t05-salad-media-20261014/measurements.json node --import tsx --test --test-reporter=tap scripts/test-t05-salad-media.mts
./node_modules/.bin/tsc --noEmit --project qa/t05-salad-media-20261014/tsconfig.json
./node_modules/.bin/eslint scripts/test-t05-salad-media.mts qa/t05-salad-media-20261014/fixtures.mts
gitleaks dir --no-banner --no-color --redact scripts/test-t05-salad-media.mts
gitleaks dir --no-banner --no-color --redact qa/t05-salad-media-20261014
```

### Suite minimale coordinateur

1. T01 attribue seul le correctif T05-MEDIA-01 : le chemin de persistance accepte une source inchangée sous une URL distincte avec des sous-titres obligatoires inexistants. La reproduction rouge reste active, sans skip/TODO. Préserver les compositions légitimes sans transformation ; rattacher la preuve de composition aux octets et au brief.
2. Après le correctif et le raccord T04, rejouer cette suite ciblée sur le candidat intégré. Les tests actuels prouvent la frontière worker existante `generateLocalVideo` et les portes média/export sur la base 1461733 ; ils ne qualifient pas un worker Salad déployé ni un nouveau protocole non présent dans cette base.
3. Le runner CI utilise une liste explicite ; T05 ne la modifie pas. T01 décide du raccord de ce nouveau test après correction. Aucune action manuelle utilisateur ou activation fournisseur supplémentaire n’est nécessaire pour reproduire ce défaut.

Compte rendu détaillé : `qa/t05-salad-media-20261014/README.md`. Mesures 4K synthétiques seulement : aucune génération native 4K réelle attestée. T01 seul config/OVH/Zernio/intégration ; aucun autre périmètre transféré.
