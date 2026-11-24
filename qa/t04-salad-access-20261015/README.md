# T04 — accès Salad et clôture fournisseurs, 15 octobre 2026

Base intégrée T01 vérifiée : `56754679abed9aa1e51323c29aed5bef38bc17d0`, reçu documentaire du candidat produit `d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2`. Branche `codex/sutra-t04-salad-access-20261015`. Réservation `SUTRA-T04-20261015:SALAD-ACCESS` dans les deux LOCKS. Aucun fichier produit, pipeline, UI, OAuth, Shotstack, SQL ou configuration de production modifié.

## Résultat exact

**PASS local : 27 tests nouveaux, lint et syntaxe ciblés. BLOQUÉ externe : saisie Salad valide et noms techniques d'organisation/projet. NON TESTÉ : authentification Salad réelle, image construite, CUDA/VRAM, génération, réplication/interruption réelle et facturation.** Aucun appel fournisseur authentifié, aucune modification du master et aucune génération pendant cette reprise. Aucune garantie absolue de fonctionnement.

`master-metadata.json`, observation du 15 octobre à 13:19:49 UTC : master privé `0600`, régulier, propriétaire courant, sans hardlink ; `SALAD_API_KEY` présente mais syntaxe littérale refusée (espaces, guillemets et syntaxe shell détectés). `SALAD_ORGANIZATION` et `SALAD_PROJECT` absentes. Aucune valeur imprimée, évaluée, envoyée à une API ni copiée dans `.env.local`. Le contrôle de syntaxe ne démontre pas à lui seul la validité de la clé.

L'outil d'interface a refusé l'accès à Terminal (`Computer Use is not allowed to use app com.apple.Terminal for safety reasons`), et aucun navigateur n'était disponible. Aucun contournement via AppleScript ou autre interface. Le lanceur ci-dessous attend donc une exécution **par Matiss dans son Terminal**, avec `getpass` sans écho. Aucune saisie terminée ni preuve `live-status.json` reçue à la clôture.

## Saisie et validation gratuite prêtes

```sh
/Users/matissdornier/purama-worktrees/sutra-t04-salad-access-20261015/qa/t04-salad-access-20261015/Saisie-Salad.command
```

Dans [le portail Salad](https://portal.salad.com), menu du compte → **API Access → Current API Key** ; ne pas utiliser une clé AI Gateway ni copier le nom de la variable, une commande, des guillemets ou un préfixe d'en-tête. Le script demande aussi les noms techniques de l'organisation et du projet (ceux utilisés dans les chemins API). Ne jamais coller ces saisies dans le chat. La [documentation officielle de découverte du scope](https://docs.salad.com/agents/container-engine/discover-scope-and-preflight) dit explicitement que l'API publique ne liste pas les organisations/projets : le portail ou un opérateur autorisé doit fournir ces deux noms. Aucun endpoint deviné.

`secure_setup.py` refuse les entrées ambiguës, doublons, valeurs multilignes, fichiers/symlinks/hardlinks non sûrs et TTY sans masquage. Il réutilise le lecteur existant `../t04-final-providers-20261015/salad-read.mjs` via `validate-access.mjs` :

1. `GET https://api.salad.com/api/public/organizations/{organization}/quotas` avec `Salad-Api-Key` ; schéma quota/réplicas obligatoire.
2. Uniquement après succès, `GET …/projects/{project}/containers` ; schéma de liste obligatoire. Le corps peut contenir des variables de conteneur : il n'est jamais journalisé. Seuls le statut HTTP et des métadonnées expurgées sont conservés.

Chaque GET est borné à 15 s, corps compris, et 1 MiB ; redirections refusées, zéro retry. Le processus complet a un délai de 40 s. Clé et identifiants passent uniquement par stdin privé, jamais par argv ni variables d'environnement du processus enfant. Aucun POST, provisioning ou génération. Voir [authentification Salad](https://docs.salad.com/reference/api-usage).

Les deux contrats HTTP doivent être validés avant la sauvegarde atomique des **seuls** `SALAD_API_KEY`, `SALAD_ORGANIZATION`, `SALAD_PROJECT` dans `~/.env.purama.master`, permissions `0600`. Les autres octets sont conservés. Verrou coopératif et double comparaison du contenu/inode : modification concurrente observée → abandon. Les écrivains externes doivent respecter ce verrou ; aucun système de fichiers ne fournit ici un CAS atomique contre un écrivain non coopératif entre le dernier contrôle et le renommage. Aucun changement d'activation Salad.

`live-status.json` est ignoré par Git, privé et expurgé. `401/403` = authentification **ou** permissions non prouvées ; `404` = scope absent **ou** non visible ; `429` = limitation ; HTTP200 avec schéma faux = FAIL contrat. Ne pas annoncer « clé invalide » sur un simple refus de permission. Une lecture d'organisation/projet réussie ne prouve ni crédits disponibles, ni droit de créer un groupe, ni génération réussie.

## Contrats existants vérifiés, sans réimplémentation

Les sources officielles ci-dessous ont été relues le 15 octobre. Les contrats produit, dépendances et preuves d'auteur sont comparés dans `reuse.json` : **89/90 fichiers identiques** au lot T04 `6ba23d4c31e4a511997b260ecb49e71ace293b2e`. Le seul changement est `scripts/test-t04-provider-fixes.mts`, fixture Suno stabilisée par T01 ; fichier réservé à T01, non modifié ici. Sa CI exacte `38677062190` a déjà validé le candidat d21b7b4. Aucun build/gate global inchangé rejoué.

| Fournisseur | Contrat actuel et borne | Preuve / statut |
| --- | --- | --- |
| LTX | V2 asynchrone, modèles 2.3 explicitement autorisés : soumission202/id, GET du même endpoint/id, pending/processing/completed/failed ; polling ≥5s. T2V, I2V `image_uri` et `last_frame_uri`, retake/extend selon modèle/limites. V2V arbitraire et multi-références non annoncés. Webhook/annulation distante non documentés : capacités désactivées. | **PASS contrat statique et preuves intégrées réutilisées** ; auth/crédits/génération **NON TESTÉS**. Pas de bascule implicite vers 2.5. Reprise GET seulement après ACK ; résultat payant incertain sans ID exige réconciliation. |
| RunPod | Endpoint configuré `/v2/{endpoint}/health`, POST `/run`, GET `/status/{id}`. ID strict et stable, états/output validés, délai soumission30s/poll15s/fenêtre5min. `/cancel/{id}` existe officiellement mais l'adaptateur n'expose pas d'annulation distante : ne pas l'annoncer. Contrat `input` dépend du worker, à qualifier séparément. | **PASS contrat/local réutilisé**. Health200 le 14 octobre à13:58UTC, zéro worker prêt dans ce reçu. Aucune API d'administration testée pour juger la clé limitée. Crédits et génération **NON TESTÉS**. |
| Shotstack | Bases Edit API `stage` et `v1`, clés distinctes, GET `/templates` gratuit, POST `/render` unique puis GET `/render/{id}` ; pas de repli sur une autre clé. | **PASS contrat/local réutilisé** ; stage/templates200 et v1/templates200 dans le même reçu daté du14octobre. Aucun rendu ni annulation réelle testés. Produit T05/T01 inchangé. |
| Suno | Fournisseur tiers **SunoAPI**, origine `api.sunoapi.org/api/v1`, `SUNO_API_BASE_URL` prioritaire sur alias `SUNO_BASE_URL`. POST `/generate` V6/custom, réponse code200/data.taskId puis GET `/generate/record-info?taskId=…`, validation ID/statut/audioHTTPS. Callback HTTPS admis ; aucun succès fondé sur le callback seul. | **PASS contrat/local réutilisé** ; GET crédits200/code200/solde positif le14octobre13:58UTC, aucune musique générée. API SunoAPI distincte de Suno officiel. HTTP429 = limite transport ; code métier429 = crédits insuffisants. Timeout/reprise conservent l'ID, aucun POST réessayé. |
| Salad | API de gestion authentifiée séparée du worker/Gateway. GET quotas + groupes préparés, host/bridge existants réutilisés, désactivé par défaut. | **BLOQUÉ saisie/scope** ; 27 tests nouveaux **PASS**. Auth réelle, état de groupe, GPU, image et coûts réels **NON TESTÉS**. |

Sources : [LTX jobs](https://docs.ltx.io/async-jobs), [LTX 2.3](https://docs.ltx.io/models/ltx-2-3), [I2V](https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-image-to-video), [retake](https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-retake), [extend](https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-extend), [tarification LTX](https://docs.ltx.io/pricing), [RunPod run/status/cancel/health](https://docs.runpod.io/serverless/endpoints/send-requests), [Shotstack API](https://shotstack.io/docs/api/), [clés stage/production](https://shotstack.io/docs/guide/getting-started/request-api-keys/), [SunoAPI génération](https://docs.sunoapi.org/suno-api/generate-music), [SunoAPI statut](https://docs.sunoapi.org/suno-api/get-music-generation-details).

Le reçu réseau historique exact est `qa/t04-provider-validation-20261014/live.json`, horodaté `2026-10-14T13:58:12.735Z` : ces lectures ne sont **pas** de nouveaux tests d'accès. LTX conserve coût estimé USD et coût réel inconnu ; retake facturé sur durée d'entrée, extend sur extension selon tarif documenté. Réservation de crédits et facture ne sont pas interchangeables. Jobs LTX conservés au plus24h, potentiellement moins ; résultat RunPod async conservé30min selon la documentation, distinct de la TTL d'exécution. Un GET404 après rétention ne démontre ni absence d'exécution ni gratuité et n'autorise pas un nouveau POST. Quotas et statut distant restent inconnus s'ils ne sont pas attestés.

## Image existante et premier essai restant

La recette reproductible intégrée est `src/lib/salad/container/Dockerfile`, avec contexte de18fichiers allowlist/SHA, bases Linux/amd64 par digest, Node24.21.0, Python3.12.12, ComfyUI0.40.0 commit épinglé et103 dépendances Python verrouillées ; PyTorch2.13.0/CUDA13.0. Voir le dossier `qa/t04-final-providers-20261015/` pour les audits et preuves. **Recette préparée, image NON CONSTRUITE** : pas de Docker/Podman local, aucun digest final ni import CUDA exécuté. Les paragraphes historiques pré-emballage qui disent « pas de Dockerfile » ne décrivent plus cet état intégré ; ils ne doivent pas faire supprimer/recréer la recette.

Modèle déclaré : `ltxv-13b-0.9.8-distilled-fp8`, encodeur `t5xxl_ltxv_official.safetensors`, VAE intégré au checkpoint, T2V seulement. Ce n'est pas LTX V2 API. Nœuds/interfaces ComfyUI contrôlés statiquement, aucune carte/VRAM qualifiée. Ni RTX3090 24Go ni prix historique0,09USD/h ne constituent une qualification ou un devis.

Le protocole minimal à autoriser à T01 est :

1. Terminer la saisie gratuite et les deux GET ci-dessus. Choisir ensuite explicitement un groupe existant ou autoriser sa création ; ne rien créer pour découvrir les scopes.
2. Sur un builder Linux autorisé, construire le **contexte allowlist existant**, vérifier installation/imports, image finale/digest, licences et SHA des deux poids officiels. Aucun téléchargement de poids sur Mac ; aucune publication de registre implicite. [ComfyUI](https://github.com/Comfy-Org/ComfyUI/releases/tag/v0.40.0), [poids Lightricks](https://github.com/Lightricks/LTX-Video).
3. Approuver un budget total daté incluant cold start/attente/stockage/traffic et une classe disponible, pilote compatible et VRAM mesurée. Une réplique, autoscaling désactivé ; PostgreSQL externe/TLS, rôle dédié, reçu image indépendant, Gateway protégé et token worker distinct préparés par T01. Le catalogue GPU Salad seul ne démontre pas la VRAM nécessaire.
4. Autoriser séparément le premier calcul de qualification du workflow canonique sur le GPU choisi : profil explicite, dimensions multiples32 et frames8k+1, durée≤60s ; mesurer CUDA/GPU/VRAM, temps, SHA des médias et contrôle ffprobe. Ce calcul n'est pas une qualification simulée. Produire le manifeste réel pour ce seul profil ; un minuscule profil technique ne qualifie pas le routage720p/1080p.
5. Après qualification, autoriser **un seul job HTTP du worker** sur ce profil : health/capabilities auth correcte et refus sans token, intention durable puis un POST, reprise uniquement GET, identité/artefact/SHA/provenance et coût estimé/réel séparés. Ces étapes4et5 sont deux calculs facturables distincts, pas une promesse de tout prouver en une génération. Stopper la ressource selon la procédure autorisée. Un timeout applicatif ne stoppe pas la facturation distante.

L'essai minimal ne qualifie pas OOM, réplication, SIGKILL/éviction ou redémarrage réels : contrôles additionnels avec budget explicite. Le worker garde le slot durable en cas d'interruption, sans libération TTL, nouvelle soumission ni moteur de secours ; un SIGTERM permet un drain borné, sans garantie de grâce du fournisseur. Voir [protocole existant](../t04-final-providers-20261015/README.md) et [Salad Developers](https://salad.com/developers/).

Noms **observés manquants** : `SALAD_ORGANIZATION`, `SALAD_PROJECT`. Nom **présent mais à remplacer** : `SALAD_API_KEY`. Aucun autre secret relu dans cette reprise. Noms **à renseigner ou vérifier par T01 avant activation**, sans prétendre à leur absence actuelle : `SALAD_ENABLED`, `SALAD_GATEWAY_URL`, `SALAD_WORKER_TOKEN`, `SALAD_QUALIFICATION_JSON`, `SALAD_QUOTE_JSON`, `SALAD_REQUEST_TIMEOUT_MS`, `SALAD_GENERATION_TIMEOUT_MS`, `SALAD_MAX_ESTIMATED_COMPUTE_USD`, `SALAD_WORKER_DATABASE_URL`, `SALAD_DEPLOYMENT_RECEIPT_PATH`, `SALAD_COMFY_URL`, `SALAD_BRIDGE_URL`, `SALAD_WORKER_PORT`. `SALAD_CONTAINER_GROUP` est un identifiant d'exploitation/audit optionnel, pas un substitut à la qualification du runtime.

## Reproductions, tests et limites d'analyse

Deux défauts du **nouveau brouillon d'outil de saisie**, pas des adaptateurs intégrés : remplacement de la première ligne d'une valeur multiligne ; preuve HTTP perdue quand la sortie finale BLOQUÉ écrasait le reçu. Rouge conservé dans `python-red.txt`, puis garde des limites de ligne et reçu cumulatif. Le rouge porte sur deux méthodes de test (plusieurs sous-assertions), pas quatre défauts produit.

Commandes exécutées hors réseau fournisseur :

```sh
/usr/bin/python3 -m unittest discover -s qa/t04-salad-access-20261015 -p test_secure_setup.py -v
node --test qa/t04-salad-access-20261015/validate-access.test.mjs
node node_modules/eslint/bin/eslint.js qa/t04-salad-access-20261015/validate-access.mjs qa/t04-salad-access-20261015/validate-access.test.mjs
/bin/sh -n qa/t04-salad-access-20261015/Saisie-Salad.command
node --check qa/t04-salad-access-20261015/validate-access.mjs
node --check qa/t04-salad-access-20261015/validate-access.test.mjs
```

21Python +6Node **PASS /0FAIL /0SKIP**. Couverture : vrai pseudo-terminal avec ECHO désactivé, erreur/annulation/timeouts, HTTP401/403/404/429/500, corps/schéma invalides, aucune requête sans scope, aucun retry/POST, validation deux scopes avant écriture, sortie expurgée, conservation du master, concurrence/inode/lock, permissions/liens, atomicité, nettoyage du seul temporaire propre. Reçus `python-tests.txt`, `node-tests.txt`, `checks.json` ; aucune fixture n'est une preuve GPU. Analyse GitNexus ciblée avant les deux corrections : LOW, jusqu'à4appelants directs du seul nouvel outil. Index partiel (troncatures, liens manquants) : ni exhaustivité ni certification de release. Détections finales staged/compare conservées, comparaison main contenant également l'historique intégré.

TypeScript/build/gates globaux réutilisés du candidat T01 inchangé, sans nouveau TypeScript produit. Les955contrats/1022legacy de sa CI ne sont pas additionnés aux27tests de cette reprise. Scan secrets expurgé et diff-check consignés séparément. Intégration T01 et acceptation indépendante restent distinctes du commit local.

Détection finale : staged LOW (29 fichiers/86 symboles avant ajout des seuls reçus), zéro flux affecté signalé ; compare/main CRITICAL sur3494fichiers/9422symboles/228flux de l'historique, liste plafonnée. Ce verdict historique ne qualifie pas le delta T04 et n'est pas ignoré : aucune promotion ni certification globale sur cette base. Revue du diff exact : seulement outil/tests/preuves et append documentaire.

Contrôle final initial : deux empreintes de fichiers dans `proof.json` signalées à tort comme clés génériques, recomputées et identiques aux sources ; format remplacé par paires explicites `path`/`sha256`, aucune règle de scan ignorée. Deux lignes vides finales de logs normalisées. Diagnostics expurgés conservés dans `staged-scan-red.json` et `diff-check-red.txt`, distincts des deux défauts du brouillon.
