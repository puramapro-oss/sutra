# T04 — validation fournisseurs et préparation GPU distant, 14 octobre 2026

## Conclusion bornée

Base intégrée confirmée par T01 : `e09fdaeafbf1ec8554a7b689fe3c44dd696d0140`. Branche locale : `codex/sutra-t04-provider-validation-20261014`. Aucun fichier applicatif modifié, aucun nouvel adaptateur. Les corrections T04 précédentes sont déjà intégrées. Ce lot ajoute un harnais de lecture gratuite, ses tests et les preuves expurgées.

| Fournisseur | Résultat vérifié | Limite restante |
| --- | --- | --- |
| RunPod | **PASS** : GET de santé de l’endpoint configuré, HTTP200, schéma conforme | 0 worker prêt ; droits de génération, crédits, image du worker et génération **NON TESTÉS** |
| Shotstack stage | **PASS** : GET templates, HTTP200, clé stage acceptée | Rendu et crédits **NON TESTÉS** |
| Shotstack v1 | **PASS** : GET templates, HTTP200, clé production acceptée | Rendu et crédits **NON TESTÉS** |
| SunoAPI | **PASS** : GET crédit, HTTP200 et code200, crédits disponibles | Génération **NON TESTÉE** ; service tiers SunoAPI, pas API officielle de Suno |
| LTX V2 | **PASS documentaire/contrats locaux réutilisés** ; clé présente | Authentification/crédits/génération **NON TESTÉS** : aucun endpoint de compte gratuit documenté ni ID de job existant fourni |
| Salad | **PASS local réutilisé** : raccord désactivé, worker/bridge/persistance déjà intégrés | **BLOQUÉ pour activation** : configuration absente, aucune image ni qualification GPU réelle livrée |

Observation directe : `live.json`, **2026-10-14T13:58:12.735Z**, quatre GET, zéro mutation, zéro retry. Un HTTP200 de lecture ne valide pas un droit de soumission, une facture, un rendu ou un modèle. RunPod n’a reçu aucun appel d’administration. Aucun refus ancien d’une API d’administration n’est repris comme preuve de clé invalide.

## Contrats utilisés, comparés aux sources officielles

### LTX V2

`src/lib/ltx-v2.ts` et `ltx-v2-contract.ts` utilisent `https://api.ltx.io/v2/`, Bearer serveur, POST unique puis réponse202 avec `id` et `created_at`. GET du même endpoint et ID : `pending`, `processing`, `completed`, `failed`. Les modèles 2.3 fast/pro du code restent documentés ; l’existence de 2.5 n’impose pas une migration implicite.

Capacités retenues : texte-vers-vidéo, image-vers-vidéo (première/dernière image selon modèle), retake, extension, transformations vidéo HDR/reframe. Aucun V2V arbitraire, référence multiple générique, webhook ou annulation distante inventé. L’annulation locale cesse l’attente ; elle ne prouve pas l’arrêt distant. Le résultat HDR est une archive de frames EXR, distincte d’un MP4.

Intention durable/CAS avant POST ; délai de soumission30s ; un résultat payant incertain conserve sa barrière, reprise par GET seulement. Polling à partir de5s, délais bornés ;404 ne justifie aucune nouvelle soumission. Le statut peut disparaître avant24h après terminaison et l’URL média expire séparément : récupération/stockage durable et SHA restent nécessaires. Coût estimé distinct du réel ; devis 2.3 et coût de contexte retake/extension contrôlés contre la page tarifaire, aucune facture réelle observée.

Sources : [asynchrone](https://docs.ltx.io/async-jobs), [modèles2.3](https://docs.ltx.io/models/ltx-2-3), [tarifs](https://docs.ltx.io/pricing), [authentification](https://docs.ltx.io/authentication). Aucun endpoint de crédit gratuit ou d’annulation trouvé dans l’index officiel consulté ; absence de preuve signalée, pas affirmation d’impossibilité future.

### RunPod

`src/lib/runpod.ts` : `https://api.runpod.ai/v2/{endpoint}`, Bearer ; POST `/run` avec enveloppe `input`, GET `/status/{id}`, GET `/health` pour la présente lecture. L’enveloppe est officielle ; les champs internes prompt/negative_prompt/width/height/num_frames/steps/cfg_scale/seed et les formats de sortie dépendent de l’image du worker. Valeurs courantes du code768×512,81frames,20steps,cfg6 : **pas une qualification du worker distant**.

ID strict et cohérent, statuts terminaux `FAILED`/`CANCELLED`/`TIMED_OUT` conservés, HTTPS/base64 média contrôlés, erreurs expurgées. POST30s unique ; GET15s ; attente locale5min. Ce délai local ne remplace pas `policy.executionTimeout` côté RunPod et ne plafonne pas la facture. Avant essai, vérifier la limite serveur et le schéma de l’image avec T01. La plateforme documente `/cancel/{id}` et `/retry/{id}` ; l’adaptateur actuel n’expose pas d’annulation distante et n’utilise pas retry. Reprise par statut seulement ;404 ou expiration du résultat ne déclenche pas un POST. Les résultats asynchrones terminés ont une rétention limitée. Coût réel/quota restent inconnus sans preuve fournisseur.

Source : [requêtes Serverless officielles](https://docs.runpod.io/serverless/endpoints/send-requests). Lecture `/health` ciblée réussie ; aucune demande de clé administrateur ou de rotation n’est justifiée par ce résultat.

### Shotstack

`src/lib/shotstack.ts` : `https://api.shotstack.io/edit/{stage|v1}`, en-tête `x-api-key`, clé correspondante. POST `/render` une fois ; ID persisté par les ports existants ; GET `/render/{id}`. GET `/templates` seul exécuté ici, avec les deux environnements séparés. Aucune URL configurable étrangère n’a reçu de clé.

Requêtes15s, attente locale300s/intervalle5s ;401/403/404 terminaux, aucun retry de soumission incertaine. Le succès exige URL/durée cohérentes puis acquisition durable. Pas d’annulation distante documentée/exposée retenue. Un403 isolé pourrait signifier clé/environnement/droits/restriction de compte ; il n’en est observé aucun aujourd’hui. Aucun rendu, y compris stage, n’a été lancé. Fichier sous ownership T05/T01 : lecture seule.

Sources : [clés et environnements](https://shotstack.io/docs/guide/getting-started/request-api-keys/), [référence API](https://shotstack.io/docs/api/), [templates](https://shotstack.io/docs/guide/architecting-an-application/templates/), [restrictions staging](https://help.shotstack.io/en/articles/14050795-staging-environments-faqs).

### SunoAPI

`src/lib/suno-config.ts` et `suno.ts` : priorité `SUNO_API_BASE_URL`, puis `SUNO_BASE_URL` ; hôte admis `https://api.sunoapi.org/api/v1`. Le master sélectionne la première variable. POST `/generate` Bearer, paramètres V6/customMode/instrumental/style/lyrics/duration/callBackUrl selon mode, `taskId` persisté avec ACK obligatoire. Reprise GET `/generate/record-info?taskId=...`, ID cohérent, sortie `response.sunoData` et URL audio HTTPS. POST30s, GET15s, attente locale120s, aucun POST automatique après résultat incertain.

Le callback existant n’est pas une preuve de succès : le polling authentifié reste autoritaire. Pas d’annulation distante retenue. GET `/generate/credit` retourne code200 et crédit numérique ; code applicatif429 signifie crédits insuffisants,405/430 limitation, distincts de HTTP429. Cette distinction est testée par le nouveau harnais.

**SunoAPI est un fournisseur tiers**, distinct de la plateforme officielle Suno. La documentation du fournisseur comporte encore un exemple de crédits sur un autre hôte ; aucune clé n’a été envoyée à cet hôte, aucun redirect suivi. L’hôte configuré et autorisé répond effectivement HTTP200/code200. Pas de remplacement architectural exigé par un ancien bilan devenu obsolète.

Sources : [quickstart du fournisseur](https://docs.sunoapi.org/suno-api/quickstart), [génération](https://docs.sunoapi.org/suno-api/generate-music), [statut](https://docs.sunoapi.org/suno-api/get-music-generation-details), [crédits](https://docs.sunoapi.org/suno-api/get-remaining-credits). Service officiel Suno distinct : [platform.suno.com](https://platform.suno.com/).

### Salad : raccord présent, qualification distante absente

Le raccord réutilise `src/lib/local-engine.ts`, le bridge `scripts/comfyui-engine-server.mjs`, `src/lib/salad/**` et le port durable PostgreSQL T01. Entrée `src/lib/salad/serve.mts` ; désactivée sans `SALAD_ENABLED=true`, aucun moteur concurrent. Le host ne lance pas un autre ComfyUI.

Le packaging restant est précisément décrit dans [le README existant du conteneur](../../src/lib/salad/container/README.md). Linux/amd64, Node24, loader `tsx` verrouillé (dépendance dev : `npm ci --omit=dev` seul est insuffisant), pg/zod/imports transitifs, ComfyUI/Python/PyTorch/CUDA épinglés, ffmpeg/ffprobe. Aucun Dockerfile/image qualifié n’est présent ; aucun build/image/push/download de modèle exécuté dans ce lot. Les versions compatibles et le digest ne peuvent pas être inventés.

Modèle déclaré strict : `ltxv-13b-0.9.8-distilled-fp8`, T2V uniquement, checkpoint et `t5xxl_ltxv_official.safetensors` vérifiés par SHA, VAE du checkpoint. Ce n’est pas LTX V2 API. Manifest : image@sha256, architecture, preuves datées, GPU/CUDA/VRAM totale et libre mesurés, profils effectivement testés ; aucun profil de fixture utilisable en production. Une RTX3090 24Go n’est pas qualifiée par sa seule mémoire.0,09USD/h est une ancienne indication, pas un forfait garanti.

Gateway HTTPS protégé par `Salad-Api-Key` côté serveur applicatif ; Bearer distinct côté worker ; clé compte jamais distribuée au worker. GET `/health`, GET `/v1/capabilities`, POST `/v1/jobs`, GET `/v1/jobs/{id}` et `/media` sont nos routes, pas l’API de gestion Salad. Host IPv6`::`, ComfyUI/bridge loopback privés. Timeout HTTP<100s Gateway ; tâches longues asynchrones avec slot PostgreSQL externe. Readiness exige les11 interfaces de nœuds ComfyUI, file, hashes des poids, VRAM/GPU/CUDA, health du bridge et slot durable. Cold start indisponible jusqu’à inspection terminée.

Soumission unique après intention durable et réservation atomique, GET de reprise ; timeout/éviction/ACK perdu conservent UNKNOWN et verrou, même après404. SIGTERM draine les réservations en vol et calculs, SIGKILL ne libère pas magiquement le slot. Aucun retry POST, annulation distante, fallback vers autre API ou modèle. Artefact externe immuable, taille/profil/SHA contrôlés. Estimation calcul=taux approuvé×timeout, hors idle/stockage/réseau ; coût réel/quota restent inconnus. Le seuil d’estimation ne garantit pas un plafond de facture.

Sources : [Salad Developers](https://salad.com/developers/), [Gateway et authentification](https://docs.salad.com/container-engine/how-to-guides/gateway/sending-requests), [tâches longues](https://docs.salad.com/container-engine/explanation/job-processing/long-running-tasks), [réseau](https://docs.salad.com/container-engine/explanation/infrastructure-platform/networking), [cold starts](https://docs.salad.com/container-engine/how-to-guides/cold-starts-and-iterating-quickly), [modèles Lightricks](https://github.com/Lightricks/LTX-Video).

Voix/images du lot antérieur : sources et contrats de sécurité inchangés, preuves réutilisées ; aucune nouvelle lecture de clé voix/image ni génération. Aucun delta pipeline/Shotstack/UI/OAuth.

## Provenance, configuration et responsabilité

`live.json` liste **les noms seulement**, présence et source. Lecture master privée/propriétaire vérifiés, parse dotenv en mémoire avec normalisation T01, aucune valeur ni corps fournisseur journalisé. Aucune variable héritée du shell utilisée pour les sondes ; aucun `.env.local` créé ou modifié. Les seules valeurs retenues pour requêtes sont les variables de la whitelist du harnais.

RunPod, les deux clés Shotstack, SunoAPI et LTX sont présents. `SUNO_BASE_URL` historique n’a pas priorité sur `SUNO_API_BASE_URL`. `SHOTSTACK_ENV` manque dans le master : **non bloquant**, code par défaut stage ; aucune correction automatique de configuration.

Les14 noms Salad suivants sont absents du master. Ils ne sont pas demandés pour activer immédiatement le service :

- Application seulement : `SALAD_API_KEY`, `SALAD_GATEWAY_URL`, `SALAD_MAX_ESTIMATED_COMPUTE_USD`.
- Application et worker : `SALAD_WORKER_TOKEN`, `SALAD_QUALIFICATION_JSON`, `SALAD_QUOTE_JSON`, `SALAD_REQUEST_TIMEOUT_MS`, `SALAD_GENERATION_TIMEOUT_MS`.
- Worker seulement : `SALAD_WORKER_DATABASE_URL`, `SALAD_DEPLOYMENT_RECEIPT_PATH`, `SALAD_COMFY_URL`, `SALAD_BRIDGE_URL`, `SALAD_WORKER_PORT`.
- Flag partagé : `SALAD_ENABLED`, **à conserver désactivé avant autorisation et qualification**.

Mac : worktree isolé, POLICY_OK, aucune IA/modèle, dépendances déjà disponibles réutilisées, aucune installation/build globale. OVH : preuve T01 du bulletin consolidation13:48UTC, source86d04c85 healthy/0restart ; aucune nouvelle lecture SSH ni écriture distante par T04. Cette preuve n’est pas présentée comme une observation directe T04 du runtime.

## Vérifications et défauts

**PASS nouveaux :14 tests hors ligne,0FAIL,0SKIP ; lint0erreur.** Réseau et lecture secrets bloqués pour les tests par `qa/t08/offline.cjs` ; fetch injecté. Tests : lecture sélective/normalisation, doublons et syntaxe fermée, priorité URL, clés par environnement, liste de GET autorisés, refus mutation/admin/redirect/injection, schémas valides/malformés, HTTP401/403/404/429/500, code applicatif Suno, quotas inconnus, corps bornés, deadlines en-têtes+flux, une tentative, expurgation.

Commandes exécutées avec Node24.21.0 (`/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node`) :

```sh
node --require ./qa/t08/offline.cjs --test qa/t04-provider-validation-20261014/probe.test.mjs
node node_modules/eslint/bin/eslint.js qa/t04-provider-validation-20261014/probe.mjs qa/t04-provider-validation-20261014/probe.test.mjs
```

Les commandes ci-dessus utilisent le binaire Node24 indiqué, pas un changement du Node global. Journaux `offline-tests.log` et `lint.log`. Lecture réelle unique : `node qa/t04-provider-validation-20261014/probe.mjs --read-only-master` (sans offline guard), quatre GET seulement.

**FAIL historiques du harnais, corrigés** : lecteur initial trop strict sur espaces échappés de bord dotenv (échec avant tout réseau) ; classification Suno429 trop générique. Reproductions `parser-red.log`, `classifier-red.log`, puis14PASS. Aucun défaut applicatif nouveau démontré, aucun correctif produit dupliqué. La correction de classification d’erreur est postérieure aux quatre lectures réussies ; leur chemin HTTP200/code200 est inchangé, les sondes n’ont pas été répétées.

**PASS réutilisés, pas réexécutés ni additionnés** : `reuse.json` établit36 empreintes identiques au lot T04 précédent et zéro delta applicatif/dépendances/config entre la CI86d04c85 et e09fdae. Lot précédent91PASS et TS/lint ciblés ; CI [38508390596](https://github.com/puramapro-oss/sutra/actions/runs/38508390596),805PASS/7SKIP contrats, TS/lint/build/sécurité/PG verts selon `qa/final-delta-20261014/FINAL-TESTS.json`. Les7SKIP ne sont pas des PASS. Ce lot QA JavaScript ne change aucun input TypeScript/build applicatif.

GitNexus : index local isolé, impacts `parseSelected` et `classify` LOW, chacun1 appelant direct,0processus applicatif identifié. `detect_changes(scope=staged)` :35 symboles/documentations,0processus affecté identifié, risque LOW, chemins uniquement dans ce lot. Comparaison requise à `main` :5627symboles/231processus, risque CRITICAL, incluant2251fichiers de l’intégration antérieure ; ce n’est pas l’impact du seul delta T04. Avertissement communiqué. Troncatures de graphe conservées (1146entrées non explorées,667callees omis,3parcours tronqués) : **exhaustivité UNKNOWN**, jamais certification complète. Détails dans les fichiers `gitnexus-*`. Scan secrets expurgé et diff-check consignés dans `proof.json`.

**NON TESTÉ** : aucune génération/rendu/publication, aucun job distant créé/pollé/annulé/récupéré, aucun crédit LTX/RunPod/Shotstack contrôlé, aucun GPU/VRAM/image réel, aucun débit/concurrence/OOM fournisseur réel. Les succès simulés des contrats sont des preuves locales, pas une qualification en production.

## Protocole minimal restant à autoriser

1. L’utilisateur choisit **un fournisseur et un budget explicite** pour un seul essai ; pas de recharge/rotation/connexion à réparer démontrée pour les quatre lectures réussies. LTX : première soumission minimale permise par le modèle retenu avec coût affiché, puis ID durable/polling/récupération/hash/facture. SunoAPI et Shotstack : essais distincts seulement s’ils sont autorisés, avec clés correspondant à l’environnement.
2. Si RunPod choisi, T01 confirme l’image, son schéma `input`/sortie, le GPU et la limite d’exécution serveur sur l’endpoint existant avant tout `/run`. [Console Serverless](https://console.runpod.io/serverless). Le health200 seul ne demande aucune extension admin de clé.
3. Si Salad choisi, T01 prépare une image Linux/amd64 épinglée et les dépendances/poids/licences ; journal PostgreSQL externe et rôle restreint, reçu indépendant/image en lecture seule, devis et authentifications serveur. L’utilisateur autorise ensuite ressource/budget/cold start pour la qualification réelle. [Salad Developers](https://salad.com/developers/), [prix officiels](https://salad.com/pricing/). Aucun modèle/GPU ne doit être marqué compatible avant mesures.
4. Sur la ressource autorisée seulement : GET santé/capacités avec deux authentifications et refus mauvais token ; vérifier modèle/profil/VRAM/CUDA/digest ; un petit job, ID et état persistés, récupération immuable et SHA, latence/VRAM/facture. Tester perte d’ACK/arrêt par fixtures d’abord ; toute éviction/annulation réelle nécessite accord et budget propres. Reprendre exclusivement le même ID par GET ; en statut incertain, aucune nouvelle soumission ni autre fournisseur.
5. T01 seul intègre ce dossier et décide toute activation/configuration/production. Aucun push, merge, provisioning ou déploiement dans ce lot. Pas de nouvelle boucle d’audit sans delta ni autorisation d’essai.
