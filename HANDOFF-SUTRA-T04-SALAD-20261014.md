# HANDOFF SUTRA T04 — Salad, 14 octobre 2026

Livraison locale désactivée. Branche `codex/sutra-t04-salad-20261014`, base `14617333bfb21efe1f2a1c91888d3322dde20f5b` (application `e3b17117256269e281304cd4ab83bc722a6f7894`). Le SHA final du commit contenant ce handoff est transmis à T01 dans le bulletin partagé `.coord/handoffs/SUTRA-20261012/T04-SALAD-20261014.md`. Aucun push, fusion, déploiement ou changement distant.

## Résultat

Adaptateur propriétaire unique raccordé à `tryLocalRoute` et au checkpoint durable existant, avec configuration séparée app/worker, contrat HTTP authentifié, host exécutable et inspection runtime réelle. Les clients restent sur les API existantes. Le propriétaire sans contexte durable/qualification ne peut pas partir sur Mac, API ou stock ; une ancienne intention API se réconcilie sur son fournisseur, sans conversion en Salad.

Soumission persistée avant POST, ID déterministe, slot d’exécution exclusif, CAS, polling borné et reprise GET seule ; perte de réponse/timeout/404/éviction conservent UNKNOWN. Artefact externe immuable SHA-256, tailles/profil ffprobe et provenance vérifiés ; coût estimé fondé sur devis, coût réel/quota inconnus explicites, état distant et HTTP conservés. Pas d’annulation, webhook, I2V/V2V/retake/extension/références/audio/4K native annoncés sans contrat prouvé. Texte-vers-vidéo seul, modèle exact LTX-Video 0.9.8 distilled FP8, distinct de l’API LTX V2 existante.

Host désactivé par défaut, aucune clé de compte Salad montée sur GPU. Inspection Linux/amd64, poids réels SHA-256 et reçu image indépendant, VRAM/CUDA/file ComfyUI et bridge privé ; aucun moteur lancé par le host. `src/lib/salad/container/README.md` décrit le package, les rôles de variables et les preuves requises; exemple désactivé réellement accepté par le parseur. Aucun GPU/image réel qualifié dans cette session.

## Interfaces à intégrer par T01

- Import dynamique canonique `src/lib/salad-persistence.ts` : `createSaladPersistence(database)` → `{ journal, artifacts }`. Absent : erreur fermée, aucun journal mémoire de production. T01 fournit seul ce fichier, SQL et recette PostgreSQL ; T04 ne les copie pas.
- `DurableJournal.readActive?(): Promise<Job | null>` : facultative pour l’intention app, requise à l’exécution worker exclusive. T01 : `load_job(NULL)` dans les cinq fonctions existantes. Une lecture absente/en erreur/invalide ou un slot unknown/expiré donne `interrupted`; running frais donne `busy`. Aucune libération après redémarrage. Les doubles T02/T03 doivent lire explicitement le slot pour devenir ready.
- DTO public `GET /api/video/capabilities` version 1, session serveur authentifiée et propriétaire contrôlé, pas de manifeste/URL/secret dans la réponse. Contrat remis T07/T08. Le contrat privé nécessite `generationTimeoutMs` ; T01 adapte les fixtures livrées T02/T03.
- Codes d’erreur réellement `SALAD_*`, pas `SUTRA_SALAD_*`. T01 seul conserve la whitelist et le preflight de `src/app/api/create/route.ts` avant toute étape API payante. T04 ne touche ni pipeline ni cette route.
- Le GPU ne doit exécuter qu’un moteur, toutes les répliques utilisant la même persistance. Le slot ne protège pas des processus GPU étrangers hors contrat.

## Vérification

42 contrats PASS après dernier delta ; 3 tests legacy CPU et 9 régressions API ciblées PASS réutilisés lorsqu’inchangés. TypeScript et lint ciblés PASS, diff check PASS. Gitleaks expurgé et GitNexus detect-changes sont enregistrés dans `qa/t04-salad-20261014/`. Commandes/empreintes/résultats : README et `verification.json`. Aucun build ni gate globale rejoué, aucune duplication des tests PostgreSQL/integration des autres propriétaires.

Impacts GitNexus avant édition et avertissements HIGH/CRITICAL effectués. Index final local tronqué (1027 entry points / 545 callees / 3 walks omis) : périmètre Git et contrats contrôlés, graphe exhaustif UNKNOWN. La preuve locale ne vaut ni preuve GPU, ni image qualifiée, ni activation, ni coût réel, ni production.

## Ownership et activation restante

ACK T01 dans son bulletin commun pour local-engine/ltx/types/workflow/capabilities, puis ltx-utils/fallbacks, puis adaptation du test legacy. Seuls ces sept fichiers existants ont été modifiés. Nouveaux fichiers T04 dédiés ci-dessous ; aucune modification UI/OAuth/Shotstack/config/OVH/pipeline. Réservation T04 conservée jusqu’au handoff, aucun terminal interrompu et aucun travail étranger écrasé. BATON/task_plan communs laissés au coordinateur pour éviter une collision ; ce handoff dédié est l’état de reprise T04.

T01 doit intégrer les ports et le preflight, retester son candidat, puis conserver Salad désactivé. Avant toute activation ultérieure : image et modèles officiels par empreintes, profils et VRAM/CUDA mesurés sur le GPU réel, endpoint protégé, credentials séparés, login PG restreint, devis courant, budget et autorisation explicite de dépense. La qualification ne peut être certifiée sans exécution GPU, interdite ici. Aucun achat/provisioning/SQL distant/activation dans ce lot. Prix historique RTX3090 24Go 0,09 USD/h non garanti ; timeout ≠ arrêt GPU ni plafond de facture. Vidéo seule open source ; script/voix/musique/composition potentiellement payants.

Liens directs pour les décisions futures : [Salad développeurs](https://salad.com/developers/), [documentation](https://docs.salad.com/), [prix actuels](https://salad.com/pricing/), [LTX-Video officiel](https://github.com/Lightricks/LTX-Video). Aucun consentement utilisateur requis pour conserver cette préparation désactivée.

## Fichiers exacts

- `scripts/test-local-engine-e2e.mts`
- `src/lib/fallbacks.ts`
- `src/lib/local-engine.ts`
- `src/lib/ltx-types.ts`
- `src/lib/ltx-utils.ts`
- `src/lib/ltx-workflow.ts`
- `src/lib/ltx.ts`
- `scripts/test-salad-worker.mts`
- `scripts/test-salad-host.mts`
- `src/app/api/video/capabilities/route.ts`
- `src/lib/salad/application.ts`
- `src/lib/salad/checkpoint.ts`
- `src/lib/salad/client.ts`
- `src/lib/salad/config.ts`
- `src/lib/salad/container/README.md`
- `src/lib/salad/container/disabled.example.json`
- `src/lib/salad/contracts.ts`
- `src/lib/salad/engine.ts`
- `src/lib/salad/host.ts`
- `src/lib/salad/http.ts`
- `src/lib/salad/inspection.ts`
- `src/lib/salad/serve.mts`
- `src/lib/salad/worker.ts`
- `qa/t04-salad-20261014/README.md`
- `qa/t04-salad-20261014/contracts.log`
- `qa/t04-salad-20261014/contracts.tap`
- `qa/t04-salad-20261014/gitnexus-detect-changes.log`
- `qa/t04-salad-20261014/gitnexus-final-index.log`
- `qa/t04-salad-20261014/gitnexus-index.log`
- `qa/t04-salad-20261014/legacy-e2e.log`
- `qa/t04-salad-20261014/lint.log`
- `qa/t04-salad-20261014/lint.txt`
- `qa/t04-salad-20261014/routing-regression.log`
- `qa/t04-salad-20261014/run.py`
- `qa/t04-salad-20261014/security-scan.log`
- `qa/t04-salad-20261014/tsconfig.json`
- `qa/t04-salad-20261014/typecheck.log`
- `qa/t04-salad-20261014/typecheck.txt`
- `qa/t04-salad-20261014/verification.json`
- `HANDOFF-SUTRA-T04-SALAD-20261014.md`
