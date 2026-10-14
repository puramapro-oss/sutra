# T02 — sécurité moteur personnel distant / Salad

Mission distincte Matiss du 14 octobre 2026, 01h40. Branche `codex/sutra-t02-salad-security-20261014`, base preuves `14617333bfb21efe1f2a1c91888d3322dde20f5b`, code applicatif `e3b17117256269e281304cd4ab83bc722a6f7894`. Produit strictement en lecture seule. Aucun autre chantier, secret, configuration ou fichier produit modifié.

## Résultat et limites

- **Base historique : 14 PASS / 9 FAIL**, 23 tests. Les échecs affirment les protections requises pour un accès distant ; ils restent rouges. L'adaptateur ComfyUI écoute seulement `127.0.0.1` : aucune exposition Internet actuelle n'est démontrée. Ne jamais exposer ce bridge directement.
- **Contrat Salad T04 : 31 PASS / 31**, transport, stockage et calcul simulés, vrais modules importés depuis son worktree en lecture seule. Les manifests donnent l'empreinte de chaque module avant/après exécution ; un SHA de base ne certifie pas le WIP T04. Aucun produit T04 copié ou intégré ici.
- **Lint et TypeScript ciblés : PASS.** Le projet TS comprend les deux nouveaux tests et leurs imports, avec les déclarations existantes ; aucun build ni gate globale rejoué. Les premiers contrôles du harnais ont été corrigés (nom de variable interdit par Next, déclarations Next manquantes, nouveau marqueur `journal.kind` T04).
- **Secrets : Gitleaks PASS**, scan expurgé des seuls tests/preuves T02 ; aucune valeur réelle lue. `base-tests.log` et `contract-tests.log` sont les exécutions finales avec manifests stables ; les contrôles qualité inchangés sont réutilisés dans `quality-manifest.json`.

Les logs conservés normalisent uniquement les espaces de fin de ligne et lignes vides terminales ; assertions, erreurs et résultats sont conservés.
- **Non certifié :** déploiement, DNS/TLS réels, isolation réseau du conteneur, journal/stockage durable, politique RLS en base et isolation d'organisations réelles. Le worker est une autorité serveur privée ; son bearer ne doit jamais être donné à un navigateur ou à un client. Le raccord owner-only final de T04 reste à vérifier sur son delta exact.

## Défauts reproductibles et traitement requis T04/T01

| ID | Preuve locale sur la base | Conséquence conditionnelle | Contrat T04 contrôlé |
|---|---|---|---|
| S01 | `local-engine.ts` accepte HTTP distant et `169.254.169.254` depuis la configuration serveur ; `probeLocalEngine` atteint le fetch simulé | Mauvaise configuration distante possible ; **pas** une SSRF fournie par un utilisateur démontrée | C02 refuse protocoles/hôtes/routes indus ; C09 borne le bridge à la boucle locale. DNS réel non testé |
| S02 | Génération et résultat envoyés sans auth serveur | Worker distant non authentifié ou appels refusés par un gateway protégé | C05/C08 vérifient bearer distinct + `Salad-Api-Key`, chemins fixes et `redirect:error` |
| S03 | POST `/` et `/upscale` sans auth atteignent le mock `/prompt` ; HTTP500 dû à l'arrêt simulé | Calcul indu si le bridge est exposé | C11 vérifie 401 avant stockage, inspection ou moteur sur les cinq routes publiques du wrapper |
| S04 | GET `/files?filename=other-job.mp4&subfolder=other-owner&type=output` retourne HTTP200 et octets simulés sans auth | Lecture arbitraire des sorties accessibles au bridge exposé | C11/C15 refusent accès sans bearer et chemins privés ; C07 refuse une réponse de tâche de scope/fingerprint étrangers ; P09 vérifie le stockage SUTRA sous propriétaire |
| S05 | Erreur amont synthétique renvoyée par `/health`, `/files` et `/` ; également loguée par POST | Fuite possible d'information sensible si l'erreur amont en contient | C06/C13 exigent des codes d'erreur fixes, sans contenu amont ; le bridge reste strictement privé |

Le canari d'erreur et tous les tokens des tests sont explicitement synthétiques. Aucun secret réel n'a été lu pour cette mission. Aucun `.env.local` créé et aucune provenance de credential réel revendiquée. Les validations RunPod/Shotstack de 01h26 appartiennent à T01 et ne sont pas rejouées.

## Protections existantes démontrées

`POST /api/production` prend l'identité de la session serveur : un corps contenant email propriétaire, faux `userId` et fausse organisation ne les transmet pas au worker. Une requête non authentifiée échoue avant lecture JSON et réservation de tâche. Le client ordinaire ne rejoint pas le moteur personnel, même si son URL serveur est mal configurée.

Les téléchargements historiques refusent une origine étrangère et les redirections ; erreurs HTTP et erreurs transport de la route propriétaire sont expurgées. Deux tâches concurrentes écrivant le même nom obtiennent deux chemins `owners/<id>/…` distincts ; un autre propriétaire ne peut pas déclencher de signature, et aucun contexte propriétaire n'autorise un upload. Cela ne constitue pas une preuve RLS distante.

Le wrapper T04 refuse bearer absent, falsifié ou remplacé, ainsi que la clé gateway seule. Le test de remplacement porte sur une nouvelle instance ; il ne prouve pas une rotation en production. Les résultats ne transportent pas une URL arbitraire : chemin dérivé de l'identifiant, hash et taille vérifiés. Le probe vidéo est mocké : les preuves média appartiennent à T05.

## Reproduction gratuite et sans réseau

Depuis ce worktree, avec Node 24 ou 26 compatible avec `mock.module` :

```sh
python3 qa/t02-salad-security-20261014/run-t02-salad-security.py --suite base --node /chemin/vers/node
python3 qa/t02-salad-security-20261014/run-t02-salad-security.py --suite contract --node /chemin/vers/node --target /chemin/vers/worktree-produit-T04
python3 qa/t02-salad-security-20261014/run-t02-salad-security.py --suite quality --node /chemin/vers/node
```

`base` sort avec code **1**, correspondant aux neuf garde-fous distants absents du bridge historique. Ne pas interpréter cela comme un échec du nouveau wrapper. `contract` nécessite le vrai produit T04 disponible : aucune réimplémentation ou substitution silencieuse. `quality` exécute seulement ESLint ciblé et le projet TS de ce dossier. Le runner vide l'environnement hérité, garde seulement PATH/LANG et le chemin explicite T04, active le garde réseau existant `qa/t08/offline.cjs`, puis les transports des tests sont entièrement simulés. Le handler historique est évalué sans modification dans une VM dont `listen`, processus, writes et fetch sont interceptés ; aucun serveur, ffmpeg, ffprobe ou GPU n'est lancé.

Les dépendances existantes sont réutilisées par lien local ignoré ; SHA256 du lockfile identique à T01 : `0fff63bc4148f77c18cfcdf8fe1340af1a307397493e30b91de0b0edf9ef1eb5`. Aucune installation ou purge.

## GitNexus et périmètre

Index propre au worktree T02, 14 344 nœuds / 27 320 arêtes. Impact amont `generateLocalVideo` **HIGH**, un appelant direct `tryLocalRoute`, cinq symboles impactés dans quatre modules ; signalé avant écriture des tests. **Graphe tronqué** : 963 entrées non classées, 533 cibles d'appels omises, trois parcours coupés. Aucun certificat d'exhaustivité ; `detect_changes` et le diff Git bornent séparément les nouveaux fichiers. Aucun symbole produit modifié.

`detect_changes --scope staged` exécuté : nouveaux fichiers sans recouvrement avec les symboles indexés, **pas** un arbre propre ni une certification des nouveaux tests. Le contrôle complémentaire du diff confirme uniquement `scripts/test-t02-salad-security.mts` et `qa/t02-salad-security-20261014/**` ; `src/**`, bridge, manifests de dépendances et configuration produit inchangés.

La source officielle [Salad Recipes](https://github.com/SaladTechnologies/salad-recipes) documente le header gateway `Salad-Api-Key`. L'authentification [JWT Salad](https://docs.salad.com/container-engine/tutorials/security/jwt-authentication) concerne l'identité du workload auprès de services externes : elle ne remplace pas l'authentification des requêtes entrantes du worker. Aucune API Salad appelée pendant cet audit.

## Transmission

T04 reste propriétaire des corrections produit ; T01 seul intégration/configuration/OVH. Le handoff vivant est `.coord/handoffs/SUTRA-20261012/T02-SALAD-SECURITY-20261014.md` dans le dépôt de coordination. Aucune fusion, push, activation, publication ou dépense autorisés dans ce lot. Aucune action utilisateur supplémentaire requise pour les tests locaux ; l'activation future exige les preuves réseau/stockage/qualification et l'autorisation distincte du coordinateur.
