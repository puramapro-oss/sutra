# SUTRA T08 — audit fournisseurs, 13 octobre 2026

**Release BLOQUE.** Base examinée : `48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4`, descendante du commit demandé `589732cb49959c1a576a3ba381b310cd594600ac`. Branche `codex/sutra-t08-provider-audit-20261013`. Aucun fichier produit modifié.

T01/T04 possèdent les sondes fournisseurs et Mac/OVH ; T05 le correctif Shotstack ; T06 le complément social ; T02 les frontières de sécurité. T08 fournit uniquement de nouveaux contre-tests hors réseau et cette synthèse. Les preuves partagées sont des snapshots expurgés, attribués et hashés dans `shared-evidence.json`. Aucun appel fournisseur ni SSH par T08, aucune génération, publication, connexion de compte, migration, fusion ou modification distante. Aucun secret copié dans ce worktree.

## Verdicts fournisseurs

| Fournisseur | Statut | Preuve et limite |
| --- | --- | --- |
| RunPod | ACTION UTILISATEUR REQUISE | T04 : GET liste et santé d'endpoint, HTTP 401 depuis Mac et OVH, `INVALID_API_KEY` sur la santé. Valeurs master normalisées en mémoire, une tentative, timeout 18 s, TLS vérifié, redirections interdites. L'endpoint, ses droits et son worker ne sont pas qualifiés. |
| Shotstack | ACTION UTILISATEUR REQUISE | T04 : GET templates avec chacune des deux clés sur `stage` et `v1` : 4 × HTTP 403 depuis chaque machine, erreur classée `INVALID_OR_DISABLED`. Le simple échange d'environnement ne résout pas le refus. Cette réponse ne distingue pas clé révoquée, clé incorrecte ou restriction du compte. Aucun POST render. |
| Suno | BLOQUÉ | Le code emploie `SUNO_BASE_URL` et un contrat `/generate`, puis `/songs/{id}`. La base legacy normalisée répond HTTP 503 à un GET public. Aucun contrat d'authentification gratuit vérifié : aucune clé envoyée à une destination non qualifiée. `SUNO_API_BASE_URL`, alias visant un fournisseur tiers, est ignoré par ce code. L'API officielle Suno existe ; sa présence ne valide ni ces URLs ni cette clé. |
| Zernio / réseaux | BLOQUÉ (authentification Zernio VALIDÉE) | T04 : GET accounts HTTP 200 depuis Mac et OVH, zéro compte connecté. Quatre contre-tests échouent sur l'initiation et le callback actuels. Le succès de la clé ne certifie aucune connexion OAuth, publication ou isolation par organisation. |

Contrats officiels consultés le 13 octobre : [RunPod credentials](https://docs.runpod.io/get-started/credentials), [RunPod endpoints](https://docs.runpod.io/serverless/endpoints/send-requests), [Shotstack API](https://shotstack.io/docs/api/), [Suno officiel](https://platform.suno.com/), [Zernio connect](https://docs.zernio.com/connect/get-connect-url). Le snapshot public `zernio-contract.json` décrit OpenAPI **1.273.0**, HTTP 200, 631 chemins, avec empreinte du document ; aucun credential n'a servi à cette lecture.

## Provenance et machines

Source des credentials fournisseurs des sondes T04 : **`~/.env.purama.master`, mode 0600**. Les fichiers de configuration locaux/distants servent uniquement à la comparaison opaque ; ils ne remplacent pas cette source. Voir `shared/t04-dotenv.json` et `shared/t04-normalized-live.json`.

| Variables | Résultat de provenance |
| --- | --- |
| `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, `SHOTSTACK_API_KEY`, `SHOTSTACK_PRODUCTION_KEY`, `SUNO_API_KEY`, `SUNO_BASE_URL` | Présentes une fois dans le master ; suffixe de nouvelle ligne après décodage dotenv. Après suppression en mémoire seulement, concordent avec Mac et conteneur OVH. Les refus fournisseur persistent. Ne pas copier aveuglément les valeurs brutes. |
| `ZERNIO_API_KEY`, `ZERNIO_BASE_URL` | Présentes ; égalité exacte master/Mac/conteneur, authentification HTTP 200. |
| `SUNO_API_BASE_URL` | Présente dans master, différente de `SUNO_BASE_URL`, absente des configurations SUTRA observées et non consommée par l'adaptateur. Ne pas changer uniquement l'URL sans adapter le contrat. |
| `ZERNIO_WEBHOOK_SECRET` | Présent dans master, absent de Mac/conteneur ; aucun raccord de santé/événement social signé qualifié. Présence dans le master ≠ webhook fonctionnel. |
| `SHOTSTACK_ENV`, `RUNPOD_POD_URL` | Absents du master et du runtime observé. Le code choisit `stage` par défaut ; l'URL pod n'est pas exigée pour l'endpoint serverless. |
| `SHOTSTACK_BASE_URL` | Aucun usage dans l'adaptateur examiné : URL calculée `https://api.shotstack.io/edit/{stage|v1}`. Sur cette base, la soumission lit toujours `SHOTSTACK_API_KEY`, même en `v1` ; correctif réservé T05, non intégré ici. |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL` | Valeurs master différentes du runtime SUTRA et ne désignant pas SUTRA selon T04. Conserver la configuration applicative observée tant que le mapping par app n'est pas corrigé par son propriétaire. |
| `CRON_SECRET`, schémas applicatifs | T01 constate un écart master/runtime. Les tests de garde cron historiques prouvent une logique locale, pas la concordance des credentials ni un ordonnanceur actif. |

T04 a observé le conteneur OVH actif et sain, ainsi que les fichiers de configuration en lecture seule : deux concordent avec le master normalisé, un troisième diverge. Les chemins/valeurs sensibles ne sont pas recopiés. L'accès utilise l'alias SSH existant `purama-ovh` ; **l'authentification SSH avec les seuls paramètres du master n'est pas validée**. T01 obtient `Permission denied` (exit 255) et constate que l'hôte du master ne correspond pas à l'origine SUTRA déployée. Ces deux observations ne sont pas contradictoires : leurs mécanismes SSH diffèrent. Aucun changement distant pour les réconcilier.

## Contre-tests et défauts transmis

Commande reproductible, sans master ni réseau :

```sh
node qa/t08/providers-20261013/run.mjs redteam
```

Le runner transmet une liste fermée de variables factices et précharge `qa/t08/offline.cjs` ; chaque fetch est simulé. **6 tests : 1 PASS, 5 FAIL, 0 SKIP**, exit 1 conservé. Les quatre premiers échecs décrivent le même raccord OAuth obsolète, pas quatre incidents distants indépendants.

| ID | Exigence attendue / résultat constaté | Propriétaire |
| --- | --- | --- |
| T08-Z01 | GET `/connect/youtube` attendu ; `/oauth/url` émis. | T04 adaptateur, T06 routes sociales |
| T08-Z02 | `profileId`, `redirect_url`, `scopes=posting` attendus ; champs absents. Le profil de la fixture est synthétique : un mapping serveur utilisateur/organisation reste nécessaire. | T04/T06, T02 pour isolation |
| T08-Z03 | Réponse `{authUrl,state}` attendue ; `url` retournée vide. | T04 |
| T08-Z04 | Callback hébergé `connected/profileId/accountId/username` avec corrélation persistée : doit atteindre la vérification de session ; rejet prématuré `missing_params` faute de `code`. Aucun callback ne doit être accepté sur la seule confiance de ses paramètres. | T06/T02 |
| T08-S01 | HTTP 200 fournisseur avec `{error: marqueur_factice}` : le marqueur est renvoyé au navigateur dans `details` par POST `/api/music/generate`. Reproduction via vraie route et vrai adaptateur, un seul appel simulé. Aucun secret réel exposé pendant le test. | T04 `suno.ts`, T02 frontière API |
| T08-S02 | Même marqueur dans un HTTP 401 : corps fournisseur correctement expurgé. PASS. | T04/T02 |

Fichiers concernés en lecture seule : `src/lib/zernio.ts`, `src/app/api/social/callback/route.ts`, `src/lib/suno.ts`, `src/app/api/music/generate/route.ts`. Aucun contournement des verrous pour les corriger. Reproductions remises dans `.coord/handoffs/SUTRA-20261012/T08-PROVIDER-QA-COORD-20261013.md`.

## Matrice de qualification du delta

| Exigence | Statut | Portée réelle |
| --- | --- | --- |
| Source unique fournisseurs / permissions fichier | PASS | Sondes T04 master, 0600 ; snapshots sans valeur. |
| Config master directement utilisable | FAIL | Six suffixes et mappings applicatifs divergents. |
| RunPod authentification et endpoint | BLOQUE | 401 même après normalisation ; permissions non prouvées. |
| Shotstack authentification stage/prod | BLOQUE | 403 quatre combinaisons. Restriction exacte côté compte inconnue. |
| Suno identité API et authentification | BLOQUE | 503 legacy public ; alias tiers incompatible non testé avec clé. |
| Zernio authentification GET | PASS | 200, zéro compte. |
| Contrat initiation / callback / scopes minimaux | FAIL | Z01–Z04 ; OpenAPI actuelle contre mocks historiques. |
| State usage unique, TTL, utilisateur/navigateur, panne DB | PASS | Contrats locaux partagés ; aucune nouvelle session/provider réel. |
| Liaison organisation/profil et session précise | FAIL | Mapping organisation/profil et identifiant de session distinct absents ; pas d'exploitation distante tentée. |
| Rotation / santé / révocation effective des tokens | BLOQUE | Refresh sans consommateur, ancien endpoint ; santé/webhook non raccordés ; révocation native distante non démontrée. |
| Non-exposition erreurs Suno 2xx | FAIL | S01 reproductible. |
| Non-exposition erreurs HTTP non-2xx | PASS | S02 + contrats de sécurité communs. |
| Timeouts, requêtes doubles, concurrence, reprise et erreurs partielles | PASS | Modèles/contrats locaux T01 ; POST payants sans retry aveugle. Aucune preuve d'idempotence de facturation fournisseur réelle. |
| SSRF / IDOR / CSRF / isolation technique | PASS | Couverture locale des tests communs sur base identique ; ne couvre pas le nouveau mapping organisation OAuth absent. |
| Lecture config Mac/OVH | PASS | Preuves T04 opaques ; runtime observé, pas modifié. |
| Accès SSH exclusivement master | BLOQUE | T01 exit 255 ; alias préexistant T04 seulement. |
| Cron master et ordonnanceur réel | BLOQUE | Concordance/activation non établies ; aucun cron lancé. |
| TypeScript / lint | PASS | Exécution T08 fraîche ; 0 erreur, 111 avertissements hérités. |
| Génération / rendu / publication réels | NON TESTE | Exclus par le mandat, pas nécessaires à cet audit gratuit. |
| Consentement OAuth / connexion de compte | NON TESTE | Action humaine après correction du raccord. |
| XSS navigateur, accessibilité, charge, performance, parcours E2E continu | NON TESTE | Aucun nouveau changement UI. Preuves antérieures conservées dans le handoff du 12, pas promues en qualification fournisseur du 13. |
| Certification de release | BLOQUE | Défauts locaux et qualifications externes ci-dessus. |

**22 exigences : 8 PASS, 4 FAIL, 7 BLOQUE, 3 NON TESTE.** Compteur indépendant du nombre d'assertions et de l'ancienne matrice T08 du 12 octobre.

## Gates et réutilisation

- T08 : `run.mjs typegen`, `typecheck`, `lint` : exit 0. Redteam exit 1 documenté. Première lint en erreur sur le logger du runner QA, corrigé ; preuve initiale conservée. Node utilisé enregistré dans chaque JSON de commande.
- T01, audit master du 13 à 20:27 UTC : **480 PASS / 7 SKIP / 0 FAIL** sur 487 contrats, plus schedule/composition/publication PASS. Snapshot complet des résultats et commandes dans `shared/`. Les 7 SKIP restent externes (INSEE/DB/OTS), sans faux PASS.
- `source-equivalence.json` : **752 fichiers** produit, scripts, tooling et configuration comparés octet pour octet avec T01, tous égaux. Dépendances existantes partagées en lecture ; aucune installation ni rebuild identique. Le partage de preuves ne signifie pas parcours E2E réel ou fournisseurs actifs.
- Aucun nouveau build produit nécessaire pour un delta QA/documentation sans changement produit/config/dépendances. Le build et les preuves navigateur antérieurs sont conservés, pas présentés comme rejoués.
- GitNexus isolé indexé avant commit : 13 714 nœuds, 26 469 relations, 365 flux. Graphe **TRUNCATED** (952 candidats, 526 callees, 4 walks omis) ; aucun argument d'exhaustivité. `detect-changes --scope staged` : 25 chemins, 53 symboles, zéro flux affecté, risque LOW (avant ajout de sa propre trace). Revue directe de tous les chemins : QA et documentation uniquement. Aucun symbole produit édité.

## Actions humaines minimales

1. [RunPod — API keys](https://console.runpod.io/user/credentials) : vérifier compte propriétaire, clé active et droits de lecture sur le bon endpoint ; remplacer la clé du master si refus persistants, sans la transmettre en conversation. Pas besoin de lancer un job GPU pour contrôler `/health`.
2. [Shotstack — API keys](https://app.shotstack.io/keys) : vérifier/régénérer les clés Edit stage et production du compte actif ; demander au support la levée d'une désactivation si nécessaire. Un nouveau GET templates suffit pour la recette d'authentification.
3. [Suno officiel](https://platform.suno.com/) : confirmer le fournisseur réellement souscrit et l'accès API correspondant. Le propriétaire doit adapter le contrat avant tout essai authentifié ; ne pas envoyer la même clé à une autre base par supposition.
4. Réconcilier l'accès OVH du master et ses valeurs propres à SUTRA avec le coordinateur ; conserver les six valeurs sans suffixe parasite. Aucune correction à distance pendant cet audit.
5. Après correction OAuth, choisir uniquement les comptes voulus dans le [parcours Zernio](https://docs.zernio.com/connect/get-connect-url) : chaîne YouTube, Page Facebook, compte Instagram professionnel, compte X, profil/organisation LinkedIn, compte TikTok avec ses consentements par média, tableau Pinterest, comptes Reddit/Threads ; Bluesky nécessite son [mot de passe d'application dédié](https://bsky.app/settings/app-passwords). Aucun consentement ou secret OAuth natif supplémentaire supposé. Détail propriétaire : T06 `qa/t06-provider-audit-20261013/SOCIAL-AUDIT.md`.

Les corrections de code T04/T06/T02/T05 sont des actions propriétaires, pas des actions à déléguer à l'utilisateur. Aucune connexion sociale ne doit précéder la correction de l'isolation et du callback.

Les traces T08 versionnées retirent uniquement les espaces de fin de ligne et lignes vides terminales ; les sorties, assertions et codes ne sont pas filtrés. Les snapshots des propriétaires conservent leurs octets et SHA-256 exacts.
