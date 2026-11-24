# T06 — audit social final hors réseau, 14 octobre 2026

**24 PASS, 1 FAIL, 0 SKIP : reconnexion UI bloquée après révocation.** Le test rouge constitue une preuve pour T01, pas une gate verte. Périmètre utilisateur : nouveaux tests et handoff uniquement, aucun correctif OAuth ou produit autorisé à T06 dans ce lot.

Branche `codex/sutra-t06-social-final-20261014`, worktree isolé `sutra-t06-social-final-20261014`, base documentaire `14617333bfb21efe1f2a1c91888d3322dde20f5b`, application `e3b17117256269e281304cd4ab83bc722a6f7894`. Source actuelle lue, aucun ancien bilan 48f2d5e utilisé comme verdict. T01 a depuis livré `57e40428124850cbd1463538e7d9673069ceed64` : modifications limitées à ses preuves/configuration, aucun changement des sources testées. Son rapport `qa/provider-activation-20261014/README.md` confirme le binding autorisé et les GET fournisseurs. Ces faits proviennent de T01 ; aucune sonde rejouée par T06.

## Vérification nouvelle

La suite assemble les **vraies routes** connect/callback/accounts, consommation de state, **vrai adaptateur Zernio**, journal et projections publication ; seule l'authentification/session, la base et la couche HTTP sont simulées. Le limiteur est remplacé par un résultat non limité et n'est pas requalifié. Réutilisation du helper canonique `scripts/helpers/social-database.mts`, avec pont pour DELETE RETURNING OAuth atomique et upsert `(user_id,platform)`. La fixture mémoire ne remplace pas les preuves SQL/RLS de T01.

- Neuf connecteurs : vrai contrat hosted `GET /connect/{platform}` (`x` → `twitter`), `profileId`, `redirect_url`, `scopes=posting`, réponse `authUrl`. State local persisté avant l'appel, cookie HttpOnly/Secure/SameSite=Lax, chemin `/api/social`, TTL 600 s. Vérification distante du compte actif dans le profil attribué avant upsert.
- Absence de binding et tentative de profil/organisation injectés ; changement de session ; expiration ; double callback concurrent ; identité distante dans un autre profil : refus ou consommation unique vérifiés ensemble avec l'adaptateur.
- Jetons fournisseur jamais conservés : access/refresh/expiry locaux nuls, `credential_owner=zernio`. Rotation/rafraîchissement des jetons natifs délégués à Zernio ; **rotation réelle NON TESTÉE**. La confirmation utilisateur PURAMA autorise la liaison faite par T01 ; le code lie UUID utilisateur + profil, sans champ organisation arbitraire accepté du navigateur.
- Publication : intention durable avant POST, réponse perdue conservée inconnue, lease sans POST supplémentaire, reprise du même corps et de la même clé, GET du post connu, aucune nouvelle émission après succès. Clés distinctes pour deux productions ou deux identités externes de compte.
- Compte manquant : résultat partiel conservé ; consentement suivant reprend uniquement la destination manquante. Reconnexion d'un autre compte sous la même ligne locale : sélection explicite requise, historique du premier conservé.
- Révocation : autre utilisateur refusé ; révocation locale avant DELETE distant ; HTTP503 simulé → API202 `remoteStatus=unconfirmed`, sans retry DELETE automatique ; historique conservé et replay POST bloqué. GET de réconciliation encore possible après révocation et arrêt de l'autonomie.
- Faux compte dans le statut distant, révocation pendant la réservation, média sans preuve et autonomie sans approbation : aucun POST non autorisé.

Le transport ne délègue jamais à fetch réel. La garde existante `qa/t08/offline.cjs` interdit les sockets distantes et les lectures `.env*`. Les échecs d'assertion du transport restent des échecs de test même si l'application assainit les erreurs. Toutes les variables du test sont des constantes synthétiques du fichier ; aucune variable maître/runtime ni `.env.local` lue, copiée ou créée. Aucun consentement, rendu, publication, GPU, SSH ou déploiement.

## Défaut transmis à T01

`T06-FINAL UI regression: a revoked account must expose Se connecter again` échoue : après vrai DELETE + GET simulés, le compte conservé vaut `status=revoked`, mais `PlatformGrid` calcule `isConnected = !!account`. Le HTML SSR contient toujours « Connecte » / « Deconnecter », sans `connect-youtube`. `settings/social/page.tsx` place également toutes les lignes dans `accountsByPlatform` et les compte comme connectées.

**Conséquence : première connexion possible sur une plateforme vide ; reconnexion d'un compte révoqué inaccessible par ce parcours UI.** Protection serveur maintenue : aucun replay après révocation. Correction à router par T01 au propriétaire UI ; ne pas supprimer la ligne historique pour contourner le défaut. Le test doit devenir vert après correction de la projection des états, sans modifier OAuth.

Constat supplémentaire de source, distinct du test rouge : `handleDisconnect` traite tout `res.ok`, y compris 202, comme « deconnecte », sans afficher `remoteStatus=unconfirmed`. L'interface doit distinguer blocage local et révocation distante non confirmée. Pas de preuve navigateur/visuelle dans ce lot : SSR seulement.

## Commandes et preuves

Node utilisé : v24 (binaire local disponible, aucune installation). Dépendances existantes réutilisées par lien symbolique ignoré ; package.json et lockfile identiques à la base. Aucune gate globale/build ni ancien PASS inchangé rejoué.

```sh
node --require ./qa/t08/offline.cjs --experimental-test-module-mocks --import tsx --test --test-reporter=tap scripts/test-t06-social-final.mts
./node_modules/.bin/tsc --noEmit -p qa/t06-social-final-20261014/tsconfig.json
./node_modules/.bin/eslint scripts/test-t06-social-final.mts
gitleaks git --pre-commit --staged --redact=100 --no-banner --no-color
```

- `contracts.tap` : 25 cas, 24 PASS / **1 FAIL**, exit 1 ; aucun todo/skip. Erreur de matcher du test d'approbation corrigée avant le résultat final (code réel `SUTRA_AUTO_PUBLICATION_NOT_AUTHORIZED`).
- `typecheck.txt`, `lint.txt` : sorties vides, exit 0 ; ciblage du nouveau test et de ses imports, pas de compilation globale.
- `manifest.json` : commandes/exit codes et empreintes des sources, dépendances et harnais ; `security.txt` : scan du delta expurgé.
- Deux alertes initiales du scanner concernaient des SHA-256 de fichiers source dans le manifeste, recalculés et vérifiés (`security-findings.json`, expurgé ; `security-triage.json`). Manifeste sérialisé en entrées fichier/empreinte pour lever cette ambiguïté ; aucune exclusion du scanner ajoutée.
- GitNexus : `getOAuthUrl`, `consumeSocialOAuthState`, `revokeSocialAccount` LOW (un appelant direct chacun) ; `runPublicationJournal` HIGH (sept symboles touchés, deux appelants directs), signalé avant travail. **Aucun symbole produit modifié**. Index T01 ancien, trois commits derrière au contrôle : résultats limités, pas de certification exhaustive. `detect_changes(scope=staged, worktree=...)` avant commit ; revue Git directe de tous les chemins ajoutés. Pas de réindexation du worktree d'un autre propriétaire.

## Parcours exact des consentements utilisateur

1. Ouvrir [la connexion SUTRA](https://sutra.purama.dev/login) avec le compte existant confirmé pour PURAMA. T01 a effectué la liaison serveur ; aucune clé, UUID ou URL de callback à saisir manuellement par l'utilisateur.
2. Aller à [Réglages → Réseaux sociaux](https://sutra.purama.dev/settings/social). Pour chaque réseau voulu, cliquer **Se connecter**. Disponibles dans le code : **TikTok, YouTube, Instagram, Facebook, X, LinkedIn, Pinterest, Reddit, Threads**. Snapchat, Tumblr, Mastodon, Bluesky et Vimeo ne proposent pas de connexion dans ce flux. Disponibilité OAuth ne certifie pas la publication native de chaque plateforme.
3. SUTRA envoie `POST /api/social/connect` avec le seul champ `platform`, puis redirige vers `oauthUrl`. Sur le consentement hébergé, l'utilisateur choisit et autorise personnellement le compte voulu et les accès de publication demandés. Contrat SUTRA : scope agrégé `posting` ; les scopes natifs détaillés et sélections propres à chaque réseau sont affichés par le fournisseur et **non validés en live ici**. [Documentation Zernio du consentement](https://docs.zernio.com/guides/connecting-accounts).
4. Conserver le même navigateur et la même session, et terminer en dix minutes. Le fournisseur revient sur `/api/social/callback` avec `connected`, `profileId`, `accountId`, plus `state` et `platform` transportés par l'URL de retour. SUTRA vérifie l'identité par GET puis redirige vers `/settings/social?connected=<plateforme>`. Ne pas fabriquer ni rejouer cette URL. Refus, expiration ou changement de session : recommencer **Se connecter** depuis la page.
5. Connecter seulement les réseaux choisis. Ce consentement ne demande ni activation de l'autonomie ni publication de test. Une seule ligne compte existe par utilisateur/plateforme ; changer de compte implique un nouveau consentement puis une sélection explicite pour les productions concernées.

Révocation : **Deconnecter**, puis confirmer dans la boîte de dialogue ; `DELETE /api/social/accounts` reçoit l'UUID local. Le blocage local est immédiat ; un 202 signifie que la révocation distante n'est pas confirmée. Si nécessaire, retirer aussi l'accès dans les paramètres d'applications autorisées du réseau concerné. **Attendre la correction UI T01 pour reconnecter une ligne déjà révoquée** ; pas de contournement manuel de state ou de suppression d'historique.

Action utilisateur minimale restante : effectuer les consentements des seuls réseaux souhaités. Aucune nouvelle demande de clé RunPod/Shotstack/Suno ni configuration Zernio adressée à l'utilisateur par ce lot T06.
