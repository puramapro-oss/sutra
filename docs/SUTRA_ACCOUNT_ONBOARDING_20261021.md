# SUTRA — préparation et contrôle du cycle de création des comptes

Lié à l’issue #4. Base examinée : `d3f36044ef42872495e0f79f9bca01ccf4fdfcde`.

## Statut exact

Ce lot ajoute un **noyau de planification testable**, pas une création universelle de comptes.
Aucun appel HTTP, navigateur automatisé, nouvelle dépendance, modèle, minuterie, migration,
modification d’un moteur existant, accès à un secret ou action de publication.
Aucun endpoint ni écran SUTRA n’appelle encore ce module. Il n’est pas activé en production.
`remoteExecutionAllowed` et `publicationAllowed` valent toujours `false`, même après revue.
Cette version ne doit donc JAMAIS être interprétée comme une permission de création distante.

Fichiers :
- `src/lib/social-account-onboarding.ts` : parsing strict, identités, clés de dossiers, capacités et décisions.
- `qa/account-onboarding/run.mjs` : compilation stricte isolée et tests Node, sans installation.
- `qa/account-onboarding/onboarding.test.cjs` : tests entièrement synthétiques.

## Améliorations livrées

1. Quinze plateformes nommées ; compte, chaîne, Page et bot ne sont pas interchangeables.
2. Routes distinctes : création accompagnée officielle, inscription OAuth accompagnée,
   revue d’une instance et connexion d’un compte existant. Aucune route de contournement.
3. Identité propriétaire et organisation exactes. Le mode personnel est limité au propriétaire
   configuré ; le mode client ne reçoit aucun accès au calcul ou aux comptes personnels.
4. Dossier lié à sa plateforme, son type, son action, son édition, sa langue, son mode, son
   instance et l’empreinte du profil demandé. Un changement invalide l’accord correspondant.
5. Revue de politique versionnée, datée et expirante. Ancienneté maximale de 30 jours dans ce lot ;
   il s’agit d’un choix interne prudent, pas d’une règle universelle des plateformes.
6. Mandat propriétaire explicite, périmètre exact, révocation et expiration contrôlés.
7. Quotas évalués récemment (au plus cinq minutes dans ce lot). Un quota épuisé ne déclenche
   pas la création d’un compte de remplacement. Ce contrôle ne réserve PAS le quota à distance.
8. Une tentative en cours, ambiguë ou déjà confirmée impose une réconciliation/réutilisation,
   pas une nouvelle création. Ce lot ne stocke pas le journal et ne prouve pas un exactly-once distant.
9. Instances HTTPS canoniques et liste d’autorisation exacte. Les IP explicites, identifiants dans
   l’URL, chemins, paramètres et ports non standard sont refusés. Aucun réseau n’est contacté.
10. Sorties sérialisables sans mot de passe ni jeton ; entrées inconnues rejetées ; fonctionnement
    déterministe, sans tâches de fond et sans chargement de modèle.

Les contrôles d’URL ne constituent PAS à eux seuls une protection SSRF : les futurs adaptateurs
nécessiteront validation DNS/IP après résolution, contrôle de chaque redirection, protections contre
le rebinding et règles réseau de sortie. Une instance approuvée n’est pas une preuve de droit administrateur.

## Contrat de confiance indispensable

`TrustedOnboardingContext` est construit UNIQUEMENT côté serveur :
- identité Supabase réellement vérifiée, puis contrôle du profil actif existant (`account-access.ts`) ;
- tenant et propriétaire issus de données autorisées, jamais des assertions d’un navigateur ;
- statut d’accès, politiques, mandats, quotas et tentatives relus dans le stockage de confiance ;
- `profileDigest` recomputé sur un manifeste canonique côté serveur ;
- indicateur d’activation côté serveur, désactivé tant que l’intégration n’est pas validée.

Ne pas exposer une route qui accepte le contexte de confiance ou un mandat complet fourni par le client.
La clé déterministe n’est ni un secret ni une signature. Le parseur n’établit pas l’authenticité d’un mandat.
La validation de code ne remplace ni consentement fournisseur, ni permission de plateforme, ni revue des droits.
Le statut `USER_ACTION_REQUIRED` ouvre seulement un parcours accompagné. Il ne donne pas le droit de
piloter le site à la place de l’utilisateur ni de passer ses contrôles. `CONNECTOR_REVIEW_REQUIRED`
indique une intégration encore absente ; il ne signifie pas « compte connecté ».

## Routes conservatrices

| Réseau | Types proposés | Création dans cette version |
|---|---|---|
| YouTube | chaîne | accompagnée, aucune méthode publique de création présumée |
| Instagram, Threads, TikTok, X, Pinterest, Snapchat, Reddit | compte | accompagnée, aucun automate de formulaires |
| Facebook, LinkedIn | compte ou Page | accompagnée ; accès partenaire éventuel à qualifier séparément |
| Discord | bot | parcours officiel de l’application ; aucun self-bot utilisateur |
| Telegram | compte, canal ou bot | accompagnée ; identité/session et type d’API à qualifier |
| Bluesky/AT Protocol | compte + instance | inscription OAuth accompagnée, sous les règles du PDS |
| Mastodon | compte + instance | revue de version, inscriptions et permissions de l’instance |
| PeerTube | compte ou chaîne + instance | revue des permissions et du contrat du serveur |

Ce tableau est un classement logiciel prudent, pas un inventaire d’API déjà implémentées ni un avis juridique.
Pour chaque plateforme et type, la connexion à un compte existant reste une opération séparée.
Le catalogue n’accorde aucun quota et n’autorise aucune création de nouveaux comptes après un refus ou une sanction.

## Exécution reproductible des tests

Depuis la racine du dépôt :

```sh
node qa/account-onboarding/run.mjs
```

Le script utilise TypeScript déjà installé dans le dépôt, ou un `tsc` global existant ;
il ne lance pas npm/npx pour installer des dépendances. Il compile uniquement ce module en
strict avec `noUncheckedIndexedAccess` et `exactOptionalPropertyTypes`, puis exécute les tests
via `node --test`. Seul son propre répertoire temporaire est supprimé à la fin.

Mesure locale du 21 octobre 2026 : **80 tests PASS, 0 FAIL, 0 SKIP**.
Environnement réellement utilisé : Node `v22.16.0`, TypeScript `5.6.3`.
Le dépôt exige Node 24 ou 26 : la suite doit être rejouée sur cet environnement avant fusion.
Le test de 1 000 éditions est un test synthétique de planification et d’unicité, pas une charge
réseau, une création de comptes ou une preuve d’autorisation d’en exploiter 1 000.

Non exécutés : build Next.js complet, lint global, CI du dépôt, navigateur, tests OAuth réels,
base PostgreSQL, création de compte distant, génération GPU, publication et endurance 24/7.
Aucun résultat de ces domaines n’est revendiqué.

## Intégration restante — ordre sans doublon

- T1 : réconcilier le SHA actuel et les réservations ; intégrer ce lot seulement après revue.
  Ce lot n’affecte ni les neuf worktrees ni leurs verrous.
- T2/T6 : assembler le contexte côté serveur avec les contrôles existants ; écran de dossiers,
  consentements et reprise après intervention du propriétaire. Ne jamais accepter de faux booléens d’autorité.
- T3 : raccorder un journal durable, avec unicité et transitions atomiques par clé, afin qu’une double
  soumission concurrente ne crée pas deux tentatives. Ne pas recycler aveuglément les clés du journal de publications.
- T4 : qualifier les applications, versions et permissions réelles par réseau ; développer chaque
  adaptateur seulement après validation. Un endpoint vu sur GitHub n’est pas une permission d’usage.
- T7 : signaler les étapes attendues, sans boucles rapides, rotation de comptes ou relance de résultat ambigu.
- T8 : rejouer sur Node supporté, tester authentification/RLS, concurrence, révocation, expiration,
  CSRF/OAuth state/PKCE, SSRF, panne après émission et avant accusé, puis parcours réel limité autorisé.
- T9 : aucun changement au moteur personnel WanGP ; pas de dépendance artificielle à un test GPU.

Ne pas fusionner vers la production ni créer de compte avec ce lot. L’autonomie de publication,
le multi-destination et les améliorations éditoriales de l’issue #4 restent des chantiers distincts.

## Sources primaires et prudence de version

- https://developers.google.com/youtube/v3/docs/channels — méthodes publiques de chaînes.
- https://atproto.com/blog/network-account-management — inscription dans le parcours OAuth/PDS.
- https://docs.joinmastodon.org/methods/accounts/ — création/inscription, permissions et versions.
- https://help.x.com/en/rules-and-policies/x-automation — restriction de l’automatisation hors API.
- https://github.com/bluesky-social/atproto/blob/main/lexicons/com/atproto/server/createAccount.json — schéma de protocole, pas permission universelle.
- https://github.com/Chocobozzz/PeerTube/blob/develop/server/core/controllers/api/users/registrations.ts — contrôles d’inscription du serveur.

Les quatre premières pages ont été relues pendant ce lot. La page Mastodon accessible décrit encore
`POST /api/v1/accounts` ; elle ne permet pas de confirmer la suppression en version 5 évoquée dans
une réponse précédente. Pour cette raison, ce module ne fige aucun endpoint d’inscription Mastodon
et exige une revue du serveur réel. Les références de code et les autres règles doivent être
revalidées pour la version de chaque adaptateur avant activation.
