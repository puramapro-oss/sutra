# SUTRA multicomptes et autorisations de publication

## Qualification native de continuation — 10 novembre 2026

La continuation du candidat `846bf6ef7d65be9b9b179739b229ced6339deb8f`
exécute les **15 commandes du gate de base de données** avec PostgreSQL natif
16.15, dans des clusters locaux jetables sous UID 1000. Les résultats finaux sont
PASS, sans test natif ignoré. Le reçu conserve les essais intermédiaires : les
clients PostgreSQL 18 ont d’abord fait échouer deux restaurations sur le serveur
16 ; les clients natifs 16.15 ont ensuite permis de rejouer les trois commandes
concernées avec succès. Ce résultat n’est pas présenté comme un premier passage
unique entièrement vert. La première qualification en PostgreSQL 18.6 apporte une
preuve complémentaire ; ses compteurs ne s’ajoutent pas à ceux de la passe 16.

Le banc commun choisit un port attribué par le système, écoute seulement sur
`127.0.0.1`, désactive les sockets Unix interdits par ce runtime et fixe UTC. Les
assertions métier restent actives : rôles et RLS, unicité, quotas, verrous, reprise
après redémarrage réel, refus du worker expiré, sauvegarde/restauration et catalogue
de promotion. Les migrations et le code produit restent inchangés.

Deux anciens scénarios ont été adaptés au protocole multicomptes publié : une
reconnexion transmet l’UUID du compte choisi, et la génération planifiée sans
publication désactive explicitement `auto_publish` dans la même requête que son
activation. La fixture OAuth applique maintenant la migration multicomptes réelle.
Un nouveau test natif vérifie aussi que deux retours OAuth indépendants visant la
même identité externe ne créent qu’un compte et un événement de consentement.

| Contrôle de continuation | Résultat |
|---|---|
| Migration multicomptes | 9 groupes PASS ; identités, historique, RLS, droits et réapplication |
| Concurrence pipeline / API / Salad / fiabilité durable | Respectivement 16, 13, 7 et 51 tests PASS, 0 SKIP |
| RLS / droits d’écriture / historique social | 261 assertions, 30 contrôles et 27 groupes PASS |
| Routes OAuth / planning / partenaire | Respectivement 10, 3 et 10 tests PASS |
| Reprise / isolation du planificateur | 19 et 7 tests PASS, avec sauvegarde/restauration |
| Autonomie locale | 13 scénarios PASS ; 4 tests de fermeture de connexions et 2 tests de port inclus dans le runner |
| Catalogue de promotion | PASS : 3 fonctions et 3 tables contrôlées |
| Chromium, composants sociaux / reprise | 21 groupes et 12 tests PASS ; vrais composants, transports locaux synthétiques |
| ESLint global et contrôle ciblé final | PASS |
| TypeScript global et build Next de cette passe | BLOQUÉS : processus SIGKILL sans diagnostic de code, heap 1024 Mo |

Les commandes, tentatives, sources et empreintes sont dans
[`qa/native-qualification-20261110/RECEIPT.json`](../qa/native-qualification-20261110/RECEIPT.json).
L’installation npm standard reste BLOQUÉE par le transport Git du paquet privé
SMARANA. L’installation de qualification utilise ses 21 blobs canoniques vérifiés
au commit verrouillé et les mêmes versions d’archives npm ; `npm rebuild` passe.
Elle ne constitue pas un PASS de l’installation standard de la CI.

Les parcours Next complets en build de production ne sont pas revendiqués pour
cette passe. WebKit manque de bibliothèques système ; les fournisseurs réels,
Supabase hébergé, la production et les mesures de charge restent NON TESTÉS.
Aucun compte social, message, paiement, déploiement ni base distante n’a été modifié.
Les preuves historiques détaillées plus bas conservent leur date et leur portée.

## Résultat et périmètre

Cette extension permet de conserver plusieurs comptes d'un même réseau, de les sélectionner séparément et de publier par destination avec le journal durable existant. Elle s'appuie sur la PR #8, branche `repair/sutra-security-20261109`, commit `9f876cbcc5fe667209a369a8ee64c109ab043173`.

Le lot d'intégration du 10 novembre réunit aussi les corrections de la PR #10 au commit `e8c86e7298850bbdb2473cb55aace1609bf1b7df` : statistiques administrateur, deux workers de build et en-tête mobile. Les deux branches de revue gardent leur déploiement automatique désactivé. Les preuves de la première PR multicomptes ne sont pas présentées comme une validation de cet ensemble ; ses contrôles sont réexécutés séparément.

Le périmètre comprend la migration, les connexions OAuth hébergées, les deux réglages automatiques, la publication manuelle et les reprises. Il ne crée pas de comptes auprès des réseaux, ne déclenche pas de campagne commerciale et ne prouve aucun revenu. Les médias différents par compte, les licences détaillées, le suivi des ventes et les autorisations éditoriales complètes restent des chantiers distincts.

La branche `codex/sutra-multi-account-20261110` désactive son déploiement automatique dans `vercel.json`. Aucun changement de dépendance, de prix, de commission ou de politique de paiement n'est nécessaire à cette extension.

## Identité et connexion

Chaque connexion conserve son UUID local et l'identifiant de compte Zernio vérifié côté serveur. La contrainte d'un seul compte par utilisateur et réseau est remplacée par une unicité sur `(user_id, platform, external_id)`. Une ancienne ligne sans identité externe reste conservée ; elle ne devient pas automatiquement une connexion autorisée.

`POST /api/social/connect` distingue deux intentions :

```json
{ "platform": "youtube" }
```

ajoute une identité, tandis que :

```json
{ "platform": "youtube", "accountId": "UUID_LOCAL_DU_COMPTE" }
```

reconnecte ce compte précis. Le serveur ne choisit jamais la première chaîne disponible.

La reconnexion transmet aussi l'identifiant Zernio enregistré dans `reconnectAccountId`. Le fournisseur peut ainsi refuser un mauvais compte avant sa propre écriture. Au retour, SUTRA vérifie indépendamment la session, le profil fournisseur, l'identité distante et la révision du compte. L'état OAuth reste à usage unique, lié à un secret navigateur HttpOnly. Une révocation concurrente empêche une réactivation par un ancien retour OAuth.

Le digest de consentement est versionné : les états de connexion créés par l'ancienne version doivent être recommencés après la bascule. Les tentatives d'ajout d'un compte déjà enregistré échouent explicitement ; elles ne le réactivent pas. L'historique et les protections de révocation existants sont conservés.

Source fournisseur consultée le 10 novembre 2026 : [SDK officiel Zernio, GetConnectUrl](https://github.com/zernio-dev/zernio-dotnet/blob/main/docs/ConnectApi.md#getconnecturl). Il décrit plusieurs comptes d'un même réseau dans un profil, la conservation de l'identité lors d'une reconnexion et `reconnectAccountId`. Certaines offres anciennes imposent encore une limite de comptes par plateforme ; la capacité du compte de production doit être contrôlée lors de la recette réelle.

## Publication par compte

La route de publication conserve `platforms` et accepte une liste explicite :

```json
{
  "videoId": "UUID_VIDEO",
  "platforms": ["youtube"],
  "destinations": [
    { "platform": "youtube", "accountId": "UUID_LOCAL_CHAINE_A" },
    { "platform": "youtube", "accountId": "UUID_LOCAL_CHAINE_B" }
  ]
}
```

Les UUID ci-dessus sont des marqueurs explicatifs à remplacer par de véritables UUID. L'API accepte au plus 50 comptes par demande et par journal durable, refuse les doublons et exige une correspondance exacte avec les plateformes annoncées. Elle refuse de mélanger `destinations` et l'ancien objet `accountIds`.

L'ancien format à un compte par réseau demeure compatible. Une sélection implicite par réseau exige un compte connecté unique ; elle ne peut pas choisir arbitrairement une chaîne ni reprendre une ancienne opération devenue ambiguë.

Une nouvelle opération de journal porte sur une destination, avec requête immuable, compte local, identifiant fournisseur et clé d'idempotence. Les résultats exposent `localAccountId` pour distinguer deux chaînes du même réseau, y compris lorsqu'une sélection est refusée avant tout envoi.

Les garanties contrôlées sont les suivantes :

- Aucune nouvelle identité ni nouvelle clé après un timeout ambigu.
- Vérification du propriétaire, du profil et des autorisations avant et après réservation.
- Un succès de A reste visible si B échoue, perd sa connexion ou doit être reconnecté.
- Une reprise conserve le post et la requête d'origine ; elle ne republie pas les comptes déjà confirmés.
- Un ancien post groupé peut reprendre B échoué sans sélectionner à nouveau A déjà publié. Les autres destinations inachevées doivent rester sélectionnées et autorisées.
- Après une reprise incertaine, un ancien état distant `failed` ne devient pas la preuve d'un nouvel échec. Le journal conserve la barrière `retrying` tant que l'issue n'est pas établie.
- Un état intermédiaire `publishing` ou `scheduled` ne lève pas cette barrière. Sans marqueur identifiant la nouvelle tentative, seule sa publication confirmée permet de terminer cette reprise.
- Pour un ancien groupe partiellement publié, la lecture distante doit encore confirmer chaque succès déjà acquis avant un retry du groupe. Une lecture contradictoire, incomplète ou comportant une destination supplémentaire bloque la reprise et conserve les succès connus.
- Le média vérifié et son empreinte restent immuables pour une production. Cette extension ne contourne pas cette règle pour simuler des recadrages.

La [documentation officielle PostsApi de Zernio](https://github.com/zernio-dev/zernio-dotnet/blob/main/docs/PostsApi.md#retrypost), relue le 10 novembre 2026, décrit une reprise prenant seulement `postId`. Elle précise aussi qu'une réponse `207` peut signaler un résultat partiel ou un échec sans `platformResults` : les états du post et de ses destinations doivent être examinés. Ce contrat motive le contrôle de cohérence de tout ancien groupe avant reprise et la création des nouvelles opérations par destination. La même documentation décrit `publishNow` comme synchrone ; l'exécution durable des lots reste donc un chantier distinct du seul schéma multicomptes.

### Vérifier l'état après une réponse perdue

Le bouton « Vérifier l'état » réutilise l'intention initiale avec `reconcileOnly: true`. La route exige un booléen strict. Ce mode réutilise les lectures du journal, sans appel fournisseur de création, de rejeu ou de reprise, sans génération de légende et sans nouvel accès au média. Les projections locales peuvent être réparées depuis les preuves retrouvées. Le propriétaire et l'export vérifié restent contrôlés.

Une destination sans preuve reste `unknown` avec `SUTRA_PUBLICATION_EVIDENCE_REQUIRED`. Un contrôle d'état ne crée jamais de droit de reprise dans l'interface ; un succès confirmé reste conservé, et une nouvelle observation inconnue retire une ancienne éligibilité de reprise. Publication et vérification partagent le même verrou de requête. Une erreur du callback de rafraîchissement du parent ne transforme plus une publication confirmée en résultat inconnu.

Au candidat `846bf6e`, ce mécanisme ne résolvait pas les lots longs : le navigateur attendait jusqu'à 30 secondes, la route annonçait 120 secondes, et l'adapter pouvait attendre jusqu'à 90 secondes par envoi séquentiel. Le candidat de reprise durable décrit plus bas dissocie maintenant l'admission du lot de ces appels. Il ne constitue pas une mesure de capacité simultanée sur les réseaux réels. Sans `postId` enregistré, la seule lecture d'état ne peut toujours pas identifier une réponse distante perdue.

## Deux automatismes raccordés

Les parcours existants utilisent deux configurations : `public.social_autopilot_config` après création d'une vidéo, et `sutra.sutra_auto_config` pour les vidéos autonomes. Les deux stockent maintenant `publish_account_ids` et relisent ces autorisations avant l'envoi.

La migration initialise cette liste à vide. Aucun compte nouvellement connecté, ni aucune ancienne sélection de réseau, n'autorise implicitement de nouveaux envois. Les utilisateurs doivent enregistrer leurs destinations précises dans `/settings/social` ou `/auto/settings`.

Une désactivation demeure possible même si un compte enregistré a disparu. Toute réactivation revalide les comptes sélectionnés. Les autres réglages, notamment les plannings et l'approbation préalable des vidéos, conservent leur fonctionnement existant.

La validation des horaires et de leur précondition précède désormais la construction du client privilégié et la lecture des mandats, y compris lorsqu'une activation figure dans la même requête. La modification des plannings conserve sa comparaison atomique avec l'état antérieur. Les contrôles de l'interface exposent leur état aux lecteurs d'écran ; un compte expiré sélectionné peut être retiré sans devenir sélectionnable pour un nouvel envoi.

## Recette et preuves

Les tests utilisent des identités synthétiques et des fournisseurs simulés, sans publication ni dépense. Les résultats détaillés du candidat sont consignés dans le bilan de la PR.

| Contrôle | Périmètre réel |
| --- | --- |
| Tests du journal et de l'autonomie | Modules réels, base en mémoire, transports simulés ; concurrence logique, révocation, succès partiels et reprises |
| Tests API et OAuth | Handlers réels avec session, base et fournisseur simulés ; validation, isolation et compte de reconnexion exact |
| Test navigateur | Composants React réels dans un hôte isolé ; navigation, authentification et API simulées ; Chromium 147.0.7727.0 |
| Test de migration | Même scénario pour PGlite ou PostgreSQL natif ; contraintes, lignes, historique, ACL, RLS, triggers et seconde application ; exécution locale confirmée sur PostgreSQL 18.3 via PGlite 0.5.8 |
| TypeScript et lint | Analyse statique ; ne remplace ni un build Next complet ni la recette des comptes réels |

### Bilan du second audit, 10 novembre 2026

| Contrôle exécuté | Résultat constaté |
| --- | --- |
| Contrats généraux | **PASS : 1 477 réussites, zéro échec, sept essais connectés ignorés**, sur 1 484 tests |
| Soumission durable | **PASS : 18/18** ; contrôles horaires, composition et publication également PASS |
| Planificateur promotionnel | **PASS : 162/162**, hors ligne |
| Médias | **PASS : 152/152**, six groupes, incluant rendus CPU FFmpeg et vérifications des exports |
| Publication multicomptes ciblée | **PASS : 144/144**, inclus dans les contrats généraux ; ne pas les additionner une seconde fois |
| Migration multicomptes | **PASS : neuf groupes PGlite**, dont permissions, historique, triggers et seconde application ; exécution native NON TESTÉE |
| Composants sociaux dans Chromium | **PASS : 21/21 groupes**, composants réels avec API simulées, zéro requête externe et erreur applicative inattendue |
| Qualité globale | **PASS : TypeScript, lint et build Next**, sorties 0 ; 199 pages générées ; les modifications QA ultérieures ont aussi passé leur lint ciblé |
| Application Next compilée dans Chromium | **PARTIEL pour la couverture navigateur : 14 scénarios et 258 contrôles au vert après reprises ciblées**, détails ci-dessous ; WebKit et Safari natif NON TESTÉS |

Les sept essais ignorés sont quatre appels INSEE, un essai de partage KARMA en base, un essai `video_generations` en base et un appel réseau OpenTimestamps. Ils restent NON TESTÉS dans cet environnement ; aucun accès connecté n'est déduit des résultats hors ligne.

La campagne navigateur conserve trois reçus distincts : premier passage complet de 14 scénarios, 237 contrôles réussis et 21 échecs ; reprise des cinq scénarios concernés, 115 réussites et deux échecs ; reprise finale de `schedule-cas`, 11 réussites et zéro échec. La couverture consolidée retient le dernier reçu de chaque scénario : 258 réussites, zéro échec, sans erreur runtime inattendue, mutation inattendue ou requête externe observée. Elle ne représente pas un unique passage intégral entièrement vert. Les sélecteurs et fixtures devenus incompatibles avec les UUID ont été corrigés, ainsi que l'isolation de deux contrôles ; les délais et assertions de sûreté ont été conservés. Les premiers délais dépassés sur les clics et la navigation ne se sont pas reproduits dans les reprises. Leur cause initiale n'est pas attribuée définitivement au produit ou à l'environnement.

Les anciens parcours `qa/final-delta-20261014/social-browser.mjs`, `qa/t07-modes-20261014/browser.mjs` et `qa/t06-closure-79cd95b-20261020/journeys.mjs` ont été adaptés aux comptes exacts et relus indépendamment ; syntaxe et lint PASS, mais leur exécution navigateur complète reste NON TESTÉE. Ils ne sont pas comptés dans les 258 contrôles.

Un premier passage qualité a été interrompu par `SIGKILL`, puis a réussi avec le plafond mémoire optionnel. Une relance de contrats a rencontré un disque partagé plein (`ENOSPC`) ; les caches de compilation régénérables de ce travail ont été retirés, les preuves conservées, puis les 1 477 tests ont passé dans un répertoire temporaire propre. Ces interruptions restent distinctes des résultats applicatifs. Les avertissements Next sur les conventions middleware et le runtime Edge restent présents ; ils n'ont pas empêché les builds.

Commandes des tests de comportement :

```sh
node --max-old-space-size=256 --experimental-test-module-mocks --import tsx \
  --test --test-concurrency=1 \
  scripts/test-social-publication.mts \
  scripts/test-t06-social-autonomy.mts \
  scripts/test-social-multi-account.mts \
  scripts/test-social-multi-account-routes.mts

node --experimental-test-module-mocks --import tsx --test --test-concurrency=1 \
  scripts/test-release-oauth.mts scripts/test-t02-oauth-boundaries.mts \
  scripts/test-t06-final-social.mts scripts/test-t06-social-final.mts \
  scripts/test-zernio-oauth-contracts.mts

node scripts/test-social-multi-account-ui.mjs

SUTRA_TEST_PGLITE_ENTRY=/chemin/absolu/pglite/dist/index.js \
  node scripts/test-social-multi-account-migration.mjs
```

Le test navigateur accepte `SUTRA_UI_CHROMIUM_PATH` si un binaire local est fourni. Le test SQL exige un runtime PGlite vérifié séparément ; aucune dépendance de production n'est ajoutée. Un test natif PostgreSQL existe également dans les fixtures de récupération, mais ses courses entre processus n'ont pas été exécutées dans cet environnement.

Le scénario de migration accepte aussi `SUTRA_DISPOSABLE_DB=1` et une `DATABASE_URL_LOCAL` de boucle locale avec port explicite et base `sutra_ci_*`. Il vérifie la cible avant connexion, crée une base enfant isolée, refuse les rôles d'autorisation préexistants et nettoie ses objets avant tout résultat global PASS. Il est raccordé au service PostgreSQL natif du job `disposable-database` ; ce raccord ne vaut pas une preuve d'exécution distante.

Les contrôles reproductibles communs sont `node scripts/run-ci.mjs contracts`, `media`, `quality` et `browser-social`. Le premier inclut maintenant le planificateur promotionnel existant ; `browser-social` est aussi raccordé au workflow. Ce planificateur reste hors ligne : aucun raccord de production au catalogue, aux mandats commerciaux, à la cadence et au journal n'est établi par ce lot.

Le plafond de mémoire de test est optionnel : `SUTRA_CI_HEAP_MB=1792 node scripts/run-ci.mjs quality`. Seuls les entiers décimaux de 512 à 4096 Mio sont acceptés ; la variable absente ne change pas le comportement par défaut. Le lanceur construit ses options Node avec ce plafond et le garde réseau offline, sans recopier un `NODE_OPTIONS` arbitraire. Les quinze tests de ce helper font partie des contrats généraux.

Le parcours intégré démarre une application Next compilée et une base de test en boucle locale. Le lanceur conserve Chromium et WebKit par défaut. Un passage limité à un moteur annonce une couverture `PARTIEL`, la liste des moteurs non exécutés et `nativeSafari: false` :

```sh
SUTRA_CI_HEAP_MB=1792 SUTRA_CHROMIUM_PATH=/chemin/absolu/chromium \
  node qa/t07-final-ux-perf-20261015/run.mjs \
  --final-integrated --engine=chromium --out=/parent/existant/nouvelle-recette
```

La sélection comprend 14 scénarios Chromium ou 12 scénarios WebKit, soit 26 avec les deux moteurs. Le dossier de sortie explicite doit être neuf ; le lanceur refuse d'écraser une preuve existante. `--validate-cli` vérifie les options sans lancer de serveur, de build ou de navigateur. Les barrières réseau, de mutation et d'erreurs d'exécution restent actives dans les parcours.

Une reprise ciblée peut ajouter `--scenarios=final,journey` ; les scénarios absents restent listés dans le reçu et la couverture demeure `PARTIEL`, même avec les deux moteurs. Les comptes complets de 26/14/12 restent contrôlés séparément du nombre exact de scénarios sélectionnés. Les noms inconnus, doublons et listes vides sont refusés. Cette sélection sert à vérifier un défaut identifié sans écraser ni remplacer le résultat du premier passage.

Les fixtures de comptes et leurs sélecteurs suivent désormais les UUID, y compris dans les anciens parcours. Deux dépendances entre contrôles ont été retirées : le mode de panne d'authentification est rétabli par `finally`, et une nouvelle demande de production indépendante repart sans le reçu synthétique du contrôle précédent. Les rechargements, reprises et annulations à l'intérieur d'un même contrôle conservent leurs preuves et leurs assertions. Aucun délai d'attente ni contrôle de persistance n'a été assoupli pour ces corrections.

L'annotation publique du [run GitHub Actions 42741069423](https://github.com/puramapro-oss/sutra/actions/runs/42741069423) identifie le blocage avant démarrage : compte verrouillé pour un problème de facturation. Aucun réglage financier n'a été modifié. Les preuves locales restent distinctes de la validation distante.

L'installation `npm ci` a été interrompue dans cet environnement. Les dépendances utilisées pour les essais ont été restaurées séquentiellement depuis leurs archives de cache, vérifiées contre les intégrités du lockfile. Le paquet privé SMARANA a été restauré au commit verrouillé, avec vérification des blobs Git. Cela ne constitue pas un PASS de l'installation standard. Le téléchargement Chromium verrouillé a aussi échoué ; le navigateur existant cité ci-dessus a servi aux essais DOM.

## Conditions de mise en service

1. Intégrer cette proposition au-dessus de la pile de PR existante, sans écraser les corrections de la PR #8.
2. Qualifier le build Next et l'installation standard dans l'environnement de livraison, puis rapprocher le schéma réellement déployé avec les préconditions de la migration.
3. Suspendre les envois pendant la bascule ; conserver une sauvegarde vérifiée. Appliquer la migration additive avant d'autoriser l'ajout du deuxième compte et déployer les lecteurs multicomptes ensemble.
4. Faire la recette de deux chaînes réelles autorisées, d'une reconnexion, d'une révocation et d'une publication privée, puis constater compte, identifiant distant, visibilité et URL.
5. Enregistrer les mandats explicites des automatismes ; ouvrir progressivement les publications approuvées dans les limites réelles du fournisseur.

Après création de plusieurs comptes, rétablir l'ancienne contrainte singleton exigerait un traitement des données : aucun rollback destructif n'est prévu. En cas de problème, suspendre les envois et corriger en conservant les identités et les preuves.

La révocation locale bloque les nouveaux envois. Elle ne prouve pas l'annulation d'une publication déjà programmée chez un fournisseur. Les retraits distants, la suppression des données API, les plafonds de capacité par projet, les droits par variante et le rapprochement commercial doivent garder leurs critères distincts dans le cahier SUTRA.

## Reprise durable du lot — candidat suivant la réconciliation analytics

Ce lot part de `257b1bbeabc995a15cf7ffd85f75e44a16ab201c` (PR #12), qui conserve la qualification native de la PR #9 et les corrections analytics/CI. Il modifie l'entrée manuelle `/api/social/publish` et son suivi. Les deux automatismes gardent leurs contrôles de mandat et leur exécution existante ; aucune configuration automatique ancienne n'est activée par la migration.

### Contrat exécuté

- Le POST prépare toutes les destinations autorisées et enregistre leurs requêtes immuables en **un seul CAS**, avec phase `queued`. Aucun appel fournisseur de lecture, création ou reprise ne précède l'accusé durable. Une admission refusée ne rend pas un préfixe du lot exécutable.
- L'identité du lot est l'identité de production, déjà unique dans le journal. Un double enregistrement retrouve les mêmes opérations, clés et grants média. Une demande ne peut pas dépasser 50 destinations au total en ajoutant plusieurs sous-lots successifs.
- Le dispatcher réserve un journal dû avec `FOR UPDATE SKIP LOCKED`, un jeton et un bail de 240 secondes. La sauvegarde exige propriétaire, révision et bail encore valide selon l'heure PostgreSQL. Un ancien exécutant ne peut plus sauvegarder ni libérer un bail repris.
- Un passage traite une opération fournisseur. Les comptes jamais commencés passent avant les anciennes vérifications. Les réveils sont persistés ; la route traite au plus quatre réservations et ne commence plus d'opération après 70 secondes.
- `firstAttemptAt` est enregistré juste avant la frontière réseau. Une vidéo restée en file plus de 24 heures n'est donc pas confondue avec une soumission incertaine vieille de 24 heures. Après une réponse perdue, l'opération conserve sa clé, sa requête et la fenêtre prudente de reprise existante.
- La programmation passée est refusée au moment d'envoyer. Elle n'est jamais transformée silencieusement en publication immédiate.
- La réservation ne remplace pas l'autorisation : compte exact, profil actif, liaison Zernio et export vérifié sont relus. Les refus restent visibles dans le journal. Un compte ajouté plus tard ne rejoint pas le lot.
- Une reprise d'échec exige un ordre explicite enregistré à l'admission et consommé avant l'appel. Un ancien état d'échec ne libère pas la barrière `retrying`. Une opération legacy non sélectionnée peut être relue, mais ne reçoit pas implicitement un nouvel ordre de rejeu.
- La preuve de publication est conservée avant les projections. Le journal garde un réveil jusqu'à leur réparation et à la libération du bail. Les écritures d'historique et de calendrier sont regroupées en deux upserts au lieu de deux requêtes par destination.
- Un export remplacé ou supprimé bloque les nouveaux envois. Les posts déjà identifiés restent vérifiables ; le résultat de l'ancien export ne marque pas le nouvel export comme publié.

Le fournisseur documente une protection d'idempotence de création de 24 heures, indexée sur la clé seule, et un comportement synchrone si une programmation est déjà passée. Ces limites expliquent la conservation des requêtes et le blocage prudent au-delà de la fenêtre : [idempotence](https://docs.zernio.com/guides/idempotency), [création](https://docs.zernio.com/posts/create-post), [reprise](https://docs.zernio.com/posts/retry-post).

### Suivi navigateur et réponse API

`GET /api/social/publish?videoId=UUID` lit uniquement le journal du propriétaire connecté. Il renvoie un reçu privé non mis en cache, avec `batchId`, `durable`, `hasPending`, les destinations exactes et leurs résultats. Il n'expose ni requête fournisseur, ni URL média signée, ni clé d'idempotence, ni bail. Un succès partiel reste `hasPending:true` tant qu'une destination est en attente ; l'accusé POST reste alors HTTP202.

La fenêtre restaure le suivi après rechargement. Les lectures automatiques sont limitées à une requête à la fois, toutes les cinq secondes et au plus 60 lectures par ouverture ; elles s'arrêtent à la fermeture, au masquage et au changement de vidéo. Les succès restent conservés si une lecture ultérieure échoue ou régresse. Un `failed` lu seul n'active pas une reprise : un champ serveur distinct `canRequestRetry` propose seulement une action explicite, toujours revalidée à l'admission. Une identité externe différente ne devient jamais la cible de l'ancien ordre.

Les anciennes publications utilisent encore leur vérification `reconcileOnly`. Pour un journal durable, cette vérification lit le même reçu local et ne lance aucun appel fournisseur. Fermer la fenêtre ferme le suivi ; cela n'annule pas un lot déjà accepté.

### Livraison sur le serveur de destination

La migration additive est `migrations/20261110_social_durable_dispatch.sql`. Elle garde la table de journal existante, ses données et ses droits serveur. Elle ne crée aucun job de génération et n'affecte pas les quotas vidéo. Les journaux antérieurs commencent avec `dispatch_enabled=false`.

Le consommateur est `POST /api/cron/social-worker`, protégé par le `CRON_SECRET` existant. Le client `deploy/social_dispatch.py` accepte uniquement une URL HTTP de boucle locale vers cette route précise ; redirections, hôtes distants, identifiants dans l'URL et autres routes sont refusés. Les unités `social-dispatch.service` et `social-dispatch.timer` fournissent le raccord systemd. Le timer réveille le service 15 secondes après sa fin et ne le lance pas en parallèle avec lui-même.

Avant activation sur Hostinger ou un autre serveur Linux retenu :

1. Vérifier le commit livré, les trois jobs CI au même SHA, la sauvegarde restaurable et les préconditions du journal ; appliquer la migration avant le nouveau code.
2. Installer le script à l'emplacement indiqué par l'unité (ou adapter cet emplacement au déploiement existant), puis créer le fichier protégé `/etc/purama/sutra-social-worker.env`, lisible uniquement par l'administrateur. Il contient `SUTRA_SOCIAL_WORKER_URL=http://127.0.0.1:PORT/api/cron/social-worker` avec le port réellement constaté, et le même `CRON_SECRET` que l'application. Aucun secret ne figure dans le dépôt.
3. Installer les unités et vérifier leur configuration. Un appel du dispatcher sur une file vide doit confirmer zéro traitement. Cette vérification ne doit pas servir à déclencher des ordres réels inconnus.
4. Activer le timer après inspection des journaux admissibles et qualification d'une publication réelle autorisée. Vérifier le résultat réseau, sa visibilité, les identifiants des comptes et la reprise après arrêt contrôlé du service.

Le service d'observation historique reste strictement en lecture seule. Il n'est pas détourné en dispatcher. Pour suspendre les nouveaux passages, arrêter ce nouveau timer et son service ; conserver journal, clés et résultats. L'arrêt local ne prouve pas l'annulation d'une publication déjà reçue par le fournisseur. Un retour à l'ancien binaire doit conserver les colonnes et journaux durables et maintenir le dispatcher arrêté ; aucun rollback ne supprime les preuves.

### Qualification de ce candidat

Les nouveaux contrôles sont raccordés aux profils existants : contrats du journal/API/worker, navigateur social et recette PostgreSQL native. `deploy/test_social_dispatch.py` est inclus dans la découverte Python du workflow. Les preuves propres à ce lot sont conservées dans `qa/social-durable-20261110/`.

Les essais utilisent des comptes synthétiques et des transports simulés. Le test PostgreSQL démarre un cluster privé réel, exerce les courses entre clients et redémarre effectivement le serveur. Une preuve locale de ces mécanismes ne prouve ni l'installation du timer sur le serveur final, ni l'application de la migration distante, ni une publication sur un compte réel. Ces trois éléments restent à qualifier sur la cible disposant des accès.
