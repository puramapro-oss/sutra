# SUTRA T04 — fournisseurs et GPU distant, 15 octobre 2026

## Périmètre et preuve

Base T01 confirmée : `49c166d4c15412d2a3c1246c216cf0df319f2df0`, reçus du candidat applicatif `3855665fa79e3cc2171124d864a834214d6ac617`. Branche isolée `codex/sutra-t04-final-providers-20261015`. Réservation `SUTRA-T04-20261015:FINAL-PROVIDERS-GPU`. Aucun adaptateur existant, pipeline, SQL, Shotstack, OAuth, UI, configuration distante ou WIP tiers modifié. T01 conserve intégration et exploitation.

Ce lot livre une recette de conteneur désactivée et un emballage de processus autour du worker, du bridge et du journal existants. **Ce n’est pas une image construite ni une qualification GPU.** Docker/Podman sont absents du Mac ; aucune installation GPU, aucun poids téléchargé, aucun moteur exécuté. Le graphe GitNexus reste partiel ; ses limites sont conservées dans les preuves.

## Résultats par fournisseur

| Fournisseur | PASS établi | BLOQUÉ / NON TESTÉ |
| --- | --- | --- |
| LTX V2 | Contrats locaux intégrés inchangés ; endpoints/capacités/tarifs revus dans les documents officiels | Authentification, crédits, soumission et facture réelles **NON TESTÉS** ; aucun endpoint gratuit de compte documenté ni ID existant fourni |
| RunPod | Lecture limitée `/health` du **14 octobre 13:58:12.735Z** : HTTP200, schéma valide, zéro worker prêt | Droit POST, worker installé, crédits, génération et annulation réels **NON TESTÉS** ; aucun accès admin requis pour cette preuve |
| Shotstack stage / v1 | GET templates du même reçu : HTTP200 pour les deux environnements | Rendu, crédits et facture **NON TESTÉS** ; adaptateur T05/T01 conservé |
| SunoAPI | GET crédit du même reçu : HTTP200/code200, crédit positif à cette date ; contrat asynchrone local inchangé | Aucun nouveau crédit interrogé ; génération **NON TESTÉE**. Service tiers SunoAPI, distinct d’une API officielle Suno |
| Salad | 30 tests locaux du nouvel emballage/lecteur ; contrats du worker existant réutilisés ; dépendances verrouillées et auditées | Lecture distante **BLOQUÉE** par syntaxe du master et scope absent ; authentification/crédits/image/GPU/réplication réelle **NON TESTÉS** |

Les quatre lectures du 14 octobre sont dans `../t04-provider-validation-20261014/live.json` : réutilisation explicitement datée, pas de nouvelle preuve d’authentification aujourd’hui. Les 36 empreintes d’entrée des 91 tests fournisseurs/worker antérieurs sont identiques (`reuse.json`). Pas de répétition de leurs suites, ni de la CI globale T01. Les présents tests ne s’ajoutent pas artificiellement aux comptages de cette CI.

## Contrats officiels revus, limites conservées

### LTX V2

`src/lib/ltx-v2.ts` / `ltx-v2-contract.ts` : POST unique `https://api.ltx.io/v2/{endpoint}`, Bearer serveur, réponse202 avec `id` et `created_at`, puis GET du même job. États `pending`, `processing`, `completed`, `failed`; résultat téléchargé avant expiration. Les résultats terminaux peuvent être supprimés sous24h ; URL média et statut ont des expirations distinctes. Polling à partir de5s, temporisation/jitter et Retry-After ; POST30s, lecture bornée. Intention durable avant POST ; perte d’ACK = résultat incertain, reprise GET uniquement, jamais nouvelle dépense automatique.

Texte→vidéo, image→vidéo avec première/dernière image selon modèle, retake, extension, HDR et reframe sont documentés. HDR produit des archives EXR : ne pas les traiter comme MP4. Pas de V2V arbitraire, références multiples génériques, webhook ou annulation distante affirmés sans contrat officiel. `cancelLtxJob` arrête l’attente locale, signale l’absence de support et la possibilité de facturation distante. Les modèles2.3 du code restent documentés ; aucune migration implicite2.5. Estimation selon modèle/opération et contexte retake/extend ; coût réel/quota restent inconnus, sans taux inventé ni plafond de facture présumé.

Sources consultées : [jobs asynchrones](https://docs.ltx.io/async-jobs), [modèles2.3](https://docs.ltx.io/models/ltx-2-3), [prix](https://docs.ltx.io/pricing), [authentification](https://docs.ltx.io/authentication). Les tests contractuels LTX et journal font partie de la base T01 ; aucun delta d’adaptateur ici.

### RunPod

Base `https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}` ; Bearer limité à l’endpoint, POST `/run` avec `input`, GET `/status/{id}`, GET `/health`. Le contenu de `input` et la sortie sont **propres à l’image du worker**, pas validés par health200. ID et statuts sont contrôlés ; erreurs et sorties malformées échouent sans exposer les corps fournisseur. POST30s unique, GET15s, attente locale5min ; cela ne remplace pas `policy.executionTimeout` serveur. La plateforme documente POST `/cancel/{id}` et `/retry/{id}` ; **l’adaptateur ne fournit pas encore d’annulation distante et n’utilise pas retry**. Aucun faux succès d’annulation.

Résultats `/run` conservés30min après achèvement selon la documentation ; TTL et timeout serveur doivent être confirmés sur l’endpoint avant essai. Un404 ou une interruption ne prouve ni l’arrêt ni l’absence de dépense. Une clé refusée par une API admin ne remet pas en cause le health200 sur son endpoint. [Contrat Serverless officiel](https://docs.runpod.io/serverless/endpoints/send-requests).

### Shotstack

Code existant : `https://api.shotstack.io/edit/stage` avec `SHOTSTACK_API_KEY`, `https://api.shotstack.io/edit/v1` avec `SHOTSTACK_PRODUCTION_KEY`; `SHOTSTACK_ENV` sélectionne l’environnement. En-tête `x-api-key`, POST `/render` unique puis GET `/render/{id}` ; GET `/templates` utilisé pour la lecture gratuite. Les deux200 antérieurs prouvent ces lectures et environnements, pas des crédits ou un rendu. Les statuts d’échec et les corps invalides restent des erreurs ; pas de rendu de secours implicite. Aucun contrat d’annulation distante affirmé. [API officielle](https://shotstack.io/docs/api/), [clés et environnements](https://shotstack.io/docs/guide/getting-started/request-api-keys/).

### SunoAPI

`SUNO_API_BASE_URL` prioritaire sur `SUNO_BASE_URL`, contrat de `https://api.sunoapi.org/api/v1` et Bearer serveur. C’est **SunoAPI**, fournisseur tiers, pas Suno officiel. POST `/generate` → `taskId`, journal de l’acquittement, GET `/generate/record-info?taskId=...`, résultat dans `response.sunoData` et URL audio HTTPS contrôlée. Les callbacks ne constituent pas l’autorité de résultat : réconciliation par lecture authentifiée. V6 et customMode/lyrics/duration/callback sont comparés au contrat courant, aucune nouvelle version par défaut ajoutée. POST30s, GET15s, attente120s ; timeout ne signifie pas annulation.

États documentés PENDING/TEXT_SUCCESS/FIRST_SUCCESS/SUCCESS et échecs de tâche/audio/callback/sensible distingués ; réponses malformées et incohérences d’ID refusées. Le code fournisseur429 signifie crédit insuffisant ; HTTP429 signifie limitation de débit. Les401/403 ne sont pas un verdict de crédits. Aucun endpoint cancel inventé ni nouvelle musique après résultat incertain. [Création](https://docs.sunoapi.org/suno-api/generate-music), [détails de tâche](https://docs.sunoapi.org/suno-api/get-music-generation-details), [crédit](https://docs.sunoapi.org/suno-api/get-remaining-credits).

### Salad : gestion, worker et reprise

API de gestion `https://api.salad.com/api/public`, `Salad-Api-Key`, limite documentée240requêtes/minute. GET `/organizations/{name}/quotas` puis `/organizations/{name}/projects/{name}/containers` seulement. Les organisations/projets **ne sont pas énumérables par l’API publique** : noms issus du portail/configuration autorisée. Le GET groupes permet ensuite de sélectionner un groupe existant ; il renvoie aussi des variables d’environnement, donc aucun corps brut enregistré. Le lecteur fourni ne conserve que compte de groupes, headroom des réplicas et statuts expurgés. Il refuse401/403/404/429, corps invalides/surdimensionnés et délai15s, sans retry. **Zéro requête authentifiée effectuée dans ce lot.**

Le Gateway `https://<nom>.salad.cloud` doit être protégé (`auth=true`), port7862 uniquement. `Salad-Api-Key` reste côté application ; Bearer worker distinct côté serveur. ComfyUI7860 et bridge7861 restent loopback. Les routes `/health`, `/v1/capabilities`, `/v1/jobs`, `/v1/jobs/:id`, `/v1/jobs/:id/media` sont celles du worker SUTRA, pas celles de l’API de gestion Salad. Schémas, CAS PostgreSQL global, artefacts immuables/SHA, coûts estimés et provenance restent ceux du worker intégré.

Un seul ComfyUI, le bridge canonique et le host existant ; aucun deuxième moteur. Cold start borné avant admission ; la sonde locale vérifie protocole/état et accepte `busy` sans tuer un calcul en cours. SIGTERM ferme/drain le host avant bridge/ComfyUI ; après grâce bornée, arrêt forcé possible et résultat potentiellement incertain. Éviction sans signal possible : aucune garantie de grâce Salad. Le slot PostgreSQL persiste après interruption/redémarrage ; aucun POST rejoué ni libération TTL. Un état `interrupted` exige réconciliation opérateur.

Les réplicas doivent partager le même journal externe ; le verrou global conserve une seule génération. Prévoir **une seule réplique pour le premier essai**, autoscaling/autostart désactivés et politique de redémarrage choisie explicitement par T01. La recommandation générale Salad de réessayer/redupliquer les workers ne justifie pas de rejouer un job payé incertain. Aucun start/stop/restart/reallocate/create/update distant exécuté. Coût réel et crédits inconnus. Le prix historique RTX3090 24Go0,09USD/h n’est ni un devis courant ni une garantie de compatibilité.

Sources : [découverte du scope](https://docs.salad.com/agents/container-engine/discover-scope-and-preflight), [authentification/limites API](https://docs.salad.com/reference/api-usage), [quotas](https://docs.salad.com/reference/saladcloud-api/organizations/get-quotas), [groupes](https://docs.salad.com/reference/saladcloud-api/container-groups/list-container-groups), [Gateway](https://docs.salad.com/container-engine/how-to-guides/gateway/sending-requests), [startup](https://docs.salad.com/container-engine/explanation/infrastructure-platform/startup-probes), [readiness](https://docs.salad.com/container-engine/explanation/infrastructure-platform/readiness-probes), [liveness](https://docs.salad.com/container-engine/explanation/infrastructure-platform/liveness-probes), [interruption et architecture](https://salad.com/developers/).

## Recette préparée — non construite

`src/lib/salad/container/Dockerfile` : Linux/amd64 ; Node24.21.0 et Python3.12.12 par digests officiels ; snapshot Debian20261014 ; ComfyUI v0.40.0 commit `3541246a9c997f4b8c32f9f88f3c985d02021c79` ; npm lock minimal (`tsx`, `pg`, `zod`) et103 dépendances Python verrouillées avec hashes. PyTorch2.13.0/TorchVision0.28.0, famille CUDA13.0 officielle. Aucun modèle dans l’image préparée, runtime non-root10001, téléchargements HuggingFace désactivés, poids attendus en lecture seule.

Le premier choix PyTorch2.10.0 avait deux avis (`PYSEC-2026-139`, `PYSEC-2025-194`) : audit rouge conservé, remplacement2.13.0, **audit final103 dépendances/0avis/0ignoré**. Audit npm du runtime minimal :0avis. Ce sont des audits de métadonnées ; paquets OS, installation des wheels, imports Python effectifs et image complète restent **NON TESTÉS**. Aucun contournement/ignore d’avis utilisé.

Le modèle déclaré par le worker demeure `ltxv-13b-0.9.8-distilled-fp8`, T2V seulement ; encodeur `t5xxl_ltxv_official.safetensors`, VAE intégré au checkpoint. Le code des nœuds/arguments ComfyUI requis existe dans le commit choisi (`comfy-source-contract.json`). Cela ne prouve ni exécution, ni VRAM suffisante, ni qualité. Aucune RTX3090/5090 ou autre carte qualifiée. Les exigences CUDA13 et pilote hôte doivent être vérifiées sur le GPU choisi ; pas de changement opportuniste de stack ou profil.

Sources : [ComfyUI v0.40.0](https://github.com/Comfy-Org/ComfyUI/releases/tag/v0.40.0), [LTX-Video officiel](https://github.com/Lightricks/LTX-Video), [paires PyTorch officielles](https://pytorch.org/get-started/previous-versions/), [changement CUDA](https://pytorch.org/blog/pytorch-2-13-release-blog/).

Préparer le contexte seul, depuis le checkout, dans un nouveau répertoire inexistant :

```sh
node src/lib/salad/container/prepare-context.mjs /chemin/prive/contexte-sutra-neuf
```

Le script ne lit que18 fichiers explicitement autorisés, refuse les symlinks/écrasements, produit un manifeste SHA, permissions700/600 ; aucun `.env`, `.git`, node_modules ou modèle envoyé au builder. Sur un **builder Linux autorisé uniquement**, la future commande est `docker build --platform linux/amd64 -f /chemin/prive/contexte-sutra-neuf/src/lib/salad/container/Dockerfile /chemin/prive/contexte-sutra-neuf`. Commande non exécutée ; elle téléchargera de grosses dépendances CUDA. Ne pas builder depuis tout le dépôt. Publier un registre reste une autorisation séparée.

## Variables et actions restantes

Observation `salad-live.json`, 15octobre01:07:34.139Z : fichier master régulier, propriétaire courant, permissions600 ; aucun autre magasin de secrets ni `.env.local` utilisé. Valeurs jamais écrites dans les preuves.

- **À corriger dans le master par T01/utilisateur : `SALAD_API_KEY`**. La ligne existe mais sa syntaxe ne permet pas de transmettre une clé HTTP littérale avec le parseur sûr. Ne pas évaluer une expression shell, deviner/décoder la clé ou considérer cela comme un refus du fournisseur. Replacer une valeur littérale sur une ligne depuis le [portail Salad](https://portal.salad.com).
- **Scope absent : `SALAD_ORGANIZATION`, `SALAD_PROJECT`**. Noms de l’organisation et du projet dans le portail ; aussi visibles dans la route `/organizations/<organization>/projects/<project>/...`. L’API exige ces noms, pas un UUID deviné. `SALAD_CONTAINER_GROUP` sera choisi dans le portail ou dans le GET groupes autorisé après correction du scope ; variable de coordination du lecteur, pas une nouvelle lecture env dans l’adaptateur.
- **Configuration d’activation absente :** `SALAD_GATEWAY_URL`, `SALAD_WORKER_TOKEN`, `SALAD_WORKER_DATABASE_URL`, `SALAD_QUALIFICATION_JSON`, `SALAD_QUOTE_JSON`, `SALAD_MAX_ESTIMATED_COMPUTE_USD`, `SALAD_REQUEST_TIMEOUT_MS`, `SALAD_GENERATION_TIMEOUT_MS`. Qualification et devis doivent provenir de preuves, jamais de fixtures.
- **Valeurs fixes de la recette :** `SALAD_DEPLOYMENT_RECEIPT_PATH`, `SALAD_COMFY_URL`, `SALAD_BRIDGE_URL`, `SALAD_WORKER_PORT` sont absentes du master mais fixées explicitement dans l’emballage. Reçu indépendant en lecture seule à fournir au chemin prévu. `SALAD_ENABLED` absent : maintenir désactivé avant qualification et accord T01.
- RUNPOD_API_KEY/RUNPOD_ENDPOINT_ID, SHOTSTACK_API_KEY/SHOTSTACK_PRODUCTION_KEY, SUNO_API_KEY/SUNO_API_BASE_URL/SUNO_BASE_URL, LTX_API_KEY : présents, syntaxe analysable, provenance master. `SHOTSTACK_ENV` absent : sélection par défaut du code, aucune correction hors scope. Présence/syntaxe ne prouvent pas authentification ni crédit.

## Plus petit essai réel à faire autoriser

1. T01 corrige le scope privé puis rejoue seulement le lecteur Salad GET ; confirmer droit org/projet et groupe exact. Image/ressource/devis/budget maximal et durée d’arrêt doivent être approuvés avant tout provisioning. Créer/démarrer un groupe est hors de cette livraison.
2. Builder Linux : construire la recette, vérifier imports Python/CUDA/ffmpeg/tsx et scan de l’image, intégrer uniquement les deux poids officiels autorisés avec licences et SHA, fixer le digest final. Recevoir ce digest indépendamment de la qualification. Pas de téléchargement massif sur Mac.
3. Une réplique GPU autorisée, sans autoscaling ni autres moteurs : mesurer driver/CUDA, modèle/encodeur/VRAM totale/libre et exécuter **le plus petit profil du workflow canonique**, prompt synthétique, une seule fois. Profil réel compatible `8k+1` frames et multiples32 ; ne pas annoncer720p/1080p tant que ces profils n’ont pas été mesurés. Une qualification initiale isolée du workflow précède l’admission applicative ; ne jamais inventer un manifeste pour franchir cette barrière.
4. Avec ces preuves et le journal PostgreSQL externe T01 prêt/TLS/rôle restreint, fournir qualification/devis/reçu, puis tester le host avec bonne/mauvaise authentification et GET santé/capacités. Un unique job contractuel autorisé vérifie intention/ID, polling du même ID, média immuable/SHA et reprise GET après interruption de la connexion cliente. Ce deuxième passage est une validation HTTP du worker distincte du benchmark initial ; l’inclure explicitement dans le budget, pas de génération cachée.
5. Rapprocher durée de démarrage, durée GPU, mémoire, coût estimé et **facture réelle**. Arrêter la ressource selon le protocole autorisé. Toute éviction, annulation réelle ou nouvelle soumission nécessite sa propre autorisation ; en cas de statut incertain conserver la barrière et réconcilier, sans fallback payant. Pour RunPod, premier essai alternatif seulement après validation de l’image/contrat et du timeout serveur dans la [console Serverless](https://console.runpod.io/serverless).

## Tests et défauts traités

30 tests distincts PASS :15 emballage/arrêt/sondes,3 contexte/imports,12 lecteur Salad. Timeouts de corps suspendus, erreurs HTTP et JSON, données surdimensionnées, séquences SIGTERM/cold start/échec enfant, absence de clé de compte dans les enfants, aucune reprise de calcul. Le contexte3tests a été rejoué après le changement du lock Python ; pas ajouté au total.

Trois défauts du **nouveau brouillon d’emballage**, pas des adaptateurs intégrés : deux sondes acceptant HTTP200 sans schéma, dépendance transitive `media-probe.ts` omise du COPY. Rouge10PASS/3FAIL puis vert13PASS ; couverture finale étendue15PASS. Un échec ultérieur de test provenait d’une fixture sans Content-Type JSON : preuve conservée, fixture corrigée avant d’attester les timeouts. Le risque des deux avis PyTorch a été corrigé par changement du verrouillage avant livraison.

TypeScript ciblé du worker et lint des nouveaux modules PASS. Tests et commandes exactes dans `proof.json`. GitNexus : hostLOW2appelants, healthLOW1appelant avec appels perdus signalés, waitForComfyUNKNOWN complété par revue directe ; aucune exhaustivité du graphe affirmée. Détection staged et comparaison main obligatoires conservées avant commit ; comparaison main inclut l’historique intégré, pas seulement ce lot.

**FAIL résiduel démontré : aucun dans les tests exécutés. BLOQUÉ : configuration Salad, builder Linux/image, qualification GPU/budget. NON TESTÉ : tout appel payant, déploiement, publication, GPU réel, annulation/facture/réplication réelles.** Un PASS local ne vaut ni intégration T01 ni validation en production.
