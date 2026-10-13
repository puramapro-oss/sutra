# SUTRA T06 — comptes, consentements et reprise sociale

Audit du 13 octobre 2026, base `48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4`, branche `codex/sutra-t06-provider-audit-20261013`. **BLOQUÉ pour une connexion/publication sociale réelle.** Revue du code et des documents officiels ; aucune connexion de compte, lecture de jeton, publication ou mutation distante par T06.

T01/T04 possèdent les sondes depuis le fichier maître et le contrôle Mac/OVH ; T08 les contre-tests OAuth et les gates communes ; T02 les limites de sécurité ; T05 Shotstack. T06 ne les duplique pas. Le complément n'édite aucun fichier produit. Les preuves de la mission précédente sont conservées ; leurs PASS simulés ne certifient pas les contrats distants actuels.

## Contrat OAuth et séparation des propriétaires

| Contrôle | Constat sur la base examinée | Verdict |
| --- | --- | --- |
| Initiation | `zernio.ts:getOAuthUrl` appelle `/oauth/url` avec `user_id`, `redirect_uri`, puis lit `url`. L'API actuelle documente `/connect/{platform}`, `profileId`, `redirect_url`, réponse `authUrl`. `x` doit devenir `twitter`. | BLOQUÉ |
| Callback | La route exige `code/state/platform`, alors que le flux hébergé documenté retourne `connected/profileId/accountId/username`. Ne pas accepter ces paramètres comme preuve d'appartenance sans relire le compte distant. | BLOQUÉ |
| State | Hash SHA-256 du state et d'un secret navigateur aléatoire de 32 octets ; TTL 600 s ; consommation atomique DELETE RETURNING filtrée par utilisateur, plateforme, navigateur et expiration. Échec DB fermé. Cookie HttpOnly, Lax, Secure en HTTPS, chemin `/api/social`. | Contrôle local présent ; parcours fournisseur non qualifié |
| Session | `getUser()` vérifié à l'initiation et au callback. La corrélation porte sur le même utilisateur et navigateur ; aucun identifiant de session distinct n'est stocké. | Liaison utilisateur/navigateur présente, liaison à une session précise absente |
| Organisation | Aucun mapping serveur utilisateur/organisation ↔ profil Zernio, ni vérification distante de ce profil au callback. Le `user_id` envoyé ne remplace pas `profileId`. | BLOQUÉ multi-tenant |
| Permissions | Aucun `scopes` dans la requête actuelle. La référence permet `scopes=posting` pour les plateformes compatibles ; cela conserve certains scopes d'identité, renouvellement et sélection imposés par Zernio. | Minimisation non implémentée |
| Destination | Callback construit depuis `NEXT_PUBLIC_SITE_URL` ou défaut `https://sutra.purama.dev/api/social/callback`. URL d'autorisation contrôlée HTTPS sans identifiants, mais pas de liste d'hôtes autorisés. | Origine et contrat à qualifier avant activation |

Références : [contrat connect](https://docs.zernio.com/connect/get-connect-url), [isolation par profil](https://docs.zernio.com/multi-tenant). La référence d'endpoint expose la réduction des scopes ; les guides plus généraux ne suffisent pas à garantir le consentement réellement présenté. Aucun consentement n'a été déclenché pour le vérifier.

## Expiration, rotation et révocation

- Le journal refuse les comptes absents, ambigus, déconnectés, révoqués, expirés ou à date invalide. Une expiration absente est acceptée : ce n'est pas une preuve de validité distante.
- `refreshAccessToken` existe mais n'a aucun consommateur dans `src`. Son endpoint `/oauth/refresh` n'est pas qualifié. Aucun raccord trouvé à la santé distante du compte ou à `account.disconnected` ; `ZERNIO_WEBHOOK_SECRET` présent dans un fichier de configuration ne prouverait pas ce raccord.
- `revokeSocialAccount` marque d'abord le compte local `revoked`, avec comparaison de l'identité du compte, puis tente DELETE Zernio. Une panne distante reste `remoteStatus=unconfirmed` (HTTP 202 dans la route). Le compte et ses relations historiques sont conservés. Les champs `access_token`, `refresh_token`, `token_expires_at` ne sont pas effacés par cette fonction.
- Les tokens ne sont pas sélectionnés par GET `/api/social/accounts`. Le callback peut les écrire en texte dans la table ; les migrations T02 restreignent leur lecture aux rôles autorisés. Cela ne constitue pas une preuve de chiffrement applicatif ni de rotation effective. Le contrôle des erreurs brutes de GET appartient au correctif T02 en cours.
- DELETE Zernio confirmé signifie déconnexion côté agrégateur. La révocation du consentement chez chaque réseau et l'invalidation effective des anciens tokens ne sont pas démontrées par ce retour. Aucun DELETE réel effectué.

Références : [santé du compte](https://docs.zernio.com/accounts/get-account-health), [déconnexion](https://docs.zernio.com/accounts/delete-account). Une future reprise devra lire les permissions réellement accordées et les expirations, traiter les événements signés et conserver les résultats distants déjà acquis.

## Idempotence et état partiellement publié conservés

Le journal conserve l'identité production/type/utilisateur et chaque destination plateforme/compte externe. CAS de révision, bail 120 s, payload et clé persistés avant l'envoi. Une réponse perdue autorise seulement le replay identique dans la fenêtre prudente de 24 h moins 5 min ; une programmation déjà échue n'est pas transformée en publication immédiate. Le contrat Zernio documente une clé d'idempotence valable 24 h : [création](https://docs.zernio.com/posts/create-post).

Le statut distant et l'ensemble exact des destinations sont contrôlés avant retry. Un résultat `published` acquis reste conservé face à une réponse plus ancienne ; l'incertitude n'est pas transformée en réussite. Une réponse perdue du retry reste `retrying` sans nouveau POST automatique. Média final vérifié URL/SHA-256, autorisation/approbation, profil et compte actifs sont relus avant et après le claim, y compris pour replay/retry. La révocation laisse possible le GET de réconciliation, sans autoriser une nouvelle publication. Calendrier IANA, changements d'heure, récurrences et déduplication PR2 ne sont pas modifiés.

Limites nouvelles de contrat à traiter avant activation : le payload actuel n'exprime pas `tiktokSettings` ni les choix/confirmations individuels requis par le [contrat TikTok](https://docs.zernio.com/platforms/tiktok). Ne jamais fabriquer un consentement en fixant ces champs à vrai. Pinterest ne reçoit pas de `boardId` explicite ; le choix de tableau doit être garanti avant publication. Les contrats simulés historiques ne couvrent pas ces obligations distantes.

## Actions de connexion réservées à l'utilisateur

**Après correction et qualification du raccord OAuth**, sélectionner seulement les réseaux souhaités et vérifier le compte/destination affiché. Zernio héberge le consentement ; SUTRA doit assurer le rattachement serveur au profil autorisé. Aucun besoin démontré de créer dix applications OAuth natives ou de fournir leurs secrets à SUTRA.

| Réseau choisi | Action humaine nécessaire |
| --- | --- |
| YouTube | Autoriser le compte Google et choisir la chaîne voulue dans le parcours Zernio. |
| Facebook | Autoriser le compte administrateur puis sélectionner la Page voulue. |
| Instagram | Choisir un compte Business/Creator ; Instagram Login fonctionne sans Page Facebook. Si Facebook Login est choisi, sélectionner la Page liée. [Contrat](https://docs.zernio.com/platforms/instagram) |
| X | Autoriser le bon compte ; identifiant API `twitter`. |
| LinkedIn | Choisir le profil personnel ou l'organisation administrée après OAuth. [Contrat](https://docs.zernio.com/platforms/linkedin) |
| TikTok | Autoriser le bon compte, puis confirmer pour chaque média aperçu, confidentialité, interactions et consentement de publication. Ne pas remplacer un compte par erreur lors d'une reconnexion. [Contrat](https://docs.zernio.com/platforms/tiktok) |
| Pinterest | Choisir explicitement le tableau destiné à recevoir les contenus. [Contrat](https://docs.zernio.com/platforms/pinterest) |
| Reddit / Threads | Autoriser le compte souhaité ; choisir la destination Reddit avant publication. |
| Bluesky | Créer un mot de passe d'application dédié dans [les réglages Bluesky](https://bsky.app/settings/app-passwords), puis l'utiliser uniquement dans le parcours prévu ; aucun OAuth générique. [Contrat Zernio](https://docs.zernio.com/platforms/bluesky) |

Ne pas présenter Snapchat, Tumblr, Mastodon ou Vimeo comme connecteurs SUTRA publiables : ils sont proposés par certaines listes UI/API mais exclus du payload de publication. Une autorisation de compte ne remplace jamais l'approbation du média ni la qualification de ces connecteurs.

Réglage cible de l'initiation : zone `posting` uniquement, pas de zones analytics, comments, messaging ou ads sans besoin explicite. Les permissions natives exactes restent celles imposées et affichées pour la plateforme choisie ; l'utilisateur peut refuser. Une nouvelle autorisation doit rester rattachée au même profil/compte attendu. L'ancien historique ne doit pas être remplacé par une autre identité.

## Portée des preuves

`source-manifest.json` enregistre les empreintes des fichiers examinés et leur égalité avec T01. Le graphe GitNexus interrogé `sutra-t01-20261012` était en retard de six commits : navigation indicative uniquement, revue directe des sources pour les conclusions. Aucun symbole produit édité, donc aucune nouvelle analyse d'impact produit à faire. `detect_changes` reste exécuté avant le commit documentaire.

Les nouvelles preuves gratuites sont produites par leurs propriétaires T01/T04/T08/T02/T05 ; la synthèse finale T06 référence leurs sorties exactes sans multiplier les appels ni transformer leurs échecs de contrat en PASS. Aucun secret ou fichier `.env.local` n'est créé ou copié par T06.
