# T04 → T01 / T08 — fournisseurs final, 2026-10-15

Base intégrée confirmée `cb3f893c35599a6c9c50a4d23c82013c10c5f3ae`. Branche `codex/sutra-t04-providers-final-20261015`, worktree `/Users/matissdornier/purama-worktrees/sutra-t04-providers-final-20261015`. SHA exact de livraison après commit dans le miroir partagé `.coord/handoffs/SUTRA-20261012/T04-PROVIDERS-FINAL-20261015.md`. Importer seulement le delta revu ; ne pas écraser les journaux ni les WIP T01.

Corrections : Pexels ne transforme plus erreurs/JSON malformé en résultat vide ; ElevenLabs clone/list valident identités et bornent le corps ; LTX submission/polling respectent l'annulation/deadline pendant le corps et conservent l'état incertain sans resoumission ; sondes Salad acceptent les noms `_NAME` et refusent les conflits d'alias.

Fichiers existants modifiés exactement :

- `src/lib/pexels.ts`
- `src/lib/elevenlabs.ts`
- `src/lib/ltx-v2.ts`
- `qa/t04-final-providers-20261015/salad-read.mjs`
- `qa/t04-salad-access-20261015/validate-access.mjs` (allowlist CLI)
- `scripts/test-api-contracts.mts` (deux attentes Pexels)
- `BATON.md`, `task_plan.md`, `ERRORS.md` (append T04 uniquement)

Nouveaux fichiers : ce handoff et `qa/t04-providers-final-20261015/**`, inventaire exact SHA-256 dans `delivery-manifest.json`. Aucun fichier Shotstack/pipeline/UI/OAuth/SQL/worker ou conteneur modifié ; composants existants réutilisés.

Tests frais : contrats55 PASS, régressions LTX/sécurité127 PASS, sélection voix/Pexels16 PASS (chevauchement, ne pas sommer), TypeScript PASS, lint0erreur/1warning historique. Reproducteur Shotstack0PASS/1FAIL transmis propriétaire, T01 a repris le fichier20:39UTC. Logs rouges initiaux et preuves vertes conservés. CI de base38797929920 réutilisée seulement pour48fichiers inchangés hashés ; pas de build global rejoué. GitNexus impacts/détection obligatoires exécutés ; graphe tronqué, exhaustivité UNKNOWN.

Matrice pour T08 : RunPod health200 PASS ; Shotstack templates stage/v1 200 PASS mais contrat annulation-corps FAIL sur base ; SunoAPI crédit200 PASS ; LTX contrats PASS/auth live NON TESTÉE ; ElevenLabs GETvoices401 BLOQUÉ ; Pexels format local BLOQUÉ ; Salad format/scope local BLOQUÉ. Tous calculs/coûts réels/GPU sont NON TESTÉS. 5 GET gratuits, zéro mutation/retry/génération ; zéro requête Salad. Aucun secret affiché/copier/committé.

Actions utilisateur : `SALAD_API_KEY`, `SALAD_ORGANIZATION_NAME`, `SALAD_PROJECT_NAME` via https://portal.salad.com/ ; `PEXELS_API_KEY` via https://www.pexels.com/api/key/ ; `ELEVENLABS_API_KEY`/droit voices via https://elevenlabs.io/docs/overview/administration/workspaces/api-keys. Aucune valeur dans ce handoff. Receipt Salad20:36:58UTC : clé présente mais filtre littéral refusé, deux noms absents, aucune authentification distante tentée.

Activation restante T01 : scope Salad authentifié, image construite/digest réel, poids/licences/hashes, PostgreSQL/TLS/stockage/Gateway, budget actuel explicite puis une tâche minimale sur une réplique. Recette conteneur livrée antérieurement, jamais qualifiée GPU par ce lot. LTX webhook/annulation distante non documentés restent indisponibles ; RunPod cancel documenté non exposé, Suno annulation locale seulement. Timeout n'est pas preuve de zéro coût. Pas de fallback payant implicite autorisé ; T01 traite également R86 liste stock réellement vide.

Détails, commandes et sources officielles : [rapport et preuves](qa/t04-providers-final-20261015/README.md). État final : PASS delta local livré, BLOQUÉ credentials/qualification GPU, FAIL Shotstack base remis à T01 ; intégration et production NON TESTÉES par ce lot. Aucun push/fusion/déploiement ni dépense.
