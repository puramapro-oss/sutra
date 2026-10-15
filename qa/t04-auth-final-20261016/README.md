# T04 — clôture fournisseurs sur candidat T01, 16 octobre 2026

Base confirmée deux fois en lecture locale : **f36013ae8b3bd7d9a702f7aebfdff1ac430c05f5**, branche T01 `codex/sutra-final-providers-20261013`. Travail isolé : `codex/sutra-t04-auth-final-20261016`. Réservations canoniques `SUTRA-T04-20261016:AUTH-FINAL-F360` et `AUTH-FINAL-DOC`. Aucun adaptateur recréé, aucun fichier d'un autre propriétaire modifié. Corrections T04 précédentes `6d7d75a60087933f30027189c678f62031ed7ec5` déjà intégrées ; annulation du corps Shotstack et refus du fallback stock payant corrigés par T01, avec contre-tests verts dans sa CI exacte.

## Verdict T01 / T08

Lectures du master effectuées le **2026-10-15 à 22:25:29 UTC** (16 octobre, 00:25 Paris). `free-reads.json` contient uniquement des métadonnées : **5 GET, zéro mutation, zéro retry, zéro génération**. L'heure du reçu, le SHA et les empreintes de sources délimitent cette preuve ; ce n'est pas une validation perpétuelle d'un compte.

| Fournisseur | Contrats hors ligne sur la base exacte | Authentification / configuration courante | Non testé / blocage restant |
| --- | --- | --- | --- |
| Salad | PASS réutilisé : client/worker/bridge/journal, alias `_NAME`, schémas, erreurs, timeouts, interruption et absence de double POST | **BLOQUÉ local**, aucun HTTP : `SALAD_API_KEY` malformée même après dotenv ; `SALAD_ORGANIZATION_NAME` et `SALAD_PROJECT_NAME` absentes ; anciens alias également absents | Authentification, quotas, accès organisation/projet/groupe, image construite, GPU/VRAM, cold-start et redémarrage réels NON TESTÉS |
| Pexels | PASS réutilisé : URLs/header, erreurs explicites, schémas, timeout du corps, provenance ; aucune erreur convertie en liste vide | **BLOQUÉ local**, aucun HTTP : `PEXELS_API_KEY` malformée après dotenv | Validité de compte et recherches réelles NON TESTÉES ; aucun refus distant inventé |
| ElevenLabs | PASS réutilisé : clone/list/audio, schémas, deadline, redirections et absence de retry POST | **BLOQUÉ externe : HTTP 401, code fournisseur `invalid_api_key`** via le vrai adaptateur `listVoices`, GET officiel et en-tête `xi-api-key` vérifiés | Clé refusée. Ce reçu ne dit pas si elle a été révoquée, appartient à un autre compte ou a été mal copiée. Crédits, TTS et clone NON TESTÉS |
| Shotstack stage | PASS réutilisé ; annulation GET-corps et ID tardif désormais verts | **PASS HTTP 200** `GET /edit/stage/templates`, schéma vérifié | Rendu, upload et facturation NON TESTÉS |
| Shotstack production | PASS réutilisé | **PASS HTTP 200** `GET /edit/v1/templates`, clé production séparée | Aucun rendu production ; crédits et génération NON TESTÉS |
| RunPod | PASS réutilisé : submit/status, ID, erreurs, reprise et blocage d'une soumission incertaine | **PASS HTTP 200** `GET /v2/{endpoint}/health` de l'endpoint configuré ; zéro worker prêt observé | Aucune API d'administration utilisée. Droit d'exécuter, crédits et GPU NON TESTÉS ; `/cancel/{id}` documenté mais non exposé par l'adaptateur WAN actuel |
| SunoAPI | PASS réutilisé : V6, corps custom, taskId, polling, reprise, erreurs et absence de retry/fallback payant | **PASS HTTP 200** `GET /api/v1/generate/credit`, schéma et disponibilité de crédit confirmés sans montant publié | Fournisseur tiers **SunoAPI**, distinct de Suno. Création, callback réel, musique et facturation NON TESTÉS |
| LTX V2 | PASS réutilisé : contrats T2V/I2V/V2V spécifiques, jobs, CAS, polling, reprise, coût estimé, corps annulable | **NON TESTÉ** : aucun endpoint gratuit de compte documenté ni ID de job existant utilisé ; présence de clé seule sans valeur probante | Génération/facturation NON TESTÉES. Webhook signé et annulation distante non documentés par le contrat utilisé : explicitement indisponibles |

**FAIL connu de l'intégration, hors adaptateurs :** CI T01 `38809803219`, navigateur Chromium private-download et WebKit social-reload. T01 les reprend dans son harnais. Ne pas déclarer la gate globale verte ; contrats et PostgreSQL restent PASS. Aucun déploiement, fusion, push, migration ni connexion OVH dans ce lot.

## Défauts corrigés et diagnostic reproductible

- **Notice Salad périmée corrigée** : elle affirmait l'absence de Dockerfile, de packaging `tsx` en production et d'épinglage ComfyUI malgré leur livraison. Elle décrit maintenant le Dockerfile, son manifeste dédié et le superviseur existants, tout en laissant construction, digest final et qualification GPU NON TESTÉS. La phrase historique sur les secrets a été remplacée par le périmètre exact des audits autorisés.
- **Cause ElevenLabs déterminée** : le précédent reçu HTTP 401 ne distinguait pas clé/droits. Le diagnostic utilise le vrai adaptateur ; son garde vérifie URL, méthode GET unique, redirection refusée et égalité de l'en-tête avec la valeur privée en mémoire. Seul le code fournisseur allowlisté est conservé, jamais son message. Le serveur renvoie `invalid_api_key`, et non `missing_permissions`. Le transport documenté est correct : aucune correction arbitraire de l'adaptateur ne peut rendre cette clé acceptée.
- **Faux diagnostic de guillemets exclus** : les tests acceptent des clés littérales, entourées de guillemets simples ou doubles au format dotenv. Le contenu Salad/Pexels reste inadmissible après parsing ; il ne s'agit pas d'un simple emballage `.env` valide. Aucun shell, interpolation ou extraction hasardeuse d'une sous-chaîne n'a été exécuté. Les regex sont des garde-fous de transport local, pas une prétendue spécification exhaustive des clés fournisseurs.
- **Noms Salad vérifiés** : `_NAME` fonctionne déjà dans le lecteur existant, avec anciens alias et rejet des contradictions avant HTTP. Aucune variable produit à renommer. Le runtime utilise le Gateway et le token worker ; les noms organisation/projet concernent la lecture de gestion du compte.

Le lot ne modifie aucune fonction produit : les corrections d'adaptateurs nécessaires étaient déjà intégrées. Il ajoute la preuve gratuite et les tests de diagnostic manquants, et corrige la documentation contradictoire.

## Contrats officiels revérifiés

- **LTX** : POST `/v2/{endpoint}` → 202/id ; GET même endpoint/id, états pending/processing/completed/failed. Intervalle minimal 5 s avec jitter ; reprise GET seulement, intention et résultat incertain persistés avant toute possibilité de nouvelle soumission. La rétention peut être inférieure à 24 h et les URLs média expirent séparément. Annuler l'attente locale ne stoppe pas la facturation distante. [Jobs](https://docs.ltx.io/async-jobs), [erreurs](https://docs.ltx.io/errors), [quotas](https://docs.ltx.io/rate-limits).
- **Capacités LTX** : modèles 2.3 toujours documentés et conservés ; V2 désigne le protocole, pas une migration automatique vers le modèle 2.5. T2V, I2V première/dernière image, retake, extend et V2V HDR/reframe selon schémas existants. Références multiples et V2V arbitraire non promis. Durées/FPS/résolutions sont validées localement ; formats média et dimensions restent bornés. [Modèles 2.3](https://docs.ltx.io/models/ltx-2-3), [formats](https://docs.ltx.io/input-formats).
- **Coût LTX** : grille officielle 2.3 par seconde/résolution cohérente avec le code, estimation avec source/date ; coût réel `null/not_reported`, jamais présenté comme facture. Pas de POST rejoué après timeout/réponse incertaine. [Tarification](https://docs.ltx.io/pricing).
- **RunPod** : `/run`, `/status/{id}`, `/health`, `/cancel/{id}` dans l'API endpoint. L'adaptateur existant utilise les trois premiers ; une lecture health réussie n'atteste ni l'autorisation d'exécution ni une facture. Le `input` WAN dépend du worker effectivement déployé, non qualifié par health. [Requêtes endpoint](https://docs.runpod.io/serverless/endpoints/send-requests).
- **Shotstack** : `/edit/stage` et `/edit/v1`, `x-api-key`, GET templates sans rendu. `SHOTSTACK_ENV` absent conserve le défaut stage de l'application, ce n'est pas une clé manquante. ID de rendu durable et reprise GET ; résultat `outputVerified:false` jusqu'au contrôle média. [API officielle](https://shotstack.io/docs/api/).
- **SunoAPI** : URL configurée compatible `https://api.sunoapi.org/api/v1`, priorité `SUNO_API_BASE_URL` puis `SUNO_BASE_URL` conformément au code. Bearer, POST generate custom/V6, style ≤1000, lyrics ≤5000, durée 10–360 ; titre optionnel. `taskId` avant GET record-info ; seul SUCCESS final donne un résultat exploitable, callbacks non utilisés comme preuve seuls. Annulation locale uniquement. [Contrat du fournisseur tiers](https://docs.sunoapi.org/suno-api/generate-music).
- **ElevenLabs/Pexels** : GET `/v1/voices` avec `xi-api-key`, recherches vidéo `/v1/videos/search` et image `/v1/search` avec Authorization sans préfixe Bearer. Deadlines jusqu'au corps, schémas et HTTPS/provenance ; aucune erreur transformée en succès ou fallback. [Authentification ElevenLabs](https://elevenlabs.io/docs/api-reference/authentication), [API Pexels](https://www.pexels.com/api/documentation/).
- **Salad** : `Salad-Api-Key`, GET quotas de l'organisation puis container groups du projet ; 401/403 arrêtent, 404 peut être un scope inconnu. L'API publique ne permet pas de découvrir les organisations/projets accessibles : noms à obtenir du portail ou d'un reçu de déploiement fiable. [Préflight officiel](https://docs.salad.com/agents/container-engine/discover-scope-and-preflight), [Gateway](https://docs.salad.com/container-engine/how-to-guides/gateway/sending-requests).

## Tests exacts et réutilisation

Toutes les commandes locales depuis ce worktree, sans génération ni secrets dans les tests :

| Commande | Résultat / preuve |
| --- | --- |
| `node --require ./qa/t08/offline.cjs --test qa/t04-auth-final-20261016/diagnostic.test.mjs` | **15 PASS, 0 FAIL, 0 SKIP**, `diagnostic-tests.txt` ; réseau bloqué |
| `node node_modules/typescript/bin/tsc --noEmit -p qa/t04-auth-final-20261016/tsconfig.json` | **PASS**, `typecheck.txt`, exit 0 |
| `node node_modules/eslint/bin/eslint.js qa/t04-auth-final-20261016/diagnostic.mjs qa/t04-auth-final-20261016/diagnostic.test.mjs qa/t04-auth-final-20261016/read.mts` | **PASS**, `lint.txt`, exit 0 |
| `python3 qa/t04-auth-final-20261016/reuse.py` | **PASS**, 1042 fichiers code/contrats/config/dépendances identiques aux blobs f36013a ; SHA-256 du log CI vérifié |
| `python3 qa/t04-auth-final-20261016/read.py --authorized-free-reads` | Exécuté **une seule fois** ; 5 GET et verdicts détaillés ci-dessus ; ne pas rejouer sans delta de configuration |

Node utilisé pour les lectures et contrôles TypeScript/lint : `/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node`. L'ancien script de preuve n'a pas été réexécuté/écrasé. AST Python vérifié sans import/exécution réseau.

`ci-reuse.json` relie le log déjà téléchargé par T01 à **1199 PASS / 0 FAIL / 7 SKIP** sur f36013a, dont 155 assertions nommant les fournisseurs. Ces compteurs se recouvrent et ne s'ajoutent pas aux anciens rapports. Les 15 nouveaux tests restent un lot distinct. Aucune gate globale/build déjà prouvée rejouée. Le build global de la base est une preuve T01, pas une nouvelle mesure T04.

GitNexus : index isolé 24059 nœuds/47591 liens/499 flux, tronqué (1336 candidats écartés, 798 callees tronqués, 43 limites de parcours). **UNKNOWN pour exhaustivité** ; revue du diff réservé et comparaison de blobs complètent la preuve. Aucun symbole produit édité, donc aucune propagation produit nouvelle revendiquée. Détection staged : 20 fichiers, 9 symboles de sections documentaires, 0 flux affecté détecté, risque low. Comparaison avec main : 4753 fichiers, 11295 symboles, 402 flux, risque critical, liste tronquée ; avertissement utilisateur donné. Elle inclut l'historique et ne délimite pas ce lot. Les deux rapports sont conservés avant commit, sans revendication de certification exhaustive.

Sécurité : `gitleaks stdin --redact=100` sur le diff préparé, **PASS, zéro finding**, rapport et empreinte de périmètre dans `security.json`. `git diff --check` PASS. Les sorties du scanner lui-même sont exclues de son empreinte finale pour éviter l'autoréférence ; aucun scan historique complet revendiqué.

## Source des variables et actions humaines minimales

Source unique `~/.env.purama.master`, fichier privé contrôlé (type, owner, permissions), lecture limitée aux champs utiles, passage par stdin privé à un processus sans environnement secret hérité. Aucun affichage de valeur, hash de clé, corps fournisseur, URL de compte, copie `.env.local` ou modification du master. `free-reads.json` donne présence et provenance par NOM. `format-metadata.json` est le contrôle lexical initial, complété par le parsing dotenv dans le reçu final.

1. **Salad** — renseigner la clé littérale correcte `SALAD_API_KEY` et les slugs `SALAD_ORGANIZATION_NAME`, `SALAD_PROJECT_NAME` dans le master via saisie privée depuis le [portail Salad](https://portal.salad.com/). Aucun besoin de créer ou démarrer un groupe pour prouver ces lectures gratuites. Le nom de groupe n'est à choisir qu'avant une activation autorisée.
2. **Pexels** — remplacer la saisie malformée `PEXELS_API_KEY` par la clé API littérale de la [page officielle](https://www.pexels.com/api/key/).
3. **ElevenLabs** — vérifier/remplacer `ELEVENLABS_API_KEY` par une clé API active du bon espace, autorisant la lecture des voix, dans la [gestion officielle des clés](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys). La réponse observée exige d'abord de résoudre `invalid_api_key`, pas d'acheter des crédits.

Après ces seules corrections privées, autoriser/rejouer uniquement les GET affectés. Aucun besoin de relancer RunPod/Shotstack/Suno sans nouveau risque ou changement de configuration. Aucun achat demandé pour corriger ces blocages.

## Avant le plus petit essai réel

Salad reste désactivé. La recette contient Node/Python par digest, ComfyUI par commit, dépendances Python hashées et Torch CUDA, non-root, poids offline, une chaîne host → bridge canonique → ComfyUI. Ces éléments ont une preuve statique, pas une preuve de build ou de GPU. Le modèle déclaré reste `ltxv-13b-0.9.8-distilled-fp8` T2V sans audio, différent du modèle LTX API. Aucun GPU ni volume de VRAM déclaré compatible sans exécution.

T01 doit obtenir les accès gratuits valides, préparer le journal PostgreSQL/TLS et le stockage d'artefacts, construire l'image Linux avec licences/poids hashés et relever le digest final. Variables d'activation décrites dans `src/lib/salad/container/README.md` : Gateway, token worker distinct, reçu d'image, qualification et devis. Elles ne sont pas déclarées absentes ici : aucune lecture inutile de ces secrets n'a été faite.

Un essai GPU exige ensuite une autorisation budget/ressource explicite couvrant démarrage, idle, stockage et réseau : une réplique, une tâche courte d'un profil admis, aucun audio/upscale/fallback, intention durable unique, mesures image/GPU/VRAM/CUDA et SHA média, reçu réel de coût puis arrêt contrôlé par T01. Le tarif historique RTX3090 0,09 USD/h ne garantit aucun prix actuel. Timeout ou interruption ne justifient jamais une seconde soumission ; reprise du même ID et réconciliation de l'exécutant. Éviction/redémarrage et tous essais payants restent **NON TESTÉS / NON AUTORISÉS** dans ce lot.
