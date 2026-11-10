# SUTRA multicomptes et autorisations de publication

## Résultat et périmètre

Cette extension permet de conserver plusieurs comptes d'un même réseau, de les sélectionner séparément et de publier par destination avec le journal durable existant. Elle s'appuie sur la PR #8, branche `repair/sutra-security-20261109`, commit `9f876cbcc5fe667209a369a8ee64c109ab043173`.

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

Les UUID ci-dessus sont des marqueurs explicatifs à remplacer par de véritables UUID. L'API accepte au plus 50 comptes par demande, refuse les doublons et exige une correspondance exacte avec les plateformes annoncées. Elle refuse de mélanger `destinations` et l'ancien objet `accountIds`.

L'ancien format à un compte par réseau demeure compatible. Une sélection implicite par réseau exige un compte connecté unique ; elle ne peut pas choisir arbitrairement une chaîne ni reprendre une ancienne opération devenue ambiguë.

Une nouvelle opération de journal porte sur une destination, avec requête immuable, compte local, identifiant fournisseur et clé d'idempotence. Les résultats exposent `localAccountId` pour distinguer deux chaînes du même réseau, y compris lorsqu'une sélection est refusée avant tout envoi.

Les garanties contrôlées sont les suivantes :

- Aucune nouvelle identité ni nouvelle clé après un timeout ambigu.
- Vérification du propriétaire, du profil et des autorisations avant et après réservation.
- Un succès de A reste visible si B échoue, perd sa connexion ou doit être reconnecté.
- Une reprise conserve le post et la requête d'origine ; elle ne republie pas les comptes déjà confirmés.
- Un ancien post groupé peut reprendre B échoué sans sélectionner à nouveau A déjà publié. Les autres destinations inachevées doivent rester sélectionnées et autorisées.
- Après une reprise incertaine, un ancien état distant `failed` ne devient pas la preuve d'un nouvel échec. Le journal conserve la barrière `retrying` tant que l'issue n'est pas établie.
- Le média vérifié et son empreinte restent immuables pour une production. Cette extension ne contourne pas cette règle pour simuler des recadrages.

## Deux automatismes raccordés

Les parcours existants utilisent deux configurations : `public.social_autopilot_config` après création d'une vidéo, et `sutra.sutra_auto_config` pour les vidéos autonomes. Les deux stockent maintenant `publish_account_ids` et relisent ces autorisations avant l'envoi.

La migration initialise cette liste à vide. Aucun compte nouvellement connecté, ni aucune ancienne sélection de réseau, n'autorise implicitement de nouveaux envois. Les utilisateurs doivent enregistrer leurs destinations précises dans `/settings/social` ou `/auto/settings`.

Une désactivation demeure possible même si un compte enregistré a disparu. Toute réactivation revalide les comptes sélectionnés. Les autres réglages, notamment les plannings et l'approbation préalable des vidéos, conservent leur fonctionnement existant.

## Recette et preuves

Les tests utilisent des identités synthétiques et des fournisseurs simulés, sans publication ni dépense. Les résultats détaillés du candidat sont consignés dans le bilan de la PR.

| Contrôle | Périmètre réel |
| --- | --- |
| Tests du journal et de l'autonomie | Modules réels, base en mémoire, transports simulés ; concurrence logique, révocation, succès partiels et reprises |
| Tests API et OAuth | Handlers réels avec session, base et fournisseur simulés ; validation, isolation et compte de reconnexion exact |
| Test navigateur | Composants React réels dans un hôte isolé ; navigation, authentification et API simulées ; Chromium 147.0.7727.0 |
| Test de migration | PostgreSQL 18.3 via PGlite 0.5.8 ; contraintes, lignes, historique, ACL, RLS, triggers et seconde application |
| TypeScript et lint | Analyse statique ; ne remplace ni un build Next complet ni la recette des comptes réels |

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

L'installation `npm ci` a été interrompue dans cet environnement. Les dépendances utilisées pour les essais ont été restaurées séquentiellement depuis leurs archives de cache, vérifiées contre les intégrités du lockfile. Le paquet privé SMARANA a été restauré au commit verrouillé, avec vérification des blobs Git. Cela ne constitue pas un PASS de l'installation standard. Le téléchargement Chromium verrouillé a aussi échoué ; le navigateur existant cité ci-dessus a servi aux essais DOM.

## Conditions de mise en service

1. Intégrer cette proposition au-dessus de la pile de PR existante, sans écraser les corrections de la PR #8.
2. Qualifier le build Next et l'installation standard dans l'environnement de livraison, puis rapprocher le schéma réellement déployé avec les préconditions de la migration.
3. Suspendre les envois pendant la bascule ; conserver une sauvegarde vérifiée. Appliquer la migration additive avant d'autoriser l'ajout du deuxième compte et déployer les lecteurs multicomptes ensemble.
4. Faire la recette de deux chaînes réelles autorisées, d'une reconnexion, d'une révocation et d'une publication privée, puis constater compte, identifiant distant, visibilité et URL.
5. Enregistrer les mandats explicites des automatismes ; ouvrir progressivement les publications approuvées dans les limites réelles du fournisseur.

Après création de plusieurs comptes, rétablir l'ancienne contrainte singleton exigerait un traitement des données : aucun rollback destructif n'est prévu. En cas de problème, suspendre les envois et corriger en conservant les identités et les preuves.

La révocation locale bloque les nouveaux envois. Elle ne prouve pas l'annulation d'une publication déjà programmée chez un fournisseur. Les retraits distants, la suppression des données API, les plafonds de capacité par projet, les droits par variante et le rapprochement commercial doivent garder leurs critères distincts dans le cahier SUTRA.
