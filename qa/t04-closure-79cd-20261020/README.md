# T04 — clôture fournisseurs, 20 octobre 2026

Candidat T01 vérifié : **79cd95bfdb3e5837e2a78e45efaea444cb8dcf8a** (branche intégration propre lors du contrôle). Branche auteur : `codex/sutra-t04-closure-79cd-20261020`, worktree `sutra-t04-ack-ab935-20261019`. Le candidat historique ab935 n'est pas la base de ce lot.

**NACK propriétaire sur 79cd pour trois défauts des adaptateurs musicaux secondaires. ACK du correctif local uniquement, sous réserve de son intégration et de la recette du nouveau SHA par T01/T08.** La CI verte antérieure ne couvrait pas ces contre-exemples. T08 a reproduit indépendamment les trois FAIL sur 79cd (notification partagée du 19 octobre 22:54 UTC).

## Corrections et intégration

| Défaut reproduit sur 79cd | Cause | Correction locale |
|---|---|---|
| Stable Audio `processing` avec `output` traité comme terminé | Seule présence de l'URL vérifiée | ID et statut contrôlés; seul `succeeded` peut retourner un média; erreur typée conservant le job sinon |
| Corps privé d'une erreur HTTP401 Stable Audio dans l'exception | Diagnostic distant concaténé au message | Code HTTP public seulement; corps libéré, taille/deadline bornées, aucune redirection ni nouvelle soumission |
| Réponse MusicalAPI documentée rejetée | Lecture de `data.stream_audio_url`, sans `data.data[0].stream_audio_url` | Structure imbriquée prise en charge, compatibilité du format plat conservée; identité/statut/URL validés |

Le wrapper conserve les erreurs typées et les identifiants. Les coûts réels/estimés et quotas non fournis restent inconnus (`null`, `not_reported`), jamais zéro inventé. Le polling MusicalAPI passe de 3 à 13 secondes pour respecter le quota standard documenté de 5 requêtes/minute **pour un seul job**; un 429 arrête explicitement le suivi. Aucun limiteur de quota global multi-jobs ajouté, aucun fallback payant automatique.

Fichiers produit exacts : `src/lib/stable-audio.ts`, `src/lib/riffusion.ts`, nouveau `src/lib/music-provider-job.ts`, `src/lib/fallbacks.ts` (import et catch de `generateMusicWithProvenance` uniquement). Aucun connecteur WanGP, pipeline, UI, SQL, config de production ou fichier de secret modifié.

**ElevenLabs : correctif déjà intégré.** Commit auteur `6d7d75a60087933f30027189c678f62031ed7ec5`, consolidation f1849c0, blob `ea5fcdfca79859e79c7bac9dea85eb0dfe78a2c0` identique sur 79cd. Aucun nouveau commit ElevenLabs à intégrer. Stock : correctif `62bb57f94525e6e4063d2209436da911c6f96d8b`, blob intégré `c6fdc199280d805ac928b9ba6aad257247d13975`. Coverr registre/admin-health T01 déjà corrigés et testés.

## Matrice de validation

PASS contrat = preuve hors ligne avec mocks, **pas génération réelle**. Les lectures authentifiées ci-dessous sont les preuves expurgées du **19 octobre 2026**, réutilisées sans nouvelle lecture du master ni sonde fournisseur conformément à la coordination T01. Elles ne certifient pas l'état actuel du compte. Source : [free-reads.json](../t04-ack-ab935-20261019/free-reads.json). Une absence/malformation locale ne prouve jamais un refus du fournisseur.

| Fournisseur / variables utiles | Contrat et preuve locale | Authentification connue / limite réelle |
|---|---|---|
| LTX V2 — `LTX_API_KEY` | PASS, CI exacte réutilisée + régressions fournisseur; jobs/checkpoint, polling/reprise, erreurs et coûts explicites | Présence historique seulement; authentification, crédits, média réel NON TESTÉS |
| WAN / RunPod — `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, option `RUNPOD_POD_URL` | PASS; POST `/run` unique, GET `/status/{id}`, états et sortie du worker validés, erreurs avec ID, aucun retry POST incertain | Health endpoint200 le19/10, zéro worker prêt; ni crédit ni génération validés. Un refus d'administration n'invalide pas cette clé limitée. WAN2.2 annoncé par le contrat SUTRA, modèle effectif/qualité/GPU NON QUALIFIÉS; tier «4k» n'est pas UHD natif |
| Shotstack — `SHOTSTACK_API_KEY`, `SHOTSTACK_PRODUCTION_KEY`, `SHOTSTACK_ENV` | PASS; stage/v1 distincts, x-api-key, soumission/polling/erreurs; correction annulation intégrée; aucun rendu lancé | GET templates stage200 et v1 200 le19/10; crédits, droits de rendu et annulation réelle NON TESTÉS |
| SunoAPI — `SUNO_API_KEY`, `SUNO_API_BASE_URL`, alias `SUNO_BASE_URL` | PASS; origine HTTPS api.sunoapi.org/api/v1 allowlistée, Bearer, POST generate puis GET record-info, checkpoint taskId/reprise; callback non utilisé comme preuve finale | GET crédits200 le19/10, crédits disponibles à cet instant; génération NON TESTÉE. Fournisseur tiers SunoAPI, pas API officielle de Suno; URL canonique prioritaire sur alias |
| ElevenLabs — `ELEVENLABS_API_KEY` | PASS; URL/header xi-api-key corrects, liste/clone/TTS bornés, schémas/média/erreurs contrôlés | **BLOQUÉ compte/clé** dans preuve19/10 : HTTP401 `invalid_api_key` sur `/v1/voices`. Aucun défaut d'URL/header démontré; cause précise révocation/workspace non déterminable. v1 reste documenté mais déprécié et limité aux workspaces de ≤500 voix; migration paginée v2 non requise par ce 401 |
| Pexels — `PEXELS_API_KEY` | PASS; Authorization, recherche vidéo/photo, erreurs distinctes du résultat vide, URLs HTTPS | **BLOQUÉ configuration** le19/10 : valeur analysée malformée, zéro requête. Validité fournisseur NON TESTÉE |
| Pixabay — `PIXABAY_API_KEY` | PASS; clé query, schéma/URL de vidéo, erreurs expurgées | Absente le19/10, option non activée; auth NON TESTÉE |
| Unsplash — `UNSPLASH_ACCESS_KEY` | PASS stock, Client-ID et URLs contrôlés | Catalogue200 le19/10; téléchargement réel/licence d'un média choisi NON TESTÉS |
| Coverr — `COVERR_API_KEY` | PASS; Bearer, `urls=true`, URL originale; registre/admin-health T01 authentifiés seulement si configurés, 4 tests PASS | Absente le19/10; aucune lecture anonyme présentée comme validation; compte/quota NON TESTÉS |
| Pollinations | PASS des gardes hors ligne existantes, endpoint historique de preview conservé; **disponibilité NON QUALIFIÉE** | Docs courantes décrivent gen.pollinations.ai avec clé/budget. Aucune preuve que le vieil endpoint est disponible ou retiré. Toute sonde image peut générer : non exécutée. Raccord preview/pipeline transféré à T03/T01, aucun basculement payant ajouté |
| Stable Audio / Replicate — `REPLICATE_API_TOKEN` | FAIL sur79cd → PASS local corrigé; modèle stable-audio-2.5, durée entière1..190, soumission unique, succès terminal seulement | Configuration actuelle/auth/crédits NON TESTÉS. Une prédiction encore active est rendue comme erreur réconciliable avec ID, pas resoumise; suivi automatique durable supplémentaire non ajouté |
| Sélection Riffusion / MusicalAPI — `RIFFUSION_API_KEY` | FAIL sur79cd → PASS local corrigé; POST prompt puis POST request_id, pending/complete/failed, résultats imbriqués et plats | API réelle = MusicalAPI/Lannetech, pas API officielle Riffusion. Configuration/auth/crédits NON TESTÉS. Quota commun multi-jobs, facturation et annulation réelles NON QUALIFIÉS |
| Salad — voir ci-dessous | PASS contrats/image statique/sécurité/durable; CI exacte inchangée réutilisée. Désactivé, même worker local-engine/ComfyUI et journal existants | **BLOQUÉ configuration** dans preuve19/10; aucune requête Salad ni création GPU. Auth, organisation/projet, image exécutée, GPU et modèles réels NON TESTÉS |
| Texte Claude/SMARANA | Délégation existante préservée; aucune seconde IA introduite | Absence/présence de `ANTHROPIC_API_KEY` locale n'est pas une preuve de disponibilité du service SMARANA; authentification/génération hors périmètre et NON TESTÉES |

## LTX : portée réellement prise en charge

Les contrats async officiels documentent POST202 avec ID, GET du même job et résultat `video_url`; le code conserve l'intention avant soumission, distingue résultat incertain et échec, ne rejoue pas un POST payant et reprend par le même ID. Un timeout/abort local n'est pas un arrêt de calcul distant. Les webhooks et l'annulation distante ne sont pas annoncés : fonctions refusées explicitement faute de contrat documenté. [Async jobs](https://docs.ltx.io/async-jobs).

Texte→vidéo, image→vidéo (première/dernière image), audio→vidéo, retake, extend, HDR et reframe restent pris en charge selon les capacités bornées; pas de vidéo→vidéo arbitraire ni multi-références promis. Le sous-ensemble ltx-2-3-fast/pro demeure documenté malgré l'ajout officiel de2.5; aucune migration implicite de modèle/coût. Résolutions paysage/portrait, fps24/25/48/50 et durées validées selon modèle/qualité. [Texte](https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-text-to-video), [image](https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-image-to-video).

Tarifs2.3 relus le20/10 : tables du code conformes; T2V/I2V fast0.03/0.06/0.12/0.24 USD/s et pro0.04/0.08/0.16/0.32 suivant résolution. Retake facturé sur vidéo source; extend inclut contexte+extension plafonné à505frames. Estimation distincte de la facture réelle, qui reste inconnue sans reçu fournisseur. [Prix officiels](https://docs.ltx.io/pricing). Ne pas interpréter un budget local comme plafond contractuel de facture distante.

## Salad : activation restante, sans provisioning

Le diagnostic19/10 porte sur le format dotenv de `SALAD_API_KEY`, malformé, et les noms absents `SALAD_ORGANIZATION_NAME`, `SALAD_PROJECT_NAME`. Les anciens aliases `SALAD_ORGANIZATION`/`SALAD_PROJECT` étaient également absents. Aucun refus API Salad n'a donc été observé. Les identifiants doivent être obtenus depuis le portail : l'API publique ne découvre pas les organisations/projets sans scope préalable. [Découverte officielle](https://docs.salad.com/agents/container-engine/discover-scope-and-preflight).

Activation séparée : `SALAD_CONTAINER_GROUP`, `SALAD_ENABLED`, `SALAD_GATEWAY_URL`, `SALAD_WORKER_TOKEN`, `SALAD_WORKER_DATABASE_URL`, `SALAD_QUALIFICATION_JSON`, `SALAD_QUOTE_JSON`, `SALAD_MAX_ESTIMATED_COMPUTE_USD`, `SALAD_REQUEST_TIMEOUT_MS`, `SALAD_GENERATION_TIMEOUT_MS`; les noms ne doivent pas être remplis par des valeurs fictives. Les noms de CONTAINER_GROUP à QUOTE_JSON étaient explicitement contrôlés absents dans la preuve19/10; les limites/timeouts doivent être définis/validés par l'opérateur, absence actuelle non affirmée.

Le compte/gateway utilise la clé Salad côté serveur; le worker ne reçoit que son token distinct. Image existante versionnée et dépendances verrouillées (Node24/Python3.12, ComfyUI révision fixée, CUDA); utilisateur non-root, montage modèles en lecture seule. Health/capabilities, journal PostgreSQL, slot unique, interruption/redémarrage et reprise GET sont déjà implémentés/testés hors GPU. Image non construite/exécutée ici. Profil déclaré LTXv1 3B0.9.8 distilled FP8 texte→vidéo sans audio, **pas qualification LTXV2 ni RTX3090**. Le tarif historique0.09USD/h n'est pas garanti. Voir [recette/image et limites](../../src/lib/salad/container/README.md).

## Preuves et commandes

- Diagnostics bruts conservés dans `raw-diagnostics.tar.gz`; seules les espaces finales/fin de fichier de quatre sorties ont été normalisées pour le diff, empreintes dans `whitespace-normalization.json`.
- Rouge candidat : `red.log/json`, **0PASS/3FAIL**, puis preuve indépendante T08. Préservé.
- Régressions ciblées : `targeted-contracts.log/json`, **119PASS/0FAIL/0SKIP**, dont40nouveaux. Anciennes suites inchangées non rejouées ensuite.
- Ajout spécifique délai après acceptation : `music-final.log/json`, **41PASS/0FAIL/0SKIP** sur les deux nouveaux fichiers (recoupe les40 précédents; ne pas additionner les totaux).
- `typecheck.json/log` : `tsc --noEmit --incremental false` PASS; `lint.json/log` : ESLint des4fichiers produit +2tests PASS,0warning. Premiers échecs de syntaxe/typage du banc conservés puis corrigés.
- `run.py` utilise Node24, environnement de test allowlisté/synthétique et garde `qa/t08/offline.cjs`; réseau externe et lecture des fichiers de secrets bloqués. Aucun master lu lors de cette reprise, aucune valeur copiée/configurée.
- `ci-receipt.json` : CI exacte **39328438907 SUCCESS** de79cd,3jobs; contrats1261PASS/0FAIL/7SKIP historiques, TypeScript/lint/build PASS du candidat. Cela couvre les autres adaptateurs inchangés, pas le nouveau delta. `inputs.json` compare leurs blobs, les tests et dépendances déclarées. Pas de nouveau build ou suite globale identique.
- GitNexus : impacts préalables LOW, appelant direct `generateMusicWithProvenance`, wrapper compatible en amont. Index local rafraîchi sans embeddings; graphe partiel, pas certificat exhaustif. Rapports `impact-*.json`, `gitnexus-*-index.txt`, `detect-*.txt`. Analyse staged LOW (31symboles); comparaison `main` CRITICAL (5526fichiers,3124symboles,109flux, liste bornée), car elle inclut toute la lignée intégrée. Ce résultat est signalé, non attribué aux4fichiers T04. Diff/gitleaks enregistrés avant commit.

Rejeu des seules nouveautés sous Node24 :

```sh
node --experimental-test-module-mocks --import tsx --test qa/t04-closure-79cd-20261020/music-contracts.test.mts qa/t04-closure-79cd-20261020/music-provenance.test.mts
```

Utiliser `python3 qa/t04-closure-79cd-20261020/run.py music-final ...` sur le poste auteur pour l'environnement strict; les arguments et exécutables exacts sont dans les reçus JSON. Pour T01 : ajouter ces2fichiers à `scripts/run-ci.mjs` dans son propre lot d'intégration, sans copier le WIP d'un autre terminal. Gate du nouveau candidat requise, aucune approbation de déploiement donnée.

## Documentation primaire comparée le20/10

[RunPod](https://docs.runpod.io/serverless/endpoints/send-requests) : /run, /status, /cancel documentés; le connecteur SUTRA n'ajoute pas d'annulation RunPod distante et ne confond pas attente locale et arrêt GPU. [Shotstack](https://shotstack.io/docs/api/) : environnements stage/v1 et clé correspondante. [SunoAPI](https://docs.sunoapi.org/suno-api/generate-music) : tâche asynchrone du fournisseur tiers. [ElevenLabs v1](https://elevenlabs.io/docs/api-reference/legacy/voices/get-all), [v2](https://elevenlabs.io/docs/api-reference/voices/search). [Pexels](https://www.pexels.com/api/documentation/), [Pixabay](https://pixabay.com/api/docs/), [Coverr](https://api.coverr.co/docs/auth/), [Pollinations](https://github.com/pollinations/pollinations/blob/main/gen.pollinations.ai/src/docs/apidocs-recipes.md). [Stable Audio schema](https://replicate.com/stability-ai/stable-audio-2.5/api/schema), [cycle Replicate](https://replicate.com/docs/topics/predictions/lifecycle), [MusicalAPI](https://musicalapi.com/docs/) : structure imbriquée et quota. Aucune clé valide, aucun crédit et aucune génération déduits de la seule documentation.

## Actions minimales et prochain essai réel

1. Avec T01, vérifier/corriger dans la source privée uniquement `SALAD_API_KEY`, `SALAD_ORGANIZATION_NAME`, `SALAD_PROJECT_NAME` depuis [Salad Portal](https://portal.salad.com/), puis GET quotas/groupes existants, zéro start/scale/create. La preuve disponible est historique, ne pas écraser une saisie plus récente sans diagnostic.
2. Vérifier `ELEVENLABS_API_KEY` et son workspace/permissions dans [ElevenLabs](https://elevenlabs.io/app/settings/api-keys); le dernier GET connu est401. Vérifier le format `PEXELS_API_KEY` depuis [Pexels API](https://www.pexels.com/api/); aucun refus Pexels démontré. Aucune nouvelle clé créée par T04.
3. `PIXABAY_API_KEY` et `COVERR_API_KEY` restent facultatives : consentement/activation seulement si ces catalogues sont voulus ([Pixabay](https://pixabay.com/api/docs/), [Coverr](https://api.coverr.co/docs/auth/)). Décision Pollinations au propriétaire preview/pipeline, pas de migration payante silencieuse.
4. Après intégration T01/T08 et autorisation de budget distincte : un seul fournisseur/modèle, un seul job à la durée/résolution minimale autorisée, sans fallback; enregistrer intention/ID avant attente, reprendre uniquement le job connu, vérifier statut terminal puis télécharger et vérifier le média. Pour Salad : d'abord image digest/runtime et GPU réellement compatibles, health/capabilities, un replica explicitement autorisé, test interruption/reprise et reçu de facture; aucune de ces opérations facturables n'est effectuée ici. Réconcilier facture, quota et provenance, puis arrêter selon procédure opérateur. Aucun achat, modèle massif ou exécution IA sur Mac.
