# T08 → T01 — QA modes finale, 14 octobre 2026

- Branche : `codex/sutra-t08-final-modes-20261014`.
- Base : `14617333bfb21efe1f2a1c91888d3322dde20f5b` ; code `e3b17117256269e281304cd4ab83bc722a6f7894`.
- SHA de livraison : commit contenant ce handoff, reporté intégralement après création dans `.coord/handoffs/SUTRA-20261012/T08-FINAL-MODES-20261014.md` ; aucun push/merge.
- Périmètre livré : `scripts/test-t08-final-modes.mts`, `qa/t08-final-modes/**`, ce handoff et ajouts BATON/task_plan du worktree isolé. Aucun fichier produit, configuration ou dépendance modifié.

**Ciblés : 3 PASS / 1 FAIL ; TypeScript ciblé et lint PASS.** Commande Node24 : `node qa/t08-final-modes/run.mjs`. Le runner sort1 à cause du défaut produit documenté, jamais masqué par un skip. Aucun test T02/T03/T05, global CI/build ou appel fournisseur dupliqué.

**Correctif reçu pendant l'audit : T01 `42b03bace47bd4ee49cb6d2f435deb11a77b2299`, quatre tests T08 PASS.** T08 vérifie le reçu committé, le diff et l'empreinte exacte du test identique ; aucun rerun ni fusion. MODE-03 est résolu sur ce commit T01, le résultat rouge de la base reste conservé comme reproduction. Preuve `qa/t08-final-modes/owner-evidence.json`.

Défaut T08-MODE-03 : owner serveur + worker personnel désactivé → HTTP503, code générique `SUTRA_GENERATION_FAILED`, cause de mode indisponible perdue. Zéro appel worker/API de repli simulé. Route/dispatch/statut réels, session/DB/file/transport simulés. Propriétaire correctif : T01 en coordination avec T04 ; catch de `src/app/api/create/route.ts`. Impact informatif du statut partagé HIGH/quatre routes ; aucun correctif transversal T08.

Les trois PASS couvrent identité cliente non usurpable par corps/en-tête au dispatch, API cliente conservée worker on/off et absence de repli payant après HTTP503/timeout. **Salad/capabilities ne sont pas présents dans la base testée : BLOQUE jusqu'au contrat réel/candidat T04/T01.** La preuve local-engine ne certifie pas ce futur raccord ou un GPU réel.

Réutilisation : 837/838 entrées du manifeste final identiques ; seul guide de déploiement actualisé au commit documentaire. Produit/dépendances inchangés. OAuth/Suno corrigés ; reçu T01 immuable57e4042 confirme RunPod health200, Shotstack stage/v1 templates200 et binding Zernio, zéro compte. Aucun ancien verdict401/403 ou OAuth48f2d5e réutilisé.

À intégrer dans la décision T01 : défaut export T05-MEDIA-01 (tests commitcca76a2, correctif attribué à T05) et reconnexion UI revoked T06 (tests commit48c3191, correctif attribué à T07). T01 a reçu ces tests au commit6e14ca9 ; défauts encore ouverts dans la photographie. Détails dans `qa/t08-final-modes/coordination/`.

Réutilisés sans doublon : T02 sécurité31/31 PASS, dont Salad désactivé explicite ; T03 pipeline16/16 et adaptateur9/9 PASS. Six empreintes des vrais modules T04 égales aux reçus. Preuves WIP simulées : aucun raccord intégré, persistance SQL ou GPU certifié. T08 n'importe pas de produit T04.

- Matrice complète PASS/FAIL/BLOQUE/NON TESTE : [qa/t08-final-modes/MATRIX.md](qa/t08-final-modes/MATRIX.md).
- Plan smoke sur candidat T01 : [qa/t08-final-modes/SMOKE-T01.md](qa/t08-final-modes/SMOKE-T01.md).
- Commandes, frontières et preuves : [qa/t08-final-modes/README.md](qa/t08-final-modes/README.md).

Prochaine action T01 : fixer le candidat exact après collecte T04, corriger les défauts via leurs propriétaires, exécuter les seuls contre-tests affectés et la recette modes réelle, puis sa gate finale unique. Certification release Salad BLOQUE ; GPU/musique/rendu/publication réels NON TESTE. Aucune action utilisateur de clé RunPod/Shotstack n'est demandée par ce bilan actualisé. Les consentements réseaux restent manuels après correction de l'UI ; aucun achat/activation Salad requis pour cette QA gratuite.

Clôture technique : Gitleaks staged expurgé PASS ; GitNexus detect_changes LOW, zéro processus, limite de graphe explicitée ; revue directe du scope et diff-check PASS. Aucun secret lu/affiché, GPU Mac, génération, publication, migration, production, déploiement ou terminal tiers interrompu. Réservations limitées au lot QA ; T01 seul config/OVH/Zernio/intégration.
