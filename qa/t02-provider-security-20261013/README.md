# SUTRA T02 — audit fournisseurs et limites OAuth, 2026-10-13

**Delta sécurité local vérifié ; activation fournisseurs bloquée.** Branche `codex/sutra-t02-provider-security-20261013`, base intégrée `48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4`. Le SHA de livraison est celui du commit contenant ce rapport, reporté dans le pointeur coordinateur `T02-PROVIDER-SECURITY-20261013.md`.

## Propriété et actions effectuées

AGENTS, CLAUDE, politique commune, deux LOCKS, handoffs, branches/worktrees/WIP vérifiés ; `POLICY_OK`. Ancien lot T02 déjà intégré, préservé. Worktree isolé ; dépendances existantes réutilisées, aucune installation. T01/T04 possèdent les sondes master/Mac/OVH ; T08 le contre-test du contrat Zernio ; T05 le correctif Shotstack ; T06 la liste des consentements. Leurs preuves expurgées sont figées avec chemin, date et SHA-256 dans `provider-evidence.json`. T02 ne répète aucune sonde et ne modifie aucun de leurs fichiers.

T02 corrige seulement GET `src/app/api/social/accounts/route.ts` : retrait de `metadata` brute de la projection privilégiée et des diagnostics DB/transport de la réponse. Les permissions SQL excluaient déjà cette colonne du navigateur ; le proxy service_role la réexposait. Deux consommateurs HTTP examinés (`settings/social/page.tsx`, `PublishEverywhereButton.tsx`) n'en dépendent pas. Pas de changement de DELETE, d'OAuth, de cron-auth, de permissions SQL, de stockage ni de fournisseur. Ajout du test à la liste du runner CI existant, sans nouveau moteur. Dans `vercel.json`, seule la clé `git.deploymentEnabled` de cette branche est ajoutée à `false` avant le push explicitement autorisé ; comparaison JSON confirme tous les autres paramètres identiques. Aucun workflow GitHub ne cible son push.

## Preuves locales nouvelles

| Commande | Résultat |
| --- | --- |
| Node `--experimental-test-module-mocks --import tsx --test scripts/test-t02-oauth-boundaries.mts`, avant correction | 9 PASS, 3 FAIL attendus : metadata, message DB et exception transport exposés. `before-tests.log`, données synthétiques uniquement. |
| `node scripts/run-ci.mjs contracts`, après correction et inscription CI | 499 tests : **492 PASS, 0 FAIL, 7 SKIP** ; les 12 nouveaux tests passent. Schedule, composition et publication simulée PASS. |
| `node qa/t02-final/run-free-gates.mjs quality` | TypeScript PASS ; lint 0 erreur/111 avertissements préexistants, aucun sur les fichiers du delta ; build webpack PASS, 197 pages générées. |

Environnement enfant explicitement limité aux variables système et fixtures ; aucun `.env.local` créé, aucune clé maître injectée. `qa/t08/offline.cjs` bloque les réseaux et la lecture dotenv ; polices publiques immuables du harnais T02 antérieur vérifiées par SHA-256. Les sept SKIP sont INSEE live (4), DB Stripe/vidéo (2), OpenTimestamps réseau (1) : aucune preuve live revendiquée. Pas de navigateur ni de DB distante relancés pour ce delta de réponse JSON. Les preuves RLS/stockage/SSRF historiques restent celles de la base, non de nouveaux PASS.

Les nouveaux scénarios exercent le vrai handler de callback et le vrai consommateur de state avec stockage relationnel simulé : absence de session, autre utilisateur sans destruction du state légitime, changement de plateforme, secret navigateur absent/forgé, expiration, callbacks concurrents, panne DB, échange incertain et rejeu. Ils ne prouvent ni PostgreSQL multi-session ni un parcours OAuth distant.

GitNexus local indexé avant modification. Impact GET et constante `nodeTests` = **UNKNOWN**, aucun appel résolu : inspection directe des deux consommateurs et de l'usage unique de la liste CI. `detect_changes` voit GET et `nodeTests`, risque local low, aucun flux résolu. Graphe tronqué (952 entrées/526 callees/4 parcours omis), donc aucune certification exhaustive déduite du graphe. Manifest des fichiers/configuration/dépendances/Node dans `validation-manifest.json`. Gitleaks staged PASS, zéro secret détecté. Deux alertes initiales visaient uniquement des SHA-256 calculés de fichiers ; manifeste restructuré pour séparer chemin et empreinte, sans exception de scanner ni allowlist. Rapports expurgés `gitleaks-initial.json` et `gitleaks.json`. Espaces de fin de ligne des logs normalisés pour archivage ; résultats et diagnostics conservés.

## Fournisseurs : preuves master réutilisées, sans génération

| Fournisseur | Verdict | Preuve et limite |
| --- | --- | --- |
| RunPod | **BLOQUÉ — ACTION UTILISATEUR REQUISE** | T04, Mac et OVH : GET liste endpoints **401**, GET endpoint health **401 INVALID_API_KEY**, TLS vérifié, 18 s max, une tentative, aucune redirection. Même refus après projection du maître sans suffixe littéral parasite. Impossible de certifier permissions ou disponibilité de l'endpoint derrière ce refus. |
| Shotstack | **BLOQUÉ — ACTION UTILISATEUR REQUISE** | Deux clés × `/edit/stage/templates` et `/edit/v1/templates` : **4×403 INVALID_OR_DISABLED** sur chacun des deux hôtes. URL et matrice d'environnement contrôlées ; simple inversion stage/production insuffisante pour expliquer le refus. Clé désactivée/invalide ou restriction du compte non départageables sans console. Aucun rendu. |
| Suno | **BLOQUÉ — FOURNISSEUR À CONFIRMER** | Base du code `https://api.suno.ai/v1` : GET public **503**, Mac et OVH ; aucun contrat d'authentification vérifié, donc clé non envoyée à un destinataire incertain. Alias maître `SUNO_API_BASE_URL` vise un tiers différent mais n'est pas lu par SUTRA. Présence de clé ≠ authentification. |
| Zernio / réseaux sociaux | **AUTHENTIFICATION VALIDÉE ; CONNEXION BLOQUÉE** | GET `/accounts` **200**, zéro compte, Mac et OVH ; T01 GET `/profiles` **200**, un profil. Cela ne valide aucune permission de publication. Contrat OpenAPI 1.273.0 actuel : `/v1/connect/{platform}`, `profileId`, `redirect_url`, réponse `authUrl` ; les trois chemins `/v1/oauth/url`, `/exchange`, `/refresh` utilisés par SUTRA sont absents. Aucun compte connecté, token échangé ou contenu publié. |

RunPod local : POST enveloppe `{ input: ... }`, Bearer, redirections refusées, 30 s de budget HTTP par défaut et un seul envoi non idempotent. Polling GET `/status/{id}`, budget global 300 s, requêtes bornées à 15 s, 401/403 arrêtent la boucle, provenance `unknown` conservée si soumission incertaine. Les tests du runner couvrent absence de retry payant, reprise et erreurs expurgées ; le worker distant et ses champs réels restent inconnus sous 401. Ne jamais considérer une clé d'idempotence seule comme preuve de déduplication distante. Reprise pipeline complémentaire : propriétaire T03.

Shotstack actuel sélectionne par défaut stage, mais la base auditée utilise `SHOTSTACK_API_KEY` même avec environnement production. **Correctif et tests appartiennent à T05**, observés dans son worktree ; ils ne sont ni intégrés ni livrés par T02. Stage attendu : `https://api.shotstack.io/edit/stage`, production : `https://api.shotstack.io/edit/v1`. Une nouvelle clé valide ne règle pas à elle seule la sélection applicative.

Suno : `src/lib/suno.ts` attend POST `/generate` → `id`, puis GET `/songs/{id}` → `status`, `audio_url`. L'alias tiers ne peut pas remplacer la base par simple changement de variable : la documentation de sunoapi.org utilise notamment `apibox.erweima.ai/api/v1/generate/credit` et un autre contrat de jobs. Ce tiers n'est pas le domaine officiel Suno. Le portail officiel `platform.suno.com` existe ; son écran de connexion ne prouve pas que l'ancien contrat SUTRA est officiel ni disponible. Adaptateur à remplacer/qualifier après confirmation du fournisseur ayant émis la clé. Aucun endpoint de crédit tiers appelé avec une clé d'origine inconnue.

## Provenance des variables et Mac/OVH

Source des identifiants utilisés par les propriétaires pour les sondes : **`~/.env.purama.master`**, mode **0600**. Master, `.env.local` Mac et fichiers runtime OVH inspectés en lecture seule par leurs propriétaires. T04 confirme conteneur `purama-sutra` actif et healthy. L'échec SSH T01 ne remplace pas cette preuve OVH réussie T04 ; ne pas demander un accès SSH supplémentaire sur ce seul échec.

| Variables | Provenance / configuration observée, sans valeurs |
| --- | --- |
| `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, `SHOTSTACK_API_KEY`, `SHOTSTACK_PRODUCTION_KEY`, `SUNO_API_KEY`, `SUNO_BASE_URL` | Présentes maître ; un suffixe littéral `\n` parasite dans chacune. Retrait de ce seul suffixe en mémoire pour diagnostic, **sans édition du maître**. Les valeurs ainsi normalisées correspondent au Mac et au conteneur OVH ; les refus restent identiques. |
| `RUNPOD_POD_URL`, `SHOTSTACK_ENV`, `SHOTSTACK_BASE_URL` | Absentes du maître et du Mac ; T04 confirme les deux premières absentes du runtime OVH. Défauts applicatifs serverless et stage. `SHOTSTACK_BASE_URL` n'est pas une option consommée par l'adaptateur. |
| `SUNO_API_BASE_URL` | Présente maître, absente Mac/OVH, non consommée par le code ; fournisseur différent de `SUNO_BASE_URL`. |
| `ZERNIO_API_KEY`, `ZERNIO_BASE_URL` | Présentes maître et identiques Mac/OVH ; authentification GET confirmée. |
| `ZERNIO_WEBHOOK_SECRET` | Présente maître, absente Mac/OVH. Aucun raccord de santé/révocation de compte signé démontré ; ne pas copier la variable pour simuler ce raccord. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Absentes maître, présentes Mac selon T01 ; origine maître non confirmée. Login Google distinct du consentement aux comptes de publication. Aucun essai de connexion. |
| `CRON_SECRET` | Présente maître/Mac mais différente ; aucune rotation automatique. `assertCronAuth` existant préservé, aucun système concurrent. |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL` | Présentes maître, valeurs différentes des configurations SUTRA Mac/OVH. Ne pas écraser une origine SUTRA par une valeur globale PURAMA. |
| `NEXT_PUBLIC_SUPABASE_URL` | Absente maître, présente Mac ; provenance maître non confirmée. |
| `NEXT_PUBLIC_APP_SCHEMA`, `NEXT_PUBLIC_SUPABASE_DB_SCHEMA`, `SUPABASE_APP_SCHEMA` | Présentes maître ; première différente du Mac, deux aliases absents du Mac. Conserver le schéma applicatif SUTRA. |

Deux configurations runtime OVH correspondent aux variables fournisseur normalisées ; une troisième référence diffère (voir snapshot T04). Aucun fichier distant modifié. Aucune copie globale de maître vers l'application : secrets nouveaux refusés, clés non fonctionnelles et paramètres globaux ne justifient aucune écriture locale.

## Sécurité sociale et reste d'intégration

State haché, secret navigateur indépendant HttpOnly/Lax/Secure sous HTTPS, TTL 600 s, consommation atomique filtrée utilisateur/plateforme/navigateur/expiration et session `getUser()` vérifiée. Absence de liaison à un identifiant de session distinct et absence de mapping serveur organisation/utilisateur ↔ profil Zernio : **isolation multi-organisation non qualifiée**. Les callbacks hébergés actuels retournent `connected/profileId/accountId/username`, différents de `code/state/platform` exigés par SUTRA ; aucun paramètre de callback ne doit devenir une autorisation sans relecture distante du compte/profil.

Scopes `posting` non encore demandés ; `x` doit correspondre à `twitter`. Renouvellement `/oauth/refresh` sans consommateur ; pas de boucle attestée de rotation/santé/webhook. Révocation existante : statut local `revoked` avant DELETE distant, HTTP 202 et `remoteStatus=unconfirmed` si incertitude ; tokens stockés non effacés par cette fonction, protégés par permissions SQL. Déconnexion agrégateur ≠ preuve de révocation du consentement natif. Limites et choix de comptes détaillés par T06 dans le document dont l'empreinte figure dans `provider-evidence.json`.

## Actions minimales restantes

1. **RunPod** : dans [Credentials](https://console.runpod.io/user/credentials), vérifier compte/clé active et accès restreint au bon endpoint ; remplacer la clé refusée dans le maître par une valeur valide, sans suffixe littéral. Rejouer ensuite uniquement les GET d'authentification. [Permissions officielles](https://docs.runpod.io/get-started/credentials).
2. **Shotstack** : dans le [dashboard](https://app.shotstack.io/), menu API Keys, récupérer/activer les clés stage et production du bon compte ; vérifier leur état auprès du support si elles restent refusées. Enregistrer les deux dans le maître sans suffixe parasite. [Guide officiel des clés/environnements](https://shotstack.io/docs/guide/getting-started/request-api-keys/).
3. **Suno** : confirmer qui a émis la clé et le contrat accessible depuis le [portail officiel Suno](https://platform.suno.com/), ou confirmer explicitement le fournisseur tiers voulu. Le développeur devra adapter le contrat avant activation ; aucun consentement utilisateur ne peut corriger le code actuel. [Contrat du tiers identifié](https://docs.sunoapi.org/suno-api/get-remaining-credits).
4. **Réseaux sociaux, après correction OAuth et profil serveur** : autoriser uniquement les réseaux souhaités via le [parcours Zernio documenté](https://docs.zernio.com/connect/get-connect-url), avec `posting` quand disponible ; sélectionner la chaîne YouTube, Page Facebook, compte Instagram Business/Creator, profil/organisation LinkedIn, compte X/TikTok/Threads/Reddit et tableau Pinterest voulus. Bluesky nécessite un [mot de passe d'application dédié](https://bsky.app/settings/app-passwords). Pour TikTok, confirmer les choix de confidentialité/interactions et chaque média au moment de publier. Aucun compte ne doit être connecté maintenant pour masquer le blocage du contrat.

L'utilisateur n'a pas à modifier le VPS pour cet audit. Le coordinateur doit reprendre les corrections de contrat OAuth/profil et Shotstack, puis qualifier gratuitement leurs parcours. Aucun déploiement, merge, migration, rendu, génération musicale/GPU, publication, modification de configuration distante ou secret committé dans ce lot. Seul le push de la branche de code, explicitement demandé dans la mission, est autorisé ; la garde Vercel interdit son auto-déploiement.
