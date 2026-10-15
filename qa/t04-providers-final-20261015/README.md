# T04 — validation finale fournisseurs, 2026-10-15

Base T01 confirmée : `cb3f893c35599a6c9c50a4d23c82013c10c5f3ae`. Branche `codex/sutra-t04-providers-final-20261015`, worktree isolé du même nom. Cette preuve porte sur le delta local, pas sur un déploiement. Réservations `PROVIDERS-FINAL`, `DELTA`, `LTX-BODY` dans les deux LOCKS canoniques. T01 conserve intégration/config/SQL/OVH, T05 les médias, T03 le pipeline. Aucun adaptateur dupliqué.

## Verdict transmis à T01 et T08

| Fournisseur | Contrats locaux | Lecture authentifiée gratuite | Limites et verdict externe |
| --- | --- | --- | --- |
| LTX V2 | PASS : jobs, reprise, idempotence, médias, erreurs, coûts estimés ; lecture du corps annulable corrigée | NON TESTÉ dans ce lot ; présence de clé ne vaut pas authentification | Génération/facturation NON TESTÉES. Webhook et annulation distante sans contrat officiel utilisable : indisponibles, jamais simulés comme réussis |
| RunPod | PASS réutilisé sur fichiers inchangés, régressions sécurité PASS | PASS HTTP 200 sur health de l'endpoint configuré, sans API d'administration | 0 worker prêt observé ; crédits et exécution GPU NON TESTÉS. Annulation distante documentée mais non exposée par cet adaptateur |
| Shotstack stage + production | PASS historique borné ; **FAIL nouveau : annulation pendant lecture du corps en reprise** | PASS HTTP 200 sur les deux endpoints templates | Reproducteur remis à T01/T05/T08. T01 a repris le correctif à 20:39 UTC ; WIP non certifié par T04. Aucun rendu ni coût réel testé |
| SunoAPI | PASS réutilisé sur fichiers inchangés, sécurité/reprise PASS | PASS HTTP 200 sur crédit, disponibilité de crédit confirmée sans montant publié | API tierce SunoAPI, pas une API officielle Suno. Création/musique/facturation NON TESTÉES |
| ElevenLabs | PASS : identités, schémas, corps bornés, audio et absence de retry POST | **BLOQUÉ HTTP 401** sur GET voices | Authentification ou droit refusé ; cause exacte clé/droit non déterminée par ce reçu expurgé. Aucun clonage/TTS réel |
| Pexels | PASS : erreur explicite, schémas, provenance, variantes vidéo, corps bornés | **BLOQUÉ avant HTTP**, champ présent mais format non admissible localement | Aucun refus distant inventé. Recherche réelle NON TESTÉE |
| Salad | PASS : worker/bridge existants, scope canonique `_NAME`, conflits d'alias refusés | **BLOQUÉ avant HTTP**, reçu exact ci-dessous | Image non construite et GPU/modèles non qualifiés. Aucun provisioning, réplication, interruption ou redémarrage réel |

`free-reads.json` : 5 GET, 0 mutation, 0 retry, 0 génération. `salad-read.json` : 0 requête. Contrats simulés, authentification, crédits et génération sont quatre preuves différentes. Un PASS de lecture n'autorise aucun appel payant.

## Défauts reproduits puis corrigés

1. **PEXELS-ERROR-AS-EMPTY** : les HTTP 401/403/404/429/500 et listes absentes devenaient `[]`. Le consommateur stock peut décider un fallback IA sur ce vide. Correction de l'adaptateur : absence de clé et erreur fournisseur explicites, aucune tentative supplémentaire, schéma/provenance/HTTPS vérifiés, corps limité à 2 MiB et 15 s. Une vraie liste vide reste vide ; son traitement produit appartient à T01/T03 (T01 a repris R86), aucune garantie globale de fallback n'est déduite de ce correctif seul.
2. **VOICE-SCHEMA/BODY** : clone acceptait un identifiant non textuel et list acceptait des entrées malformées ; lecture JSON non bornée. Réutilisation de `providerRecord`, schéma strict des identités, redirections refusées et deadline couvrant le corps. Audio existant conservé.
3. **SALAD-NAME-SCOPE** : les sondes ne reconnaissaient pas les noms canoniques demandés. `_NAME` accepté avec anciens alias compatibles ; contradiction entre alias refusée avant requête. Le worker opérationnel n'a pas été recréé.
4. **LTX-ABORT-BODY** : trois contre-tests prouvaient qu'une réponse livrée après l'annulation/deadline était encore acceptée. Même signal sur fetch et `providerRecord` borné à 64 KiB. Soumission incertaine persistée `submission_unknown`, jamais resoumise ; polling conserve le même job et autorise seulement la réconciliation GET. Interfaces/journal/CAS inchangés.

`red.txt` conserve 23 FAIL/2 PASS initiaux ; `ltx-body-red.txt` conserve 3 FAIL. `green-initial.txt` est un premier échec de harnais par clés synthétiques manquantes, pas une preuve finale produit. Les reçus verts le remplacent explicitement, sans effacer l'historique.

## Contrats officiels et comportement réellement livré

### LTX

L'API asynchrone accepte une soumission et retourne HTTP 202 avec un job ; lecture GET jusqu'à état terminal. Le client persiste intention/CAS/empreinte avant POST, ID avant polling, refuse les identités incohérentes et conserve les résultats inconnus. GET avec jitter/backoff/Retry-After ; attente bornée à 300 s. Le fournisseur recommande un intervalle de 5 s et annonce une conservation des jobs jusqu'à 24 h, susceptible d'expirer plus tôt : la reprise ne promet pas une conservation illimitée. [Jobs officiels](https://docs.ltx.io/async-jobs).

Les modèles approuvés restent LTX 2.3 : T2V/I2V première et dernière image, V2V HDR/reframe, retake et extend selon matrices existantes. Références multiples et transformation vidéo générique non documentées dans ce contrat restent refusées. Annuler l'attente locale n'annule ni ne rembourse le calcul distant. Aucun webhook/cancel distant inventé. [Modèles](https://docs.ltx.io/models/ltx-2-3), [I2V](https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-image-to-video), [retake](https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-retake), [extend](https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-extend).

Validation locale des combinaisons durée/résolution/FPS : 6/8/10 s, jusqu'à 20 s seulement pour combinaisons fast admissibles ; retake et contexte/extension bornés séparément. Images PNG/JPEG/WebP ; vidéos MP4/MOV/MKV H.264/H.265, limites distinctes par opération. L'adaptateur utilise des URL HTTPS, pas les data URI. Les fixtures couvrent les refus avant POST ; aucune taille réelle de fichier distant n'a été téléchargée ici. [Formats](https://docs.ltx.io/input-formats).

Quotas/concurrence et HTTP 429 restent explicites ; pas de retry aveugle POST après résultat incertain. Estimation USD issue de la grille par seconde/modèle/résolution, provenance conservée ; coût réel `null/not_reported` tant qu'aucun reçu fournisseur n'est disponible. Les erreurs ne prouvent pas l'absence de facturation. [Rate limits](https://docs.ltx.io/rate-limits), [erreurs](https://docs.ltx.io/errors), [prix](https://docs.ltx.io/pricing).

### RunPod / Shotstack / SunoAPI / voix / catalogue

- RunPod : `POST /v2/{endpoint}/run`, ID strict, `GET /status/{id}`, health limité à l'endpoint. Soumission 30 s, polling 15 s par requête/budget 300 s ; reprise connue en GET, résultat incertain bloque le retry. `/cancel/{id}` existe chez le fournisseur mais n'est pas une capacité exposée de l'adaptateur WAN actuel. Pas de faux statut annulé distant. [Contrat officiel](https://docs.runpod.io/serverless/endpoints/send-requests).
- Shotstack : clés stage et production séparées, `/edit/stage` et `/edit/v1`, GET templates gratuit ; environnement absent dans le master lu donc défaut stage du code. ID checkpointé, reprise GET, résultat rendu `outputVerified:false` avant mesure/hash par le pipeline média. Le FAIL ci-dessous empêche de déclarer l'annulation entièrement validée. [API](https://shotstack.io/docs/api/).
- Suno : endpoint configuré compatible `api.sunoapi.org/api/v1`, modèle V6 pris en charge ; POST generate 30 s sans retry, `taskId` durable avant GET record-info, budget 120 s/intervalle 3 s, erreurs transitoires GET bornées. `FIRST_SUCCESS` ne vaut pas résultat final ; seul SUCCESS avec média valide. Callback non fiable seul, réconciliation requise ; annulation locale uniquement. [Documentation du fournisseur tiers](https://docs.sunoapi.org/suno-api/generate-music).
- ElevenLabs : `GET /v1/voices` encore présent au SDK officiel ; limite de cette route pour espaces de plus de 500 voix, v2 disponible séparément. Clone sans retry POST ; sortie TTS vérifiée en octets audio, sans prétendre prouver la facturation. [SDK officiel](https://github.com/elevenlabs/elevenlabs-python/blob/main/src/elevenlabs/voices/client.py), [recherche v2](https://elevenlabs.io/docs/api-reference/voices/search).
- Pexels : recherche vidéo `/v1/videos/search` et photo `/v1/search`, taille de page plafonnée, source/photographe conservés. Variantes HLS sans dimensions ignorées ; erreurs jamais converties en vide. Aucun média ou droit d'utilisation réel validé par ces fixtures. [API officielle](https://www.pexels.com/api/documentation/).

### Salad : ce qui existe et ce qui manque

La documentation publique consultée ne fournit pas une énumération générale organisations/projets : les noms sont à relever dans le portail. Avec les trois champs valides, les sondes existantes font seulement GET quotas puis container groups. Un 404 ne prouve pas un compte invalide ; 401/403 arrêtent le contrôle. Les classes GPU ne prouvent pas la VRAM d'une exécution. [Préflight officiel](https://docs.salad.com/agents/container-engine/discover-scope-and-preflight), [portail](https://portal.salad.com/), [développeurs](https://salad.com/developers/).

La recette conteneur existe déjà (Node/Python par digest, instantané Debian, ComfyUI par commit, dépendances Python hashées/Torch CUDA). Non-root, modèles en lecture seule/offline ; une seule chaîne worker 7862 → bridge 7861 → ComfyUI 7860. Gateway Salad et Bearer worker distincts, clé de compte jamais embarquée. `SALAD_ENABLED=false` reste intact. Aucun build/pull/download IA dans ce lot.

Profil déclaré actuel : `ltxv-13b-0.9.8-distilled-fp8`, T2V sans audio, pas de 4K native ; ce n'est pas le modèle API LTX 2. Aucun GPU/VRAM/cold-start n'est qualifié par les fixtures. Le verrou durable PostgreSQL partagé évite un second moteur ; interruption inconnue conserve la réservation jusqu'à réconciliation, pas de libération par TTL ni resoumission automatique. Le profil réel doit comporter image digest, CUDA/GPU/VRAM, empreintes poids et mesures, avec artefact SHA avant état final vérifié.

## Provenance et actions utilisateur minimales

Source unique : `~/.env.purama.master`, lecture privée avec permissions/owner/type de fichier contrôlés, sélection de noms seulement, aucun source shell/env/copie `.env.local`/écriture master. Valeurs transmises uniquement par stdin privé ; réponses conservées sous forme de métadonnées, sans corps fournisseur ni URL de compte.

`salad-read.json`, 2026-10-15T20:36:58Z : `SALAD_API_KEY` présente mais non conforme au filtre local de transport littéral (ce filtre n'est pas présenté comme une spécification officielle exhaustive de clé). `SALAD_ORGANIZATION_NAME` et `SALAD_PROJECT_NAME` absentes. **Aucun HTTP Salad, aucune authentification acquise ou refus distant déduit.**

Actions utilisateur, noms uniquement :

1. `SALAD_API_KEY`, `SALAD_ORGANIZATION_NAME`, `SALAD_PROJECT_NAME` — renseigner/corriger via le [portail Salad](https://portal.salad.com/), dans le master privé par saisie sécurisée. Ne rien transmettre dans un message ou un rapport.
2. `PEXELS_API_KEY` — vérifier la saisie depuis [la page officielle de clé](https://www.pexels.com/api/key/).
3. `ELEVENLABS_API_KEY` — vérifier validité et permission lecture des voix dans [la gestion officielle des clés](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys). Le reçu HTTP 401 seul ne distingue pas ces causes.

Les autres noms/provenances figurent dans `free-reads.json`. `SHOTSTACK_ENV` absent est un choix par défaut du code, pas une clé manquante à inventer. Aucun crédit RunPod/Shotstack/LTX/ElevenLabs confirmé ; crédit SunoAPI disponible sans génération vérifiée.

## Tests, commandes et réutilisation précise

Dans ce worktree, `python3 qa/t04-providers-final-20261015/run.py <check>` : environnement synthétique isolé, réseau bloqué par `qa/t08/offline.cjs`, Node 24, aucun secret.

| Check | Preuve | Résultat |
| --- | --- | --- |
| `contracts` | `contracts.txt` | 55 PASS / 0 FAIL / 0 SKIP |
| `ltx-regressions` | `ltx-regressions.txt` | 127 PASS / 0 FAIL / 0 SKIP |
| `regressions` | `regressions.txt` | 16 PASS / 0 FAIL / 0 SKIP ; recouvre la ligne précédente, ne pas additionner |
| `typecheck` | `typecheck.txt`, `audit-typecheck.txt` | PASS, inclut scripts d'audit et reproducteur propriétaire |
| `lint` | `lint.txt`, `audit-lint.txt` | PASS sans erreur ; un avertissement historique `fetchWithRetry` inutilisé dans test-api-contracts.mts:47 |
| `shotstack-owner-red` | `shotstack-owner-red.txt` | **0 PASS / 1 FAIL**, volontairement distinct, jamais transformé en SKIP |

Lectures gratuites déjà faites : `python3 qa/t04-providers-final-20261015/read-master.py --authorized-free-reads` et `python3 qa/t04-providers-final-20261015/read-salad.py --authorized-free-reads`. **Ne pas rejouer sans delta de configuration ou besoin précis.** Les deux scripts refusent l'exécution sans ce flag avant lecture du master ; AST Python et bornes de sortie contrôlés.

`ci-reuse.json` relie 48 fichiers inchangés byte-for-byte à cb3f893 et au log CI 38797929920, SHA-256 du log vérifié. Contrats globaux base : 1054 PASS/0 FAIL/7 SKIP ; 78 entrées fournisseur extraites, pas une nouvelle campagne du delta. Typecheck/lint/build globaux base restent une preuve T01 ; aucune build globale identique rejouée. Les trois adaptateurs modifiés ont les tests frais ci-dessus ; T01 doit qualifier son nouveau candidat intégré.

## FAIL Shotstack remis au propriétaire

`shotstack-owner-repro.mts` reprend un ID connu, simule un seul GET, annule à 10 ms et livre le corps `done` à 120 ms. Sur cb3f893, assembleFinalVideo résout au lieu de rejeter. `outputVerified` reste false : on ne prétend pas avoir reproduit un faux ready final. Cause : boundedProviderJson non lié au signal dans pollShotstackRender. Remis au miroir commun à 20:37 UTC ; T01 a explicitement repris le correctif à 20:39 UTC et possède désormais son WIP. T04 n'a ni modifié ni certifié ce fichier. Rejouer ce seul reproducteur sur le futur candidat corrigé.

## GitNexus, limites, activation restante

Impacts avant édition enregistrés ; `createLtxClient` MEDIUM, submit/poll imbriqués CRITICAL, annoncé avant correction. Index final : 23025 nœuds/44786 relations/370 flux, tronqué (1308 entrées candidates écartées, 696 callees tronqués, 4 coupes de parcours). UNKNOWN pour exhaustivité ; revue directe du delta et tests complètent sans prétendre certifier tout le graphe. Détection staged et compare-main conservée avant commit ; le compare main inclut l'historique hors delta.

T01 seul poursuit l'activation : après credentials valides, GET scope/quotas/groupes, choix explicite du groupe et de l'image immuable, droits PostgreSQL/TLS et stockage artefacts, secret worker/Gateway, poids autorisés et hashés. Préparer construction reproductible Linux amd64 hors Mac IA. Avant tout GPU : budget explicite incluant démarrage/idle/stockage/réseau, tarif actuel confirmé (RTX3090 0,09$/h est historique, pas un forfait garanti), une seule réplique et une seule tâche minimale admise. Mesurer GPU/VRAM/CUDA/durée/coût et vérifier SHA du résultat ; réconcilier ID/arrêt même en timeout. Les essais interruption/redémarrage/reprise doivent être autorisés séparément et ne doivent jamais resoumettre un résultat payant incertain.

Plus petit essai réel proposé, NON EXÉCUTÉ : après qualification de l'image et budget, une tâche T2V courte du profil explicitement validé, sans audio/upscale/fallback, idempotence unique et journal durable ; contrôle du résultat puis arrêt contrôlé par T01. Pour APIs hébergées, une soumission minimale par fournisseur seulement sur autorisation spécifique, avec ID, polling GET et reçu réel. Aucun remboursement/cap prix strict inféré d'un timeout logiciel.

OVH : aucune connexion ou écriture T04 dans ce lot ; reçu T01 20:03 UTC sur production 86d04c85 healthy/0 restart réutilisé comme historique, pas comme mesure T04 actuelle. Aucune fusion, push, migration, déploiement, GPU ou génération facturable.

Contrôle avant commit : `git diff --check` PASS. Gitleaks sur diff staged complet : **2 détections, toutes deux littéraux synthétiques Salad des tests offline aux lignes72/82**, vérifiés dans la source (empreinte et classification dans `security-findings.json`). Sortie brute expurgée conservée `security.txt`, aucun faux scan « zéro finding », aucune règle ignorée. Aucun secret réel trouvé dans ce delta lors de cette revue. Détection GitNexus staged :49fichiers/93symboles/354flux CRITICAL ; compare-main :4402fichiers/7537symboles/370flux CRITICAL, liste plafonnée et nombreux flux homonymes hors SUTRA. Revue directe limitée aux fichiers réservés, pas une certification transversale.

Les espaces de fin de ligne et lignes finales vides des logs locaux ont été normalisés pour diff-check ; contenu et résultats inchangés, empreintes avant/après dans `log-whitespace-normalization.json`. Le log CI externe n’a pas été modifié.
