# Préparation du conteneur Salad — désactivée

État livré : host HTTP exécutable, inspection runtime, bridge privé canonique et binding du port PostgreSQL T01. Aucun conteneur construit, registre poussé, modèle téléchargé, GPU démarré ou endpoint provisionné par T04. `disabled.example.json` est accepté par `saladWorkerConfig` / `startSaladHost`; l’entrypoint environnement reste désactivé sauf `SALAD_ENABLED=true` explicite. Aucune configuration activable ou qualification imaginaire n’est fournie.

## Frontières et fichiers à empaqueter

La recette Linux/amd64 livrée dans `Dockerfile` embarque Node 24, les dépendances verrouillées nécessaires (`tsx`, `pg`, `zod` et imports transitifs du bridge), les sources worker autorisées, `src/lib/salad-persistence.ts` livré par T01 et le bridge existant `scripts/comfyui-engine-server.mjs`. Le manifeste conteneur dédié conserve `tsx` comme dépendance de production ; le manifeste racine le classe en développement et ne remplace pas ce packaging. L’entrée `launch.mjs` supervise la chaîne existante ; le host `src/lib/salad/serve.mts` utilise Node avec le loader `tsx`, sans installation dynamique. Son absence de configuration activée est testée : arrêt normal, aucune connexion ni écoute. `host.ts` importé seul n’écoute jamais. La recette n’a pas été construite ni exécutée sur GPU : un digest d’image finale reste à produire.

Le host ne lance ni ComfyUI ni un autre moteur. L’image qualifiée doit avoir un seul superviseur, un seul ComfyUI et le bridge canonique, avec Python/PyTorch/CUDA identiques entre ComfyUI et le probe `python3`. `ffmpeg` et `ffprobe` sont nécessaires au contrôle des artefacts. Aucun moteur Mac, moteur de secours, téléchargement ou installation dynamique n’est intégré. Seul le port HTTP du host est exposable ; ComfyUI et le bridge restent sur deux ports loopback `http://127.0.0.1:<port>/`. Le port host, explicite entre 1024 et 65535, écoute IPv6 `::` pour le Container Gateway. Ne jamais exposer le bridge brut.

Les dépendances, l’image finale (digest et architecture), les licences et les performances GPU devront être qualifiées par T01 avant tout déploiement. Cette livraison ne fournit pas une image Docker déjà qualifiée. La récupération ou la compilation de modèles, un benchmark GPU et tout démarrage facturable restent hors autorisation actuelle.

## Configuration serveur, rôles séparés

Toutes les valeurs opérationnelles viennent de la source canonique privée `~/.env.purama.master`, sous contrôle T01. Les audits T04 autorisés lisent seulement les variables utiles en mémoire, sans valeurs dans les preuves, sans copie `.env.local` et sans mutation du master. Les tests de contrats emploient exclusivement des valeurs synthétiques. Aucun lecteur dotenv dans l’adaptateur. Les sondes d’accès au compte utilisent `SALAD_ORGANIZATION_NAME` et `SALAD_PROJECT_NAME` (anciens alias acceptés uniquement s’ils ne se contredisent pas) ; ces noms ne remplacent pas le Gateway requis par le worker.

| Variable | Application serveur | Worker distant | Contrat |
| --- | --- | --- | --- |
| `SALAD_ENABLED` | oui | oui | Absente ou autre que `true` : désactivé |
| `SALAD_GATEWAY_URL` | oui | non | Origine HTTPS protégée, hôte unique `*.salad.cloud`, aucun chemin/identifiant/query |
| `SALAD_API_KEY` | oui | **jamais** | En-tête `Salad-Api-Key` au Gateway ; aucun privilège de provisioning dans le code |
| `SALAD_WORKER_TOKEN` | oui | oui | Bearer distinct, 32–512 caractères sûrs, comparaison à temps constant |
| `SALAD_QUALIFICATION_JSON` | oui | oui | Manifest strict décrit ci-dessous, identique aux deux extrémités |
| `SALAD_QUOTE_JSON` | oui | oui | Devis USD daté, expirant, taux horaire approuvé et SHA-256 de sa preuve |
| `SALAD_REQUEST_TIMEOUT_MS` | oui | oui | Entier 100–90000 ; adapter aux probes/lecture DB, inférieur aux 100 s Gateway |
| `SALAD_GENERATION_TIMEOUT_MS` | oui | oui | Entier 1000–1800000, même valeur aux deux extrémités |
| `SALAD_MAX_ESTIMATED_COMPUTE_USD` | oui | non | Budget positif ; refuse estimation au-dessus du plafond |
| `SALAD_WORKER_DATABASE_URL` | non | oui | PostgreSQL externe dédié, TLS vérifié, aucun paramètre URL modifiant SSL |
| `SALAD_DEPLOYMENT_RECEIPT_PATH` | non | oui | Fichier reçu indépendant, en lecture seule, au plus 8192 octets |
| `SALAD_COMFY_URL` | non | oui | Loopback privé explicite, GET `/queue` et `/object_info/:node` par l’inspection |
| `SALAD_BRIDGE_URL` | non | oui | Loopback privé explicite, protocole canonique existant |
| `SALAD_WORKER_PORT` | non | oui | Entier 1024–65535, port exposé du host uniquement |

Le worker ne reçoit aucune clé de compte Salad, clé Supabase ou credential applicatif. `saladWorkerEnvironmentConfig` ne lit pas `SALAD_API_KEY` / `SALAD_GATEWAY_URL`; `saladWorkerConfig` élimine ces champs même dans une configuration de test commune. Son login PostgreSQL est dédié aux cinq fonctions `salad_worker` T01 : load, reserve, compare, put/get artefact. Configuration réseau/permissions, création du rôle et application du SQL restent T01 et nécessitent l’autorisation distante appropriée. Le host ne migre rien. Sans port T01 intégré il échoue avec `SALAD_PERSISTENCE_BINDING_REQUIRED`, jamais avec une mémoire locale de remplacement.

## Qualification réelle exigée

Le modèle exact est `ltxv-13b-0.9.8-distilled-fp8`, texte-vers-vidéo uniquement. Ni LTX V2 API, ni I2V, V2V, retake, extension, référence image, audio natif ou 4K native annoncés par ce worker. Les API clients existantes restent séparées.

Le manifeste `qualificationSchema` impose : id, date et SHA-256 d’une preuve mesurée ; image par digest `@sha256` Linux/amd64 ; version CUDA de PyTorch ; nom GPU, VRAM totale et VRAM libre minimale mesurée ; SHA-256 modèle/encodeur/VAE ; profils width/height/num_frames/fps réellement testés. Largeur/hauteur multiples de 32, frames `8k+1`, durée ≤60 s. Le routage applicatif n’accepte que les profils qualifiés répondant réellement à 720p/1080p, ratio et durée demandés, sans réduction silencieuse. Aucun profil synthétique des tests ne constitue une qualification exploitable.

Le reçu indépendant contient exactement `image` (digest final approuvé) et `comfyRoot` (répertoire absolu ComfyUI). L’identité image est une attestation de déploiement opérateur, pas une auto-attestation cryptographique du processus. Le reçu ne doit pas être généré depuis `SALAD_QUALIFICATION_JSON`. Au démarrage, le code calcule réellement les empreintes des fichiers réguliers en lecture seule :

- `models/checkpoints/ltxv-13b-0.9.8-distilled-fp8.safetensors`
- `models/text_encoders/t5xxl_ltxv_official.safetensors`

Le VAE est celui intégré au checkpoint, sortie 2 de `CheckpointLoaderSimple` utilisée par le workflow natif canonique. Le SHA VAE attendu égale donc le SHA du checkpoint. Aucun alias/symlink vers des poids non inspectés, aucun `extra_model_paths`, aucune mutation de modèles après l’inspection. L’image et les poids doivent rester en lecture seule. Le host reste froid jusqu’à la fin du calcul des SHA ; prévoir une startup probe/grâce suffisante. Chaque contrôle de disponibilité relit le slot durable, la file ComfyUI et les VRAM/GPU/CUDA mesurés (`nvidia-smi`, PyTorch), puis le health du bridge. Ces probes matériels n’ont pas été exécutés sur le Mac.

Avant les probes matériels, l’inspection vérifie aussi les interfaces des onze classes utilisées par le workflow canonique via les GET privés `/object_info/:node` : entrées attendues, indices/types de sortie, choix modèle/encodeur/sampler et `SaveVideo.output_node`. Un nœud absent, une réponse malformée ou les poids indisponibles rendent le worker indisponible. Les douze GET (file + classes) partagent un budget réseau de cinq secondes et des corps bornés ; aucun POST `/prompt` ni chargement de modèle. Cela vérifie des prérequis installés, pas la compatibilité GPU ni toutes les variantes/versionnements de ComfyUI. Le Dockerfile épingle déjà ComfyUI par commit et les dépendances Python par empreintes ; leur exécution avec le workflow dans l’image finale reste à qualifier.

Une RTX3090 24Go n’est pas déclarée compatible par sa seule capacité mémoire : il reste à prouver les profils, OOM, vitesse et environnement réel de l’image. Le prix historique 0,09 USD/h n’est ni un abonnement ni un forfait garanti. Aucun taux par défaut dans le code. L’estimation est taux approuvé × timeout / 3600000, hors attente facturée, stockage et réseau ; coût réellement facturé et quota restent `null` tant que non fournis par une preuve de facturation. Un timeout ne termine pas le GPU distant : cette estimation et son seuil ne sont pas un plafond garanti de facture; le slot reste bloqué et une intervention opérateur peut être nécessaire.

## HTTP, interruption et exploitation future

Routes **SUTRA**, et non routes de l’API de gestion Salad : GET `/health`, GET `/v1/capabilities`, POST `/v1/jobs`, GET `/v1/jobs/:id`, GET `/v1/jobs/:id/media`. Toutes exigent Bearer côté host, avant lecture du corps ou du stockage. Gateway protégé supplémentaire avec `Salad-Api-Key`. Aucun token dans les URL, logs ou DTO public. Réponses sans cache, erreurs fermées ; corps JSON ≤64KiB, média ≤64MiB, délais explicites. Les probes futures doivent utiliser un exec probe qui construit l’en-tête depuis le secret sans l’imprimer, et non placer le token dans une URL, un argument de commande ou un fichier versionné.

POST crée l’intention durable applicative avant le réseau, puis un slot global atomique PostgreSQL avant toute génération. ID stable, empreinte de la requête, CAS révisionnel, aucune réutilisation d’un checkpoint d’un autre fournisseur. Une interruption, un timeout ou un acquittement perdu conserve l’intention et le slot UNKNOWN ; reprise exclusivement par GET, même après 404. Aucun retry POST, annulation automatique, TTL de libération ou fallback API/stock. La lecture `readActive()` du slot est obligatoire pour readiness après redémarrage ; absente/en erreur/incohérente => `interrupted`. Un slot running encore frais donne `busy`; expiré/unknown donne `interrupted`.

SIGTERM/INT ferme l’écoute, refuse les nouvelles soumissions, puis attend les admissions déjà engagées (y compris une réservation PostgreSQL encore en vol) et leurs calculs avant de fermer la persistance. Aucun calcul relancé. SIGKILL/éviction conserve le slot dans PostgreSQL externe ; il faut réconcilier et prouver l’arrêt du précédent exécutant avant une décision manuelle. Le verrou protège les workers utilisant le même port durable, pas un processus GPU arbitraire lancé hors contrat : l’image ne doit héberger aucun moteur concurrent. Artefact immuable externe, taille+SHA-256+profil média vérifiés avant succès ; échec d’import applicatif impose la reprise du même job.

Le raccord open source concerne **la vidéo seulement**. Script, voix, musique et composition du pipeline SUTRA peuvent encore appeler des API payantes. T01 conserve le preflight création, l’intégration et toute activation. Aucun utilisateur ni compte social à connecter pour la livraison désactivée.

## Avant le premier essai GPU réel — responsabilité T01

1. Obtenir l’autorisation explicite ressource/budget et un devis daté, incluant cold start, stockage et trafic ; aucun tarif GPU présumé.
2. Construire sur un builder Linux autorisé la recette `Dockerfile` existante avec ses lockfiles, puis enregistrer le digest de l’image finale et vérifier licences/SHA des deux poids ci-dessus. Les versions ComfyUI/Python/PyTorch/Node et dépendances sont épinglées dans la recette ; cette préparation ne prouve ni sa construction ni une compatibilité GPU/VRAM.
3. Préparer le journal PostgreSQL externe T01, les cinq fonctions et le rôle worker dédié avec TLS, le stockage d’artefacts et l’accès réseau. Aucun SQL distant exécuté dans ce lot.
4. Préparer le Gateway protégé, les deux authentifications serveur, les probes et la grâce de démarrage ; renseigner uniquement la source privée canonique et monter le reçu indépendant en lecture seule.
5. Sur le GPU autorisé seulement, mesurer modèle/image/GPU/VRAM/CUDA, profils vidéo et qualité, durée, mémoire/OOM, cold start, perte de réponse, arrêt et éviction. Conserver la preuve et son SHA ; les tests synthétiques ne doivent jamais alimenter le manifeste opérationnel.
6. T01 intègre puis active uniquement le profil réellement qualifié, avec plafond d’estimation et procédure opérateur de réconciliation. Les autorisations de dépense, qualification et activation restent distinctes.

## Sources officielles consultées

- [Salad Developers](https://salad.com/developers/)
- [Authentification Container Gateway](https://docs.salad.com/container-engine/how-to-guides/gateway/sending-requests)
- [Tâches longues et limite du Gateway](https://docs.salad.com/container-engine/explanation/job-processing/long-running-tasks)
- [Réseau et instances](https://docs.salad.com/container-engine/explanation/infrastructure-platform/networking)
- [Readiness probes](https://docs.salad.com/container-engine/explanation/infrastructure-platform/readiness-probes)
- [Cold starts](https://docs.salad.com/container-engine/how-to-guides/cold-starts-and-iterating-quickly)
- [Prix à l’usage Salad](https://salad.com/pricing/)
- [Modèles officiels Lightricks LTX-Video](https://github.com/Lightricks/LTX-Video)
- [Routes ComfyUI et introspection des nœuds](https://docs.comfy.org/development/comfyui-server/comms_routes)
