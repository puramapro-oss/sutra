# Livraison T05 — composition et validation fichiers

Branche : `codex/sutra-t05-composition-fix-20261014`.
Base integree T01 : `b7cf848d07fca2734db36a2e30d045ca312a3162` (code `d8691d8ac6cf885f8e5522f361f45ebe229ec20d`). Le commit local contenant ce handoff constitue le lot ; son SHA complet est transmis dans le miroir de coordination `.coord/handoffs/SUTRA-20261012/T05-COMPOSITION-FIX-20261014.md`.

Produit : `src/lib/composition-contract.ts`, `src/lib/ffmpeg-filters.ts` seulement. Trois defauts reproduits/corriges : sous-titres disproportionnes en 4K, cue plus courte qu'une image acceptee, cles heritees d'Object acceptees comme exigences media. Aucun changement media-probe/Shotstack/API/config/OVH ni fichier d'un autre terminal.

Tests : `scripts/test-t05-composition-fix.mts` ; fixtures CPU, lanceur et preuves dans `qa/t05-composition-fix-20261014/`. Details, hashes, avant/apres et limites dans son README. Append BATON/task_plan du worktree uniquement.

Commande : `node qa/t05-composition-fix-20261014/run-targeted.mjs delta contracts media worker auto typecheck lint`.
PASS : 12 nouveaux tests + 33 contrats + 8 medias + 25 worker = 78/78, aucun SKIP/FAIL ; controle auto anti-publication-brute, typecheck cible, lint, gitleaks expurge et diff-check PASS. Presence des six elements testee dans 64 combinaisons, trois orientations, 4K mesuree avec provenance native/upscale distincte. Aucun retour brut apres echec de montage dans les parcours testes.

GitNexus : impact CRITICAL de compositionPlan annonce avant modification ; deux symboles produit attendus detectes. Couverture globale des flux tronquee, compensee localement par lecture des appelants/tests, sans pretendre une preuve exhaustive.

FAIL restant : aucun dans les controles executes. BLOQUE : aucun pour cette livraison locale. NON TESTE : fournisseurs live/GPU/natif IA 4K/qualite perceptuelle reelle, integration finale et deploiement. Aucun secret reel, appel payant, IA Mac, push, fusion ou production. T01 garde l'integration et la campagne globale unique. Aucun consentement utilisateur necessaire pour le lot local.
