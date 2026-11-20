# OAuth Zernio — délégation unique T01 — 2026-10-13

Statut : **INTÉGRÉ / TESTÉ LOCAL** pour T08 Z01–Z04. **NON TESTÉ réel** : aucun consentement, compte connecté, token fournisseur, appel authentifié ou publication. Aucun commit autonome ; T01 porte la gate et le commit final. Base `48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4`, worktree `sutra-final-providers-20261013`.

## Corrections livrées

- Contrat officiel `GET /connect/{platform}` avec `profileId`, `redirect_url`, `scopes=posting`, parsing `authUrl`, mapping SUTRA `x` → Zernio `twitter`. Suppression des endpoints OAuth exchange/refresh non documentés.
- Attribution explicite côté serveur par `ZERNIO_PROFILE_BINDINGS` (JSON UUID Supabase → profileId Zernio de 24 caractères hexadécimaux). Refus si absent, invalide, utilisateur absent ou profil partagé ; aucun choix automatique du premier profil. Le client ne peut fournir son propre profil.
- State SUTRA aléatoire, indépendant du state interne Zernio, conservé dans `redirect_url`. Empreinte liée au profil, à la session vérifiée par Supabase `getClaims()` et au propriétaire authentifié, à la plateforme et au secret navigateur HttpOnly. TTL 600 s, consommation atomique unique. Aucun changement de schéma nécessaire ; les anciens états non liés échouent fermés et expirent.
- Callback hébergé `connected/profileId/accountId` : validation session/utilisateur/profil/plateforme puis consommation du state, puis `GET /accounts?profileId`. Un seul compte serveur doit correspondre à l'ID, au profil, à la plateforme et être actif. Le nom transmis par le callback n'est jamais une preuve d'identité.
- Aucun token de callback/fournisseur enregistré. Les colonnes locales access/refresh/expiry sont nulles à la connexion ; les métadonnées identifient uniquement le profil et Zernio comme détenteur des credentials. Pas de purge ou rotation de credentials historiques, pas de migration.
- URLs publiques calculées avec `publicOrigin`, donc priorité `NEXT_PUBLIC_APP_URL` puis `NEXT_PUBLIC_SITE_URL`, jamais les en-têtes proxy fournis par le client. Requêtes OAuth GET bornées à 20 s, sans retry ni suivi de redirection ; erreurs publiques génériques et JSON borné.

## Preuves gratuites

Commande, Node 26.0.0, pare-feu réseau T08, fixtures synthétiques exclusivement :

```sh
node --require ./qa/t08/offline.cjs --experimental-test-module-mocks --import tsx --test scripts/test-release-oauth.mts scripts/test-zernio-oauth-contracts.mts scripts/test-t02-oauth-boundaries.mts scripts/test-security-routes.mts qa/t08/providers-20261013/provider-contract-redteam.test.mts
```

**41 PASS, 0 FAIL, 0 SKIP** : Z01–Z04, S01/S02 (Suno appartient à T01), concurrence/rejeu/expiration/navigateur/autre utilisateur/autre session/autre profil, profils non attribués/dupliqués, identités de compte falsifiées/inactives/dupliquées, absence de tokens, redaction des erreurs, scopes/GET/mapping et origine publique. La fixture T02 mocke désormais les deux entrées ESM/CJS de Supabase ; tsx charge l'entrée CJS des routes.

```sh
node node_modules/eslint/bin/eslint.js src/lib/zernio.ts src/lib/social-oauth-state.ts src/app/api/social/connect/route.ts src/app/api/social/callback/route.ts scripts/test-release-oauth.mts scripts/test-t02-oauth-boundaries.mts scripts/test-security-routes.mts scripts/test-zernio-oauth-contracts.mts qa/t08/providers-20261013/provider-contract-redteam.test.mts
```

**PASS, zéro diagnostic**. Gate complète TypeScript/lint/build/intégration et `detect_changes` final : responsabilité T01, ne sont pas revendiqués par ce rapport ciblé.

GitNexus impact exécuté avant modification : `getOAuthUrl`, `exchangeOAuthCode`, `refreshAccessToken`, `issueSocialOAuthState`, `consumeSocialOAuthState`, `POST` connect et `GET` callback. Graphe : 1 appelant direct/LOW pour adaptateurs et state, UNKNOWN sans arêtes pour routes et refresh. `getAuthorizedProfileId` nouveau n'existe pas dans l'index de base. Références textuelles complétées (routes Next, UI settings/social, tests) ; index base frais mais flows tronqués, ce n'est pas une certification exhaustive. Risque sécurité **CRITICAL** signalé au coordinateur avant édition.

## Actions indispensables et limites

1. Un administrateur doit attribuer explicitement un profil Zernio à chaque UUID utilisateur SUTRA autorisé, puis configurer **`ZERNIO_PROFILE_BINDINGS` côté serveur** dans la source sécurisée, sans écraser une valeur applicative prioritaire. Utiliser le profil du client/organisation concerné, jamais le premier profil de l'équipe. [Organisation multi-tenant officielle](https://docs.zernio.com/multi-tenant).
2. Chaque utilisateur doit ouvrir Connecter et accorder lui-même le consentement hébergé pour ses réseaux, puis choisir page/organisation/tableau lorsque le fournisseur le demande. SUTRA demande uniquement `posting`. [Connexion des comptes](https://docs.zernio.com/guides/connecting-accounts), [contrat GET connect](https://docs.zernio.com/connect/get-connect-url).
3. Le flow couvert concerne TikTok, YouTube, Instagram, Facebook, X/Twitter, LinkedIn, Pinterest, Reddit et Threads. Les connecteurs historiques Bluesky/Snapchat/Tumblr/Mastodon/Vimeo ne sont pas certifiés par cette correction ; l'API les refuse au lieu d'inventer des scopes. L'affichage UI historique relève de T01 si ajustement nécessaire.

Zernio gère le stockage et le renouvellement des tokens sociaux ; aucune API de refresh arbitraire n'est appelée. Une révocation ou expiration fournisseur nécessitant un nouveau consentement reste une action utilisateur. Cette preuve locale ne certifie ni un consentement réel, ni la santé d'un compte existant, ni une configuration distante. Aucun service/terminal fermé, aucun WIP étranger supprimé ou écrasé, aucun fichier de secrets lu par ce délégué.
