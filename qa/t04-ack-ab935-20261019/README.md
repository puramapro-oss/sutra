# T04 — fournisseurs, ACK du candidat ab935 — 19 octobre 2026

Base effectivement relue chez T01 : **ab935e59ca4e39776630f05b2ba6c0422c74ec62**, branche `codex/sutra-final-providers-20261013`. Travail isolé : `codex/sutra-t04-ack-ab935-20261019`. Aucun autre adaptateur recréé, aucun connecteur WanGP modifié.

**ACK T4 sur ab935 : BLOQUÉ pour validation fournisseurs complète.** Le catalogue unifié masque des erreurs sur cette base ; correction locale vérifiée dans `src/lib/stock.ts`, à intégrer par T01. Plusieurs accès dépendent encore du propriétaire. **PASS du delta local** n'est ni un ACK du futur SHA d'intégration, ni une qualification GPU, ni une autorisation de déployer. T08 reçoit les résultats ci-dessous avec leurs limites.

## Matrice des fournisseurs réellement présents

`PASS contrat` désigne des mocks/contrats, avec preuves CI réutilisées lorsque les blobs sont inchangés. `PASS lecture` ne signifie ni crédits ni génération. Aucune génération réelle n'a été effectuée.

| Fournisseur / chemin | Contrat / code | Lecture gratuite actuelle | Crédits / génération / limite |
| --- | --- | --- | --- |
| LTX V2 — `ltx.ts`, `ltx-v2*.ts`, `ltx-workflow.ts` | PASS contrats intégrés ; modèles `ltx-2-3-fast/pro`, requêtes strictes, ID/poll/reprise/coût séparé | NON TESTÉ : `LTX_API_KEY` présente ; pas de lecture de compte gratuite documentée ni ID de job existant fourni | NON TESTÉ ; détails ci-dessous. Pas de bascule WAN après soumission incertaine |
| WAN / RunPod — `wan.ts`, `runpod.ts` | PASS contrats intégrés, `/run` → ID → `/status/{id}` ; résultat contrôlé | PASS HTTP 200 `/v2/{endpoint}/health`, portée endpoint ; zéro worker prêt au contrôle | Crédits et génération NON TESTÉS. Image/version/VRAM du worker et son schéma métier NON QUALIFIÉS par health. API `/cancel` documentée, pas de helper d'annulation distante exposé par cet adaptateur |
| Shotstack — `shotstack.ts` | PASS contrats intégrés, clés et routes stage/v1 distinctes ; aucun changement T04 | PASS HTTP 200 `/edit/stage/templates` et `/edit/v1/templates` avec leurs clés respectives | Rendu et crédits NON TESTÉS ; ne pas interpréter ces GET comme un rendu réussi. `SHOTSTACK_ENV` absente : défaut stage du code |
| SunoAPI — `suno.ts` | PASS : `/api/v1/generate`, modèle V6, customMode, callback ; taskId et `/generate/record-info` ; reprise sans nouveau POST | PASS HTTP 200 `/api/v1/generate/credit`, URL configurée admise par l'allowlist | Crédits disponibles confirmés sans montant publié ; musique NON TESTÉE. Fournisseur tiers SunoAPI, pas l'API officielle de Suno. Annulation distante non établie |
| ElevenLabs — `elevenlabs.ts` | PASS contrats intégrés, `xi-api-key`, `/v1/voices`, MP3/erreurs bornés | **BLOQUÉ : HTTP 401 `invalid_api_key`** via le véritable adaptateur ; URL/méthode/en-tête contrôlés | `ELEVENLABS_API_KEY` refusée par le fournisseur. Ce résultat ne vient pas d'un simple contrôle de présence. Synthèse/clone/crédits NON TESTÉS |
| Pexels — `pexels.ts` + `stock.ts` | PASS adaptateur principal intégré ; FAIL reproduit du catalogue unifié sur ab935, **PASS après correction locale** | **BLOQUÉ avant réseau** : `PEXELS_API_KEY` malformée après parsing dotenv, texte de syntaxe shell/espaces | Authentification NON TESTÉE : ne pas qualifier la clé de refusée par Pexels. `/v1/videos/search` est bien un endpoint officiel actuel |
| Pixabay — `stock.ts` | PASS delta mocks : schéma variants, orientation, HTTPS, erreurs explicites | **BLOQUÉ : `PIXABAY_API_KEY` absente** | Catalogue réel NON TESTÉ ; clé facultative si source non utilisée |
| Unsplash — `stock.ts` | PASS delta mocks + réponse réelle ; `Client-ID`, `/search/photos`, URLs/ixid conservés | **PASS HTTP 200**, 20 résultats analysés, une seule requête | Aucune image téléchargée ; attribution/hotlink et suivi de téléchargement au moment de la sélection relèvent du consommateur UI/pipeline |
| Coverr — `stock.ts` | FAIL reproduit : ancien appel anonyme et `urls` manquant ; **PASS mocks après Bearer + `urls=true`** ; aperçu basse définition jamais promu HD | **BLOQUÉ : `COVERR_API_KEY` absente**, aucun appel anonyme | Aucun catalogue réel téléchargé. Le registre `env.ts` dit encore « sans clé » : défaut transmis T01, fichier non modifié |
| Salad — `salad/*`, `salad-persistence.ts`, bridge canonique | PASS contrats intégrés, désactivé par défaut, workers/journal/provenance existants réutilisés | **BLOQUÉ avant réseau** : `SALAD_API_KEY` malformée ; `SALAD_ORGANIZATION_NAME`, `SALAD_PROJECT_NAME` absentes | Organisation/projet/groupe/image/GPU/santé réelle NON TESTÉS. API publique sans découverte exhaustive des organisations/projets. Pas de provisioning |
| Pollinations — `storyboard.ts`, branche thumbnail production | Ancien helper intégré `image.pollinations.ai/prompt`, bornes/nofeed prouvés par mocks historiques ; **contrat actuel NON QUALIFIÉ** | NON TESTÉ : même un GET de génération est exclu de cet audit | Docs actuelles orientées `gen.pollinations.ai` avec authentification/budget. Transmis T01/T03 : décider du maintien de l'ancien preview ou de sa désactivation/migration sous autorisation ; aucun remplacement payant implicite |
| Texte Claude / SMARANA — `claude.ts` | Délègue réellement à `smarana.ask`, pas à un nouvel adaptateur Anthropic | NON TESTÉ, aucun appel LLM | `ANTHROPIC_API_KEY` présente mais vide n'est pas une preuve de panne du chemin SMARANA ; modèles/effectivité/budget à qualifier avec son propriétaire |

## LTX : capacités, reprise et facturation

Les corrections T04 antérieures sont intégrées et inchangées : T2V, I2V avec première/dernière image, retake, extend, transformations vidéo HDR/reframe. Aucune promesse de V2V générique ni de références multiples arbitraires. Les schémas refusent les champs non pris en charge. Les modèles 2.3 restent la sélection explicite ; aucune migration automatique vers un autre modèle disponible.

POST V2 unique → HTTP 202/ID persisté → GET lié à l'endpoint. Intervalle de polling au moins 5 s ; erreurs de lecture transitoires bornées ; échéance et corps JSON bornés. La reprise relit le job, elle ne rejoue pas le POST après issue payante incertaine. Le checkpoint d'intention est une protection applicative, pas une garantie d'idempotence fournisseur. Un job expiré/inconnu reste à réconcilier. La documentation annonce une rétention terminale pouvant aller jusqu'à 24 h et une expiration séparée des médias.

Webhook et annulation distante LTX : non annoncés comme disponibles par le code. Un arrêt local du polling ne garantit pas l'arrêt de facturation. Un état terminal sans ID cohérent et URL de résultat attendue est refusé ; la vérification des octets/media/SHA en aval reste nécessaire avant `ready`.

Formats : 720p à 4K et orientations selon la grille du contrat ; Fast 720/1080 à 24/25 fps accepte 6 à 20 s par pas de 2 ; autres grilles 6/8/10 s. Retake/extend exigent les métadonnées d'entrée et au moins 73 frames. Extend 2–20 s, contexte 1–20 s, somme plafonnée à 505 frames et tarif seulement établi en 1080p. HDR et reframe ont leurs plafonds d'entrée propres. Toutes ces assertions sont des contrats, pas une génération prouvée.

Estimation USD sourcée et montant réel séparé : `actual=null`, `actualStatus=not_reported`. Fast/pro ont des tarifs par seconde et résolution ; extend inclut le contexte ; aucun taux 4K extend inventé. Le code de sélection conserve un taux EUR indicatif daté : il ne remplace pas une facture. Le test réel devra rapprocher reçu fournisseur et estimation.

Sources officielles consultées le 19 octobre : [jobs asynchrones](https://docs.ltx.io/async-jobs), [grille 2.3](https://docs.ltx.io/models/ltx-2-3), [tarifs](https://docs.ltx.io/pricing/), [changelog V2](https://docs.ltx.io/api-changelog/2026/8/16). L'ancien modèle `ltx-2` n'est pas réintroduit ; le chemin livré utilise V2 avant la fermeture annoncée de V1.

## Correction reproductible et impact

Sur ab935 : **8 FAIL / 2 PASS** (`stock-before.txt`, espaces de fin de ligne normalisés uniquement) : HTTP 401/403/429/500 ou JSON malformé devenaient `[]`, les échecs d'une source disparaissaient derrière les autres, URL Pixabay non HTTPS acceptée et transport/Coverr non conformes.

Cause : catches et `rejectBadStatus` convertissaient toute erreur en succès vide, absence de schéma/deadline, appel Coverr sans authentification. Correction dans le seul fichier produit `src/lib/stock.ts` : réutilisation de `providerRecord`, schémas Zod, limite 2 MiB / 15 s incluant le corps, refus des redirects, erreurs expurgées, zéro retry, credentials lus à la requête, conservation de la provenance. Tout échec d'une source configurée échoue désormais explicitement ; cette indisponibilité visible est intentionnelle. Sources facultatives sans clé ignorées ; aucune source utilisable → `STOCK_NOT_CONFIGURED`. Une réponse vide valide reste un succès vide.

Les variantes Pexels sans dimensions/non MP4 sont ignorées ; Coverr utilise son URL de téléchargement et ne présente pas un preview comme du HD. Les dimensions catalogue ne prouvent pas le décodage du fichier final. Aucun coût ou `ready` réel fabriqué. Aucun moteur de secours ajouté, aucun changement de pipeline, UI, route, OAuth, Shotstack, configuration ou WanGP.

GitNexus avant édition : `searchStock` LOW, un appelant direct `POST /api/stock/search`, zéro flow attribué ; helpers fournisseurs LOW, ancien `rejectBadStatus` MEDIUM/7 impacts. Index **partiel** (496 flows, candidats/branches écartés) : la revue du graphe n'est pas exhaustive. Rapports `stock-impact.txt`, `impact-*.txt`, `gitnexus-index.txt` ; contrôle staged/compare avant commit conservé séparément.

`detect-changes --scope staged` : 31 fichiers (avant ajout des reçus finaux), 18 symboles, zéro flow, risque LOW ; seuls les symboles produit de `stock.ts` et les sections des journaux sont nommés. Comparaison `--scope compare --base-ref main` : **CRITICAL**, 5118 fichiers / 11951 symboles / 399 flows, liste plafonnée et historique d'intégration entier. Avertissement transmis ; ce résultat n'est pas utilisé comme preuve exhaustive du delta. Le diff produit exact contre ab935 et les trois tests du véritable appelant bornent la revue locale.

## Tests et lectures : preuves distinctes

Node utilisé : `/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node` (Node 24). Dépendances existantes partagées en lecture, pas d'installation ni de build global.

| Commande exécutée (depuis le worktree T04) | Résultat / preuve |
| --- | --- |
| `node --import tsx --test qa/t04-ack-ab935-20261019/stock-contracts.test.mts` | **17 PASS, 0 FAIL** ; `stock-after.txt`. Succès/vide, 401/403/429/500, JSON invalide, URL dangereuse, provenance, transport, timeout en-têtes/corps, volume excessif, zéro retry |
| `node --experimental-test-module-mocks --import tsx --test qa/t04-ack-ab935-20261019/stock-route.test.mts` | **3 PASS, 0 FAIL** ; `stock-route.txt`. Vraie route + vrai adaptateur, fetch/auth mockés : 500 expurgé, 401 anonyme sans fetch, 200 vide valide |
| `node node_modules/typescript/bin/tsc --noEmit --project qa/t04-ack-ab935-20261019/tsconfig.json` | PASS ; `typecheck.txt` ; adaptateur, route appelante et harnais |
| `node node_modules/eslint/bin/eslint.js src/lib/stock.ts qa/t04-ack-ab935-20261019/*.mts` | PASS ; `lint.txt` |
| `python3 qa/t04-ack-ab935-20261019/reuse.py` | PASS ; `ci-reuse.json`, 1070 blobs inchangés, 161 assertions nommant les fournisseurs |
| `python3 qa/t04-ack-ab935-20261019/read.py --authorized-free-reads` | 5 GET le 19 octobre 19:44 UTC ; `free-reads.json`, résultats matrice |
| `python3 qa/t04-ack-ab935-20261019/unsplash-read.py --authorized-free-read` | 1 GET le 19 octobre 19:50 UTC ; `unsplash-read.json` |
| `gitleaks git --pre-commit --staged --redact=100 --no-banner --no-color` (rapport JSON dédié) | PASS, zéro détection ; `gitleaks.json` / `gitleaks.txt` |
| `git diff --cached --check` et parsing AST des trois scripts Python | PASS ; contrôle final consigné dans `validation.json` |

Réutilisation exacte de la CI T01 [38827288351](https://github.com/puramapro-oss/sutra/actions/runs/38827288351) sur ab935 : quality/contracts/disposable-database SUCCESS. Contrats **1209 PASS / 0 FAIL / 7 SKIP** (1216 tests), durable18 PASS, Salad média25 PASS, autres familles détaillées dans `ci-reuse.json`. Les 7 skips ne deviennent pas PASS. Commandes, empreintes des logs et blobs consignées ; reçus téléchargés par T01 conservés dans son worktree. **Compteurs non additionnés**, aucune nouvelle exécution globale. `stock.ts` exclu de la réutilisation et couvert par les 20 nouveaux tests. Aucun nouveau build/CI final du delta ni test navigateur/GPU/OVH n'est annoncé.

## Secrets et configuration

Source unique lue en mémoire : `~/.env.purama.master`, avec lecteur existant vérifiant fichier privé/régulier, propriétaire et absence de lien ; seules les variables utiles passent par stdin privé. Jamais de source shell, de valeur dans les logs, de corps brut fournisseur ou de copie `.env.local`. Aucun fichier secret modifié. `free-reads.json` ne conserve que noms, présence, origine et diagnostics booléens.

Six GET au total, zéro retry, zéro mutation distante, zéro génération. RunPod a été testé sur l'endpoint configuré, pas sur une API d'administration. ElevenLabs a reçu exactement le header documenté ; son 401 vient du fournisseur. Salad/Pexels n'ont pas reçu de requête avec une configuration malformée : impossible de conclure sur la validité du compte. Aucun SSH/OVH dans ce lot ; configuration déployée réservée à T01, non attestée par le master Mac.

## Salad / WanGP : avant le premier essai réel

Le Dockerfile et les dépendances verrouillées existants restent intacts : Node/Python fixés par digest, snapshot Debian, ComfyUI fixé par commit, dépendances Node/Python verrouillées, compte non root, modèles hors ligne en lecture seule. Le superviseur utilise le worker et bridge existants ; host7862 → bridge7861 → ComfyUI7860 en loopback. Aucun second moteur. La recette est préparée, **pas construite ni qualifiée sur GPU** ; aucun digest d'image finale ni téléchargement de poids n'est inventé.

Le modèle déclaré localement est LTX v1 3B 0.9.8 distilled fp8 T2V sans audio : ce n'est pas le service LTX V2. Aucune compatibilité WanGP, modèle/GPU/VRAM ou capacité 4K n'est déclarée sur la seule base d'un nom de GPU. Le contrat commun health/capabilities, ID/reprise, provenance et artefacts est conservé pour un futur raccord du connecteur par son propriétaire.

Une fois les trois variables d'accès valides, T01 peut autoriser uniquement GET quotas de l'organisation et GET container-groups du projet. L'API publique ne permet pas d'énumérer arbitrairement organisations/projets. Leurs noms URL se trouvent dans le [portail Salad](https://portal.salad.com/). Ensuite seulement : choisir groupe/image/digest, modèle+SHA+licence, classe GPU et devis daté, capacité VRAM démontrée. Variables d'activation encore absentes constatées : `SALAD_CONTAINER_GROUP`, `SALAD_ENABLED`, `SALAD_GATEWAY_URL`, `SALAD_WORKER_TOKEN`, `SALAD_WORKER_DATABASE_URL`, `SALAD_QUALIFICATION_JSON`, `SALAD_QUOTE_JSON`. Les timeouts et plafond `SALAD_MAX_ESTIMATED_COMPUTE_USD` devront aussi être renseignés/validés par T01 ; ils n'ont pas été lus dans cette session.

Protocole minimal **à autoriser, non exécuté** : budget total plafonné incluant cold-start/stockage/transfert, une réplique, un seul petit job conforme à la qualification ; relever image/GPU/VRAM et health/capabilities auth, soumettre une intention unique, persister job ID, vérifier reprise par GET sans nouveau POST, télécharger/prober/hacher un résultat, rapprocher coût estimé et reçu réel, puis arrêt contrôlé par T01. Interruption/redémarrage simulés sont prouvés localement ; leur essai GPU reste à autoriser séparément. Le prix historique RTX3090 24 Go à 0,09 $/h n'est pas un forfait garanti.

Pour LTX/RunPod/Suno/ElevenLabs/Shotstack, réserver un budget séparé et un seul job explicitement sélectionné ; pas de chaîne de fallback pour « essayer ce qui marche ». LTX minimal : une vidéo Fast 720p de 6 s si son coût actuel est approuvé. RunPod : contrat exact du worker d'abord. Suno : un taskId, polling/reprise, crédit avant/après. ElevenLabs : authentification valide avant toute synthèse. Shotstack : stage d'abord selon conditions du compte ; aucun rendu déclenché ici.

## Actions minimales du propriétaire / défauts transmis

1. **Salad** : remettre une valeur littérale existante autorisée pour `SALAD_API_KEY` et renseigner `SALAD_ORGANIZATION_NAME` / `SALAD_PROJECT_NAME` depuis le [portail officiel](https://portal.salad.com/). Aucune nouvelle clé créée. [Portées et lectures de préflight officielles](https://docs.salad.com/agents/container-engine/discover-scope-and-preflight).
2. **Pexels** : corriger uniquement la représentation locale de `PEXELS_API_KEY` depuis la [page officielle des clés](https://www.pexels.com/api/key/) ; aucun préfixe/commande ajouté à sa valeur. Refaire alors un seul GET catalogue.
3. **ElevenLabs** : vérifier que `ELEVENLABS_API_KEY` appartient au bon workspace, est active et autorise la lecture des voix ; remettre une clé existante valide via la [gestion officielle des clés](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys). Le diagnostic actuel est `invalid_api_key`, pas un manque de crédits démontré.
4. **Optionnel** : renseigner une clé existante `PIXABAY_API_KEY` ([documentation](https://pixabay.com/api/docs/)) et `COVERR_API_KEY` ([authentification](https://api.coverr.co/docs/auth/)) uniquement pour utiliser ces sources. T01 doit aligner `src/lib/env.ts:117` avec l'authentification Coverr ; aucun changement parallèle T04.
5. **T01/T03** : examiner l'ancien preview Pollinations (`src/lib/storyboard.ts:47` / production thumbnail) au regard des [docs actuelles](https://gen.pollinations.ai/docs). La disponibilité de l'ancien service est NON TESTÉE ; ne pas remplacer l'URL par une génération authentifiée facturable sans décision explicite. T01/T07 : vérifier le suivi du téléchargement Unsplash dans le consommateur, hors adaptateur.
6. **T01** : intégrer le delta local après revue, confirmer le nouveau SHA, conserver les blocages externes. Ne pas qualifier la compatibilité WanGP/GPU ni les générations sans le protocole autorisé ci-dessus.

Autres références officielles consultées : [RunPod submit/status/cancel](https://docs.runpod.io/serverless/endpoints/send-requests), [Shotstack](https://shotstack.io/docs/api/), [SunoAPI generate](https://docs.sunoapi.org/suno-api/generate-music), [Pexels](https://www.pexels.com/api/documentation/), [ElevenLabs auth](https://elevenlabs.io/docs/api-reference/authentication), [Unsplash](https://unsplash.com/documentation), [Coverr vidéos](https://coverr.co/api/docs/videos).
