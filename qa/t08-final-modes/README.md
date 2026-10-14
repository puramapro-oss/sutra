# T08 — QA indépendante modes, 14 octobre 2026

Base exacte `14617333bfb21efe1f2a1c91888d3322dde20f5b`, applicatif `e3b17117256269e281304cd4ab83bc722a6f7894`. Branche `codex/sutra-t08-final-modes-20261014`. Mission distincte Matiss 01h40 ; T01 reste seul propriétaire config/OVH/Zernio/intégration.

**Base1461733 : 3 PASS / 1 FAIL ciblés. Correctif T01 `42b03ba` : mêmes quatre tests PASS (reçu réutilisé, empreinte exacte vérifiée). TypeScript ciblé PASS, lint ciblé PASS. Release Salad BLOQUE.** Aucun fichier produit modifié. La reproduction rouge sur la base est conservée ; les tests de la nouvelle intégration Salad restent bloqués par la livraison du contrat/candidat T04/T01.

## Exécution et frontières de preuve

```sh
node qa/t08-final-modes/run.mjs
# Ou un seul contrôle touché :
node qa/t08-final-modes/run.mjs modes
node qa/t08-final-modes/run.mjs typecheck
node qa/t08-final-modes/run.mjs lint
```

Runtime utilisé : Node 24.21.0 ; Node avec `--experimental-test-module-mocks` requis. Dépendances existantes partagées par lien, package.json/lockfile identiques à la base ; aucune installation. Le runner fournit une liste blanche d'environnement, des valeurs synthétiques et le garde existant `qa/t08/offline.cjs`. Aucune lecture `.env*`, aucun secret maître nécessaire, aucune connexion distante. Aucun serveur, FFmpeg, GPU ou génération réelle lancé. Les réponses du worker sont injectées par fetch ; les dépendances DB/file et le pont pipeline sont simulés. La route `/api/create`, son schéma, le dispatch `generateVideoSmart`, `local-engine` et `submissionErrorStatus` sont réels. Le test ne prouve pas une transaction DB ni un pipeline complet.

| Test | Verdict | Preuve exacte |
| --- | --- | --- |
| MODE-01 identité cliente / tentative owner | PASS | Identité du corps et de l'en-tête ignorée, identité session conservée ; engine `owner` invalide HTTP400 ; aucun appel worker/API. |
| MODE-02 API cliente normale | PASS | HTTP200 de la route avec worker personnel désactivé puis activé ; deux appels explicites WAN simulés, zéro appel au worker propriétaire. |
| MODE-03 mode personnel désactivé clairement expliqué | FAIL | HTTP503 mais code `SUTRA_GENERATION_FAILED`, message générique ; zéro appel worker/API. Le refus est sûr, la cause exploitable manque. |
| MODE-04 aucun repli payant implicite | PASS | Erreur HTTP503 et timeout du worker simulés sous ancien mode `auto` ; deux essais worker distincts, zéro appel API de repli, erreurs expurgées. Aucune preuve de reprise durable revendiquée. |
| Modes Salad intégrés / capabilities | BLOQUE | Absents de la base1461733 ; dépendance T04/T01, aucun contrat imaginé dans les tests. |

Les logs `modes.log`, `typecheck.log`, `lint.log` et leurs reçus JSON sont la preuve exécutée. Le premier typecheck omettait une déclaration existante `src/types/javascript-opentimestamps.d.ts` ; le tsconfig ciblé inclut désormais les déclarations du dépôt. Aucun changement produit ou dépendance pour cette correction du harnais.

## Défaut remis à T01 : T08-MODE-03

Précondition : session serveur propriétaire, `LOCAL_ENGINE_ENABLED=false`, POST valide `/api/create`. Le worker réel de dispatch lève `SUTRA_LOCAL_NOT_CONFIGURED`; le catch final de `src/app/api/create/route.ts` remplace cette raison par une erreur de génération générique. Attendu : un code stable d'indisponibilité du mode personnel, sans URL, secret ou détail fournisseur ; la forme exacte appartient au contrat T04/T01. Observé : HTTP503, `SUTRA_GENERATION_FAILED`, `Erreur lors de la generation de la video`.

Impact utilisateur : aucune dépense de repli dans cette preuve, mais l'utilisateur ne peut pas distinguer un mode désactivé d'une panne de génération. Correctif produit réservé à T01 avec T04 ; T08 livre le contre-test. Reproduction : commande `modes` ci-dessus ; MODE-03 échoue avant toute génération. Le pont de pipeline simulé ne valide pas les effets SQL d'une tâche remise en file.

**Résolution livrée pendant l'audit :** `42b03bace47bd4ee49cb6d2f435deb11a77b2299` ajoute dans la seule route create une liste fermée de codes/messages publics HTTP503, sans reflet du message fournisseur. Reçu immuable `owner-receipts/t01-mode-error-milestone.json` : quatre tests T08 PASS, TypeScript et lint PASS. T08 a vérifié le diff et l'égalité SHA-256 du test exécuté avec celui livré ici (`owner-evidence.json`), sans rejouer ce PASS inchangé ni fusionner. MODE-03 est **PASS sur ce correctif T01**, reste **FAIL sur la base1461733** reproduite ici. Le futur candidat Salad doit toujours être testé ; ce reçu n'en certifie pas le raccord.

## Réutilisation et actualisation des preuves

`source-equivalence.json` vérifie les 838 entrées du manifeste final intégré : 837 identiques ; seul `deploy/README.md` a été actualisé au commit documentaire1461733. Sa version e3b1711 correspond au manifeste. Aucun delta produit, migration ou dépendance T08. Les preuves locales/CI e3b1711 restent réutilisables dans leurs limites ; elles ne sont pas rejouées et leurs comptes ne s'additionnent pas.

`reused-evidence.json` fixe les empreintes des reçus utilisés. La matrice indépendante est [MATRIX.md](MATRIX.md), la recette du futur candidat [SMOKE-T01.md](SMOKE-T01.md). Les anciens verdicts finaux48f2d5e ne sont pas repris. OAuth/Suno sont corrigés sur e3b1711. Les paragraphes historiques RunPod401/Shotstack403 et binding absent sont remplacés par le reçu T01 récent.

| Fournisseur | État borné à la preuve actuelle |
| --- | --- |
| RunPod | VALIDÉ pour GET endpoint health HTTP200 / contrat, preuve T01 commit57e4042 ; aucun worker prêt observé, soumission/GPU NON TESTE. |
| Shotstack | VALIDÉ pour GET templates stage et v1 HTTP200 / contrats ; rendu NON TESTE. |
| SunoAPI tiers | VALIDÉ pour authentification gratuite et contrat adapté sur e3b1711, preuves T01 réutilisées ; musique NON TESTE. Ce tiers est distinct de Suno. |
| Zernio | VALIDÉ pour API lecture, ownership et binding PURAMA ; zéro compte. ACTION UTILISATEUR REQUISE pour consentements choisis. Reconnexion UI après révocation signalée FAIL par T06, à corriger avant recette. |
| Salad | BLOQUE pour qualification applicative/worker : adaptateur en cours T04, credentials/endpoint non qualifiés par ce lot ; GPU NON TESTE. |

`t01-provider-receipt.json` est une projection sans valeur sensible du reçu `activate.json`, octets vérifiés au commit `57e40428124850cbd1463538e7d9673069ceed64`. Maître source unique et permissions0600, comparaison Mac/runtime égale, origines et autres conteneurs préservés selon T01. T08 ne lit pas les secrets, ne copie aucune configuration et ne refait aucun GET fournisseur/SSH. Le binding est une attribution serveur prouvée par T01, pas une clé inventée.

Les handoffs T02/T03/T05 sont réutilisés sans lancer leurs suites. Leur photographie datée se trouve dans `coordination/`. `owner-evidence.json` conserve les reçus T02/T03 : **31/31 PASS sécurité**, **16/16 PASS pipeline simulé** et **9/9 PASS reprise adaptateur**, avec six modules T04 comparés à leurs empreintes exactes. Ces modules sont encore WIP, pas intégrés à1461733 ; journaux/transport/bridge restent des doubles. T02-C01 prouve déjà Salad désactivé → `SALAD_DISABLED`, capabilities disabled et zéro réseau : aucun doublon T08 de ce test. Le parcours HTTP propriétaire intégré reste BLOQUE.

T05 livré `cca76a2b9cf4e88f78d4ad0dc231a7ef48650648` rapporte un FAIL export (octets source acceptés comme rendu malgré sous-titres requis), T06 livré `48c3191aa76b7ce7a42aa008250d7fc829fffc15` un FAIL reconnexion après révocation. T01 a reçu leurs tests dans `6e14ca9dbb0202655a4bdb079e188770d59d5bbf` et attribué les correctifs respectivement à T05 et T07. Ces défauts restent ouverts à l'instant de cette photographie ; aucune correction ultérieure présumée.

## GitNexus et clôture

Index isolé base1461733 ; 14344 nœuds, 27320 arêtes, 357 flux. Graphe partiel : 963 entrées non retenues, 533 callees omis, trois parcours coupés ; FTS désactivé. L'absence de résultat n'établit pas l'absence de chemin. Analyse informative `submissionErrorStatus` : HIGH, quatre routes appelantes (create/production/auto-generate/export), aucun symbole produit édité. `detect_changes --scope staged` exécuté : risque LOW, quatre sections documentaires reconnues, zéro processus affecté. Les nouveaux tests ne sont pas indexés dans ce graphe de base : ce résultat seul ne les couvre pas. Revue directe Git : ajouts QA/docs exclusivement, aucun fichier produit/config/dépendance modifié. Gitleaks staged expurgé PASS, zéro détection. Reçus `gitnexus-changes.txt`, `gitleaks.json`/`gitleaks.log` et `verification.json` ; aucune certification exhaustive du graphe.

Aucune CI/build globale, publication, migration, fusion, push, déploiement, provisioning ou appel payant pendant T08. Aucune certification de release/GPU. Le consentement utilisateur aux réseaux doit être effectué manuellement après résolution de l'UI ; aucun achat ou activation Salad demandé pour conclure cette QA gratuite.
