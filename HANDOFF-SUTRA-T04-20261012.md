# SUTRA T04 — fournisseurs IA, 12 octobre 2026

**DELTA_LOCAL_VERIFIE sur S5 ; INTEGRATION_PR3_NON_TESTEE ; aucune certification release.**

- Code : `e60d2f5ee305bbe2b342177f98a74b8c585c09da`.
- Base : `6a64fba103a084c71ecbfd1a07af53076af097c6`, intégration S5 propre au démarrage.
- Branche : `codex/sutra-t04-ai-providers-20261012`.
- Worktree : `/Users/matissdornier/purama-worktrees/sutra-t04-ai-providers-20261012`.
- Cible T01 connue : PR3 `7088a0a3e733de8d2e85f3576bd86627127da369`, puis code T01 `19ea35fbbfe99a978f119f3939ff9935362191dc`.
- [Manifest des 19 chemins et SHA-256 du contenu committé](qa/t04/manifest.json). Contenu vérifié par `git show <codeCommit>:<path>`, pas lié à du WIP.

## Coordination et limites de propriété

AGENTS, POLITIQUE-GLOBALE, instructions SUTRA, brief, task_plan, ERRORS et réservations lus ; contrôle initial `POLICY_OK`. Réservation `SUTRA-T04-20261012:ai-providers` dans LOCKS racine. Principal SUTRA étranger sale `8ff4fd2` conservé ; aucun reset/stash/clean ni modification des autres worktrees. Dépendances existantes utilisées en lecture seule, aucune installation. Dernier contrôle disque avant finalisation : 48 GiB libres, aucun nettoyage.

Coordination T01 relue pendant la clôture, notamment `T01-COORDINATION.md` et `T01-TO-T04-T05-T08.md`. Elle confirme la divergence S5/PR3 et l'existence préalable de LTX V2 sur PR3. **Ne pas remplacer les fichiers PR3 par leur version S5, ni cherry-pick ce commit aveuglément.** Aucun changement livré à package.json/lockfile, CI, ESLint, orchestration T03, sécurité T02, médias T05, social T06 ou UI T07.

Le blocage externe pour l'intégration est la **réconciliation du delta par T01 avec raccord des contrats T03/T02/T05**, puis gate PR3. Les exigences détaillées ci-dessous sont les composantes de ce même raccord ; aucune autorisation de génération réelle n'est inférée.

## Comportement livré et sources officielles

API V2 = version du protocole, pas nom de modèle. Le routage conserve `ltx-2-3-fast/pro` ; aucun basculement implicite vers 2.5. Sources consultées le 2026-10-12 : [migration V1→V2](https://docs.ltx.io/migrate-v1-to-v2), [jobs asynchrones](https://docs.ltx.io/async-jobs), [modèle 2.3](https://docs.ltx.io/models/ltx-2-3), [modèle 2.5](https://docs.ltx.io/models/ltx-2-5), [tarifs](https://docs.ltx.io/pricing), [limites](https://docs.ltx.io/rate-limits).

| Capacité | Contrat livré | Qualification |
| --- | --- | --- |
| Soumission | `POST https://api.ltx.io/v2/{endpoint}`, 202, `id` et `created_at` validés | Contrat officiel ; HTTP simulé |
| Suivi/reprise | GET du même endpoint/ID ; pending/processing/completed/failed ; intervalle ≥5 s avec jitter | Aucun POST pendant la reprise |
| Texte→vidéo | `text-to-video`, champs stricts, grille modèle/durée/résolution/fps | [Référence](https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-text-to-video) |
| Image→vidéo/références | `image-to-video`, `image_uri` et éventuellement `last_frame_uri` | [Référence](https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-image-to-video) ; pas de multi-références arbitraires |
| Retake | Vrai `retake` sur `video_uri`, fenêtre et mode audio/vidéo ; plus de nouvelle seed T2V | [Référence](https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-retake) |
| Extension | Vrai `extend` sur `video_uri`, début/fin, durée/contexte | [Référence](https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-extend) ; 1080p seulement car prix 4K non établi |
| Vidéo→vidéo | `video-to-video-reframe` et `video-to-video-hdr` | [Reframe](https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-video-to-video-reframe), [HDR](https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-video-to-video-hdr) ; HDR produit un ZIP EXR, jamais présenté comme MP4 |
| Webhook | `handleLtxWebhook()` refuse explicitement | Aucun contrat officiel de webhook/signature trouvé ; polling obligatoire |
| Annulation | `cancelLtxJob()` renvoie unsupported et `mayStillBeBilled: true` | AbortSignal arrête uniquement l'attente locale ; aucune fausse annulation distante |
| V2V générique/seed/références multiples | Refus avant soumission | Capacités non prouvées, aucun champ inventé |

Schémas stricts : prompt ≤5000 caractères, HTTPS pour médias, champs inconnus refusés. Métadonnées source requises pour l'édition : durée, fps, largeur, hauteur, à mesurer côté serveur par le propriétaire média. Les règles de frames, contexte, placement et dimensions sont validées avant dépense. Les durées trop longues à découper ne sont plus tronquées silencieusement.

## Sécurité des dépenses et reprise

`src/lib/ltx-v2.ts` expose `submit`, `poll`, `wait`, `resume`, `download` via `ltxV2` et un client injectable pour tests. Le journal doit implémenter `load` et **compareAndSet atomique durable**. Un Map n'est utilisé que dans les tests.

1. Réserver l'intention avant le premier POST. Concurrence testée : 16 appels identiques → une seule soumission.
2. Persister l'ID avant polling/download. Clé stable d'opération distincte du fingerprint de la requête : une URL signée renouvelée ou un prompt changé ne crée pas de nouveau droit à dépenser.
3. Intention sans ID confirmé, timeout, réponse illisible/ambiguë ou panne de checkpoint : réconciliation obligatoire. Aucun effacement par âge, bail expiré ou compteur de retry.
4. ID connu : reprendre uniquement les GET et le téléchargement. Échec d'upload après succès : ID/statut conservés dans l'erreur ; WAN classé non rejouable par la file existante.
5. Échec distant, 404 de rétention, quota/crédits : conserver la preuve ; aucun fallback vers une nouvelle génération payante. Les champs `retrySubmission=false`, `fallbackAllowed=false` sont explicites.

`createLtxExecution({userId, videoId, jobId?, operationKey})` utilise la colonne existante `video_jobs.provider_job_ids`, slot distinct `ltx_v2:<hash>`. Les IDs utilisateur/vidéo doivent venir d'un workflow autorisé côté serveur. Recherche ambiguë refusée ; première réservation seulement si le job est `processing`. CAS compare le JSONB complet et conserve les autres slots. Le merge `checkpoint_video_job` existant est préservé. Une réponse distante tardive peut enregistrer l'ID même après annulation locale.

**Aucune DB réelle testée.** La sérialisation PostgREST/Supabase, les conflits CAS, la concurrence d'un slot étranger, l'isolation des filtres et l'annulation tardive sont testés avec transport simulé. Le propriétaire doit qualifier le CAS contre sa DB/migration courante et sa stratégie de leases. Ce module ne remplace pas les contrôles d'autorisation/quotas T03.

LTX conserve endpoint/modèle/ID/état local/statut distant/coût/quotas/timeout/dernier statut HTTP. Prompt, URL d'entrée et clé API ne sont pas journalisés. L'URL de sortie signée reste dans le journal serveur et est retirée du résultat public `provenance` ; T02 doit maintenir ce journal inaccessible aux clients. Rétention distante limitée et URL expirante : ne pas assimiler 404 à une absence de facturation. `poll(job, execution)` permet de rafraîchir un résultat connu ; jamais resoumettre automatiquement après expiration.

## Coûts, qualité et autres fournisseurs

| Sujet | Résultat |
| --- | --- |
| LTX génération | Estimation USD selon résolution/durée/modèle, prix officiel daté ; fast 0,03/0,06/0,12/0,24 USD/s et pro 0,04/0,08/0,16/0,32 |
| Retake | Estimation sur durée complète de la source à 0,10 USD/s, pas seulement fenêtre retouchée |
| Extension 1080p | 0,10 USD/s extension + contexte ; contexte automatique estimé par borne supérieure admissible |
| HDR/reframe | Estimation sur source selon palier officiel ; contraintes frames/placement contrôlées |
| Coût réellement facturé | `actual: null`, `actualStatus: not_reported` lorsque non fourni ; jamais remplacé par l'estimation |
| Quotas | Solde restant inconnu = null, 402 crédits/429 file distingués ; Retry-After conservé, pas de POST automatique |
| Timeouts LTX | Soumission 30 s, GET ≤15 s, attente 300 s par défaut/configurable, download 60 s ; timeout ≠ annulation distante |
| Sélection qualité/coût | Exclut moteurs non configurés, durées invalides ou sous-livrées ; respecte les plafonds du plan sans dégrader silencieusement une qualité demandée |
| WAN/RunPod | Un POST, ID conservé sur polling/échec/download/upload, FAILED/CANCELLED/TIMED_OUT terminaux, erreurs inconnues non rejouables ; [contrat RunPod](https://docs.runpod.io/serverless/endpoints/send-requests) |
| Prix WAN | Profil GPU/worker non fourni : estimation et coût réel inconnus dans la provenance. Les anciens coefficients de classement de S5 restent des heuristiques, pas un devis certifié |
| Stock | Sélection possible seulement avant dépense, fournisseur sélectionné non configuré et strictAI désactivé ; engine/source `pexels-stock`, raison explicite |
| Musique | API historique URL = Suno uniquement ; API `generateMusicWithProvenance` sélectionne explicitement Suno/Riffusion/Stable Audio, jamais une cascade après résultat incertain ni succès vide |
| Voix | Une tentative ElevenLabs, résultat structuré disponible via `generateVoiceWithProvenance` ; aucune seconde génération automatique |

Musique/voix exposent fournisseur, état distant, timeout et valeurs inconnues de coût/quota. Les gateways musicales préexistantes restent `legacy_not_live_verified` ; aucun prix ou contrat officiel Suno/Riffusion n'a été inventé. Leurs checkpoints crash-safe, le remboursement et la réconciliation comptable complète ne sont pas prouvés. WAN conserve ses dimensions natives déclarées, et ne revendique pas de génération 4K native pour un rendu 1280×720. Le contrat worker WAN lui-même n'est pas certifié par la documentation générique RunPod.

Les wrappers de compatibilité retournant seulement URL/ArrayBuffer ne transportent pas toute la provenance ; leurs consommateurs doivent adopter les résultats structurés. Une erreur payante incertaine WAN/voix/musique est testée comme `permanent` pour empêcher le retry actuel de la file ; **cela ne signifie ni échec distant certain ni coût nul**. Une file dotée d'un état `reconciliation_required` doit préférer cet état.

## Raccords T03/T05 et réconciliation exacte PR3

### T03 — contexte durable avant appel

Sur S5, appels à raccorder : `video-pipeline.ts` (trois appels visuels), `video-hybrid-branch.ts`, `production-pipeline.ts`, `sutra-auto.ts`. Ils n'apportent pas tous une clé d'opération stable ; **LTX refuse désormais ces appels avant dépense** tant que le raccord n'est pas fait. WAN ne bénéficie pas encore d'un journal complet entre crash et reprise de tout le pipeline.

Passer `execution` ou `{userId, videoId, jobId, operationKey}` dans le `track` du visuel. `operationKey` doit identifier durablement scène/opération/révision explicitement approuvée, rester identique après restart, et ne pas dépendre d'une URL signée. Pour une nouvelle génération après issue inconnue, réconcilier le job précédent avant d'allouer une nouvelle révision. Préserver les IDs des opérations réussies même si une opération parallèle échoue.

PR3 possède déjà `LtxJobState`, `LtxJobPersistence`, `durableLtxJob(steps,key,checkpoint)` et `options.job`. **Ces signatures ne sont pas remplacées automatiquement par T04.** T03 doit raccorder leur journal existant à `LtxExecution.store` avec véritable CAS, ou adopter le store proposé après validation DB. Ne pas convertir un simple callback `save` facultatif en prétendu CAS atomique. Les checkpoints historiques `started: true` sans ID doivent rester bloqués ; ceux avec ID doivent continuer par GET. Leur fingerprint/format diffère : ne pas les effacer ou recalculer pour obtenir une nouvelle soumission.

### T05 — provenance média

T05 demande `nativeUrl`, `enhancedUrl`, `generation.kind/evidence`. Le journal T04 connaît la sortie fournisseur et le modèle ; il ne réalise pas de mesure ffprobe ni d'amélioration. Mapper la sortie connue vers l'actif natif serveur, mesurer la résolution réelle avant attestation, laisser enhancedUrl absent sans traitement prouvé. Ne pas transformer `resolution` demandée en preuve de pixels natifs. Pour retake/extend/HDR/reframe, fournir les métadonnées source mesurées dans `execution.inputMedia`. Conserver les exigences required/optional du brief voix/musique côté orchestration : aucun succès silencieux inventé par T04.

### T01/T02 — delta à porter, protections à conserver

Comparaison effectuée par `git show`/`git diff` entre la base S5 et PR3 ; l'ancien protocole V2 de PR3 est reconnu comme existant, pas présenté comme travail restant à refaire.

| Chemins/symboles | Décision d'intégration |
| --- | --- |
| `ltx-v2-contract.ts`, `ltx-v2.ts`, `ltx-job-store.ts` | Nouveaux modules T04 : contrats/capacités, moteur d'état/coûts, store atomique. Relier au journal canonique, pas créer une deuxième autorité de reprise |
| `ltx.ts` | Porter véritables retake/extend/reframe/HDR et validation/provenance ; conserver le contrat `durableLtxJob/options.job` jusqu'au raccord T03. Ne pas écraser le fichier PR3 par celui-ci |
| `ltxJson`, `downloadVideoBytes` PR3 | **Conserver** lecture JSON bornée à 64 KiB, downloader canonique T02 (DNS/SSRF/taille/mime/redirections). Le client S5 T04 emploie des fetch directs : ils ne remplacent pas ces garanties PR3 |
| `ltx-types.ts` | Retirer seed non documentée, ajouter provenance ; préserver les types encore nécessaires à PR3 |
| `ltx-helpers.ts`, `wan.ts`, `runpod.ts` | Porter ID/statuts/coûts inconnus et erreurs non rejouables ; conserver le downloader canonique et son contrat PR3/T02 |
| `fallbacks.ts` | Porter sélection explicite, suppression cascades payantes/vides et provenance ; conserver le paramètre de journal PR3 jusqu'à migration T03 |
| `provider-pricing.ts` et cinq fixtures `test-hybrid-*` modifiées | **Absents de PR3** : delta S5 uniquement. Ne pas ressusciter le sous-système hybride supprimé ; porter la règle de sélection vers l'autorité retenue par T01/T03 |
| `test-api-contracts.mts`, `test-video-contracts.mjs` | Fusionner assertions avec les fixtures PR3, ne pas remplacer leurs contrôles de download/reprise |
| Deux nouvelles suites T04 | Porter les assertions utiles ; la suite provider-safety dépend de pricing S5 et doit être adaptée avant gate PR3 |
| Package/CI/lint | Aucun changement. Proposition T01 : script `test:providers` exécutant les deux nouvelles suites, après adaptation PR3 |

`ltx.ts` T04 fait 175 lignes : extraction effectuée sans désactiver max-lines. Aucune preuve lint PR3 n'est revendiquée.

## Preuves locales, commandes et limites

Environnement S5 : Node 26.0.0, TypeScript 5.9.3, Next 16.3.5, lockfile inchangé. Ce n'est pas la gate T01 Node24/Next16.3.8.

| Commande | Résultat au payload code | Preuve |
| --- | --- | --- |
| `node --import tsx --test scripts/test-ltx-v2-contracts.mts scripts/test-provider-safety.mts` | 62 PASS, 0 FAIL/SKIP | [log](qa/t04/providers.log) |
| `npm run test:api-contracts` | 55 PASS, 0 FAIL/SKIP | [log](qa/t04/api-contracts.log) |
| `npm run test:hybrid` | 83 PASS, 0 FAIL/SKIP ; pas rejoué après changements sans impact hybride | [log](qa/t04/hybrid.log) |
| `npm run test:video-contracts` | 6 PASS, 0 FAIL/SKIP | [log](qa/t04/video-contracts.log) |
| `npm run lint -- --ignore-pattern '.gitnexus/**'` | 0 erreur, 144 avertissements existants | [log](qa/t04/lint.log) |
| `npm run build` avec variables factices du manifest | compilation, TypeScript et 210 pages statiques PASS | [log](qa/t04/build.log) |

Total : **206 tests**, transport fournisseur simulé et 0 génération payante. Le build initial a exigé Stripe puis Resend au chargement : résolution par valeurs factices dans la commande, jamais lecture d'un fichier secret. `npm run lint` sans exclusion échoue sur trois require du runner `.gitnexus/run.cjs` généré/ignoré ; exclusion de cet artefact explicitée, aucune désactivation de règle produit. Le build conserve l'avertissement de tracing ffmpeg-io et les dépréciations middleware/Edge préexistants.

Tests de défauts : conflit de fingerprint, concurrence 16 soumissions, panne journal avant POST, checkpoint ID refusé après acceptation, résultat payant perdu, quota/credits, réponse/ID/statut/timestamps invalides, timeout/reprise, annulation locale, job distant disparu, download expiré, sortie HDR, schémas de six opérations, filtrage qualité, absence de cascade musique/visuel, upload raté après dépense.

**GitNexus** : impacts avant édition HIGH/CRITICAL annoncés. Exemples : callLtxApi 2 appelants directs/8 impacts ; generateVideoSmart 3/9 ; visuel 3/6 ; WAN 1/5. [Impacts](qa/t04/gitnexus-impact.json). Index final : 14 008 nœuds, 30 354 relations, 517 flux. Tronqué : 990 candidats d'entrée et 3091 callees omis, 8 parcours coupés. `detect-changes --scope staged --repo sutra-t04-20261012 --limit 300` avant commit : 19 fichiers, 191 symboles, 517 processus annoncés, CRITICAL. Le résultat associe même des fixtures à des flux UI sans lien démontré ; sa précision/exhaustivité ne certifie pas le périmètre. [Index](qa/t04/gitnexus-index.log), [détection](qa/t04/gitnexus-detect-staged.txt). Contrôle direct des 19 chemins et des consommateurs effectué en complément.

| Niveau | Statut |
| --- | --- |
| Implémentation / commandes locales sur S5 | PROUVÉ par commit, hashes et logs |
| HTTP fournisseur, transport CAS Supabase | SIMULÉ ; pas de preuve provider ou PostgreSQL réel |
| Compte LTX, coût facturé, quotas réels, WAN GPU, voix/musique live | NON TESTÉ |
| Intégration PR3, migrations déployées, webhooks/cancel distants LTX | NON TESTÉ ou capacité non documentée explicitement refusée |
| Release / production | BLOQUÉ par intégration et qualification propriétaires ; aucun push/deploy |

Prochaine action : T01 revoit le delta committé, T03/T02/T05 raccordent leurs contrats canoniques, puis exécution de la gate PR3 sans génération payante. Aucun PASS historique n'est promu en preuve intégrée.
