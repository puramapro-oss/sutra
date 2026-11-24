# SUTRA T04 — audit fournisseurs, 13 octobre 2026

**Correctifs locaux vérifiés ; activation fournisseurs BLOQUÉE.** Branche `codex/sutra-t04-provider-audit-20261013`, base T01 `48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4`, descendante du commit demandé `589732cb49959c1a576a3ba381b310cd594600ac`. Migration LTX V2 antérieure déjà intégrée, non refaite. Le handoff du 12 octobre reste son autorité documentaire.

## Résultats gratuits réels

Sondes T04 du 13 octobre à 20:25 UTC : GET uniquement, un essai, TLS vérifié, aucune redirection, timeout 18 s, réponse limitée à 1 Mio, aucun corps brut enregistré. Les credentials fournisseurs viennent exclusivement du maître, normalisés explicitement en mémoire. Le Mac et OVH donnent les mêmes résultats. Preuves : `normalized-live-audit.json`, `dotenv-evidence.json`. **`live-audit.json` initial est EXCLU** : parseur initial conservant un échappement littéral au lieu du newline décodé par dotenv, erreur de construction du script SSH initial ; ce n'est pas une preuve d'authentification applicative.

| Fournisseur | Verdict | Preuve et limite |
| --- | --- | --- |
| RunPod | **BLOQUÉ / ACTION UTILISATEUR REQUISE** | GET liste endpoints HTTP 401 ; GET santé endpoint HTTP 401 JSON `INVALID_API_KEY`, sur Mac et OVH. Pas de challenge réseau. Présence des deux variables confirmée ; clé non acceptée. Appartenance de l'endpoint, permissions, worker, quotas et tarif GPU non vérifiables après ce refus. |
| Shotstack | **BLOQUÉ / ACTION UTILISATEUR REQUISE** | Deux clés × deux environnements officiels : quatre HTTP 403 `INVALID_OR_DISABLED` sur chaque hôte. Un simple échange stage/production n'explique pas les résultats. Réponse insuffisante pour distinguer clé révoquée et restriction/désactivation de compte. Aucun rendu soumis. |
| Suno | **BLOQUÉ — contrat applicatif à remplacer** | Base publique historique du code : HTTP 503 sans credential envoyé. Authentification de ce contrat non vérifiée. T01 a obtenu HTTP 200/code applicatif 200 et forme crédits valide avec la clé maître sur l'autre API déclarée dans `SUNO_API_BASE_URL`, inutilisée par SUTRA. Preuve propriétaire réutilisée, pas de second appel T04, pas de montant exposé. |
| Zernio / OAuth | **Lecture comptes VALIDÉE ; connexion BLOQUÉE** | GET comptes HTTP 200, zéro compte. Cela prouve l'accès en lecture, pas les droits de connexion/publication ni la santé d'un compte. Quatre contre-tests OAuth actuels restent FAIL ; aucun compte connecté et aucun contenu publié. |

Les probes RunPod sont les GET non génératifs [documentés](https://docs.runpod.io/serverless/endpoints/operation-reference). Shotstack utilise les chemins publics `https://api.shotstack.io/edit/stage/templates` et `https://api.shotstack.io/edit/v1/templates`, header `x-api-key` : [référence](https://shotstack.io/docs/api/), [clés par environnement](https://shotstack.io/docs/guide/getting-started/request-api-keys/).

Suno : le code historique soumet `POST /generate` avec `prompt/tags/duration/make_instrumental`, attend un `id` racine puis `GET /songs/{id}` avec `completed/audio_url`. Le fournisseur tiers de l'alias alternatif documente `POST /api/v1/generate`, `customMode/instrumental/model/callBackUrl` et `data.taskId` : [contrat SunoAPI](https://docs.sunoapi.org/suno-api/generate-music). Son [GET crédits](https://docs.sunoapi.org/suno-api/get-remaining-credits) affiche encore un autre serveur ; l'émetteur et le contrat exact doivent être arrêtés avant tout adaptateur. Ne pas déplacer automatiquement la clé vers ce domaine documentaire. Le portail officiel [Suno Platform](https://platform.suno.com/) existe : ne pas affirmer que Suno n'a aucune API officielle, ni que le 503 ponctuel prouve une fermeture permanente. L'authentification de l'alternative ne valide ni son affiliation à Suno ni le contrat SUTRA.

## Provenance et configuration

`~/.env.purama.master` et la configuration Mac examinée sont en `0600`. Aucun fichier de secrets modifié, aucune valeur copiée dans le worktree, aucun `.env.local` créé. Les tests de code utilisent exclusivement des fixtures et un garde réseau.

| Variables | Maître → Mac / conteneur OVH actif | Usage et réserve |
| --- | --- | --- |
| `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID` | Présentes ; égales après retrait en mémoire d'un newline final | Le maître brut diffère. `dotenv-evidence.json` confirme le décodage réel, sans valeur. |
| `RUNPOD_POD_URL` | Absente partout | Pas de voie pod directe qualifiée. |
| `SHOTSTACK_API_KEY`, `SHOTSTACK_PRODUCTION_KEY` | Présentes ; égales après même retrait en mémoire | Stage et production restent refusés. |
| `SHOTSTACK_ENV` | Absente partout | Défaut du code : stage. Seules valeurs admises : stage ou v1. |
| `SUNO_API_KEY`, `SUNO_BASE_URL` | Présentes ; égales après même retrait en mémoire | Contrat historique non qualifié. |
| `SUNO_API_BASE_URL` | Présente dans le maître, absente Mac/runtime | Alias non consommé par SUTRA ; GET crédits T01 accepté. |
| `ZERNIO_API_KEY`, `ZERNIO_BASE_URL` | Présentes, égalité exacte | Lecture comptes acceptée. |
| `ZERNIO_WEBHOOK_SECRET` | Présente dans le maître, absente Mac/runtime | Pas de consommateur trouvé dans le code ; sa copie n'ajouterait aucun contrôle de webhook. |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL` | Présentes mais différentes | Les valeurs globales du maître ne ciblent pas SUTRA. Ne pas les importer en bloc ; origine SUTRA à conserver explicitement pour les callbacks. |

Les fichiers runtime actifs inspectés sont en `0600`. Une troisième configuration candidate diffère : ne pas la promouvoir. Le conteneur était `running/healthy`, image `sha256:956b477deb4b7049914db5f51d934cf15fb0c3ea5fe289d6029c23b4c599e417`. Il n'a pas été modifié.

**Limite de provenance SSH :** le transport T04 a utilisé l'alias SSH existant `purama-ovh`, pas un credential SSH issu du maître. Cela permet la comparaison OVH en lecture seule mais ne satisfait pas une preuve d'authentification SSH depuis la source unique. T01 rapporte séparément SSH 255/Permission denied avec le credential maître, et une destination maître différente de celle de SUTRA. Cette réserve reste ouverte ; ne pas présenter l'accès SSH maître comme validé. Les credentials des GET fournisseurs sont, eux, exclusivement issus du maître.

## Contrats, reprise et coût

| Chemin | Garanties locales vérifiées | Limites réelles |
| --- | --- | --- |
| RunPod/WAN | Soumission `/run` unique, timeout HTTP 30 s ; ID requis ; GET statut 15 s et budget global 300 s ; 401/403/404 arrêtent ; 429/5xx permettent uniquement reprise GET, Retry-After pris en compte ; reprise du même ID. Issue payante inconnue non rejouable et fallback interdit. | `input` dépend du worker : contrat distant non prouvé après 401. Aucun journal durable complet soumission→ID garanti en cas de crash. Prix réel/estimé GPU inconnu reste null, quota inconnu reste null. |
| Shotstack | Un POST rendu ; checkpoint et ID conservés selon consommateur ; GET rendu borné 15 s/300 s ; aucun second rendu après réponse incertaine ; 401/403/404 arrêtent. | Correctif choix clé stage/v1 livré séparément par T05 (`47e49ee94381ed1e8a378f22efd66676b68e032f`). Mon diagnostic doit être intégré avec ce correctif. Compte/coût/quota/rendu réel non validés. |
| Suno | Un POST, transport 30 s ; polling 15 s/requête, budget 120 s. Corps JSON soumis et pollés bornés à 64 Kio ; erreurs JSON et diagnostics HTTP 2xx non divulgués. Tests vérifient aucun nouveau POST après réponse ambiguë. | Contrat historique non prouvé ; pas de job durable crash-safe de bout en bout ni reprise API publique garantie. Estimation/réel/quota inconnus ; ne pas inventer un prix ou afficher un succès. |
| Sélection/fallbacks | Fournisseur choisi avant dépense ; résultat incertain marqué non rejouable/non remplaçable ; provenance disponible dans les wrappers dédiés. | Les interfaces historiques URL/ArrayBuffer ne transmettent pas toute la provenance. Aucun fournisseur musical alternatif n'est qualifié par ce seul audit. |

LTX V2 reste soumis au journal durable et aux capacités officiellement documentées : aucune nouvelle génération, annulation distante ou webhook inventé. Voir `HANDOFF-SUTRA-T04-20261012.md` pour la livraison intégrée du 12 octobre.

## Audit OAuth et tokens

OpenAPI Zernio récupéré publiquement le 13 octobre à 20:27 UTC : 631 chemins, empreinte `48331790f56a97488f83dd8ace445518160f66e15c081a608e1b440c65004e10`, extrait dans `zernio-contract.json`.

- Les anciens `/oauth/url`, `/oauth/exchange`, `/oauth/refresh` sont absents. Le [contrat actuel](https://docs.zernio.com/connect/get-connect-url) attend `/connect/{platform}`, `profileId`, `redirect_url`, `scopes=posting` lorsque supporté, réponse `authUrl`. Le callback hébergé renvoie `connected/profileId/accountId/username`, pas le triplet historique `code/state/platform` exigé actuellement. `x` doit devenir `twitter` à la connexion.
- Le state local est hashé SHA-256 avec secret navigateur aléatoire, expire après 600 s et est consommé atomiquement via DELETE RETURNING. Cookie HttpOnly/SameSite=Lax/Secure en HTTPS ; contrôle utilisateur et plateforme, absence/erreur DB fermée. Les tests locaux ne prouvent pas le flux distant actuel.
- La liaison couvre utilisateur et navigateur, sans identifiant de session précis ni mapping organisation/utilisateur→profil Zernio. Une valeur de query callback n'est pas une preuve de propriété : relire le compte distant avec un profil autorisé avant rattachement.
- Minimisation des scopes absente actuellement. Demander seulement `posting`, et les permissions d'identité/renouvellement/sélection imposées par chaque plateforme. Ne pas demander analytics/comments/messaging/ads sans besoin. Certains connecteurs ne supportent pas le paramètre scopes.
- Tokens stockés côté service en table, exclus de la projection publique ; absence de preuve de chiffrement applicatif. Expiration invalide/échue bloque la publication, mais null est accepté. Aucun consommateur de `refreshAccessToken`, raccord à la [santé des comptes](https://docs.zernio.com/accounts/get-account-health) ou webhook de déconnexion trouvé. Rotation automatique non démontrée.
- Révocation locale CAS avant DELETE distant ; résultat distant incertain conserve le compte révoqué et la publication interdite. Les champs de tokens restent stockés ; une déconnexion agrégateur n'atteste pas la révocation du consentement natif. Aucun DELETE effectué ici.
- TikTok exige des choix/confirmations individuels absents du payload actuel ; ne jamais fabriquer le consentement. Pinterest exige une destination de tableau. Snapchat, Tumblr, Mastodon et Vimeo ne sont pas qualifiés comme connecteurs publiables SUTRA.

Ces corrections OAuth appartiennent à T01/T02/T06 ; aucun de leurs fichiers modifié. Le complément T02 `312522a8c0cb7a011eaf42d7459e3c635b75f8e3` protège les diagnostics GET comptes mais ne remplace pas le raccord OAuth. La revue T06 détaillée est dans son `qa/t06-provider-audit-20261013/SOCIAL-AUDIT.md` et le pointeur de coordination partagé.

## Corrections T04 et tests

Produit : `src/lib/suno.ts` expurge les erreurs 2xx/JSON et borne les réponses de soumission/polling ; valide les types de sortie. `src/lib/env.ts` choisit la variable Shotstack requise selon l'environnement et refuse un environnement inconnu dans le diagnostic. Tests dans les trois fichiers fournisseurs existants. `vercel.json` désactive uniquement l'auto-preview de cette branche avant le push explicitement demandé.

| Preuve | Résultat |
| --- | --- |
| Régression avant correction | 2 FAIL reproduits Suno et diagnostic Shotstack, `regression-before.log`. |
| Tests ciblés après correction | 37 PASS, zéro FAIL/SKIP, `regression-after.log`. |
| Gate contrats finale Node24 `scripts/run-ci.mjs contracts` | **483 PASS, 7 SKIP, zéro FAIL** ; schedule/composition/publication PASS. |
| Gate Node24 `scripts/run-ci.mjs quality` | TypeScript PASS ; lint zéro erreur/111 avertissements existants ; build webpack **197 pages PASS**, police locale commitée. Avertissements Edge Next existants conservés. |
| Contre-tests T08 réutilisés sur cette source | **S01/S02 PASS ; Z01–Z04 FAIL**. Seule profondeur des imports adaptée, assertions inchangées ; hash source et commande dans `t08-acceptance.json`. Ces quatre échecs restent de vrais blocages, pas des expected failures. |
| Sécurité du script d'audit | 7 tests Python PASS : allowlist GET, refus génération/URL hostile/CRLF/redirect, expurgation, parseur, script distant. |

La première gate après correction a donné 482 PASS/1 FAIL/7 SKIP : une assertion historique exigeait le reflet de `quota exceeded`. Elle a été remplacée par l'exigence inverse ; les deux logs sont conservés. Les 7 SKIP sont les sondes INSEE live, DB distante et OpenTimestamps réseau. Les preuves média, DB, navigateur et legacy de la base inchangée ne sont ni rejouées ni comptées comme nouvelles preuves T04. Aucun visuel certifié par cet audit.

Contrôle secrets : comparaison opaque avec le maître sans correspondance ; Gitleaks final PASS, zéro détection, sans règle désactivée ni exclusion ajoutée. Trois faux positifs initiaux étaient des SHA-256 de fichiers de preuve, recomputés puis représentés explicitement comme `path`/`sha256` ; traces initiales et revue conservées. Aucun secret trouvé ou modifié.

Les fichiers `quality-results.json`, `typecheck.log` et `lint.log` correspondent au contrôle initial, pas au delta final ; seuls les fichiers préfixés `quality-` avec `quality-final.json` prouvent la gate finale.

Espaces de fin et retours de ligne des logs normalisés uniquement pour `git diff --check` ; empreintes avant/après dans `log-format.json`, diagnostics et résultats conservés.

Commandes et sorties finales : `contracts-final.json`, `quality-final.json`, logs associés. `tested-source.json` lie les tests aux hashes du produit, du runner, du garde réseau, du lockfile et de la police. Dépendances T01 réutilisées par lien local, lockfile identique, Node 24.21.0, aucune installation. Disque 23 Gio disponibles avant build ; aucun nettoyage ni suppression de worktree.

GitNexus : impact `generateMusic` CRITICAL (5 appelants directs, 6 flux), `pollSunoJob` CRITICAL (1 appelant, 2 flux), signalés avant correction. Index T01 en retard de six commits, pas une preuve exhaustive. Diagnostic env : graphe sans appelants, revue directe de l'usage admin health et de la lecture des specs. Après l’échec initial faute d’index propre, indexation locale isolée sans injection de fichiers : 13 711 nœuds, 26 458 relations, 365 flux. Graphe TRUNCATED (956 entrées, 527 callees, 4 parcours omis) ; aucune exhaustivité revendiquée. `detect-changes --scope all --repo sutra-t04-provider-audit-20261013 --limit 300` : 9 fichiers suivis, 13 symboles, 6 flux, risque HIGH, conforme au périmètre attendu. Le contrôle staged porte sur 45 fichiers/44 symboles (preuves incluses), toujours 6 flux/HIGH ; affichage CLI limité à 15 symboles, inventaire complet du diff revu directement. Ces contrôles ne transforment pas les limites du graphe en absence de risque. Les reçus JSON/log ajoutés ensuite n’ajoutent aucun code exécutable.

## Actions minimales restantes

1. **Source maître** : corriger les six suffixes newline listés ci-dessus, sans diffuser les valeurs ; conserver `0600`. Faire identifier par le coordinateur une configuration d'origine et d'accès SSH propre à SUTRA au lieu d'importer les variables globales d'une autre app. Aucune correction distante n'est autorisée par ce rapport.
2. **RunPod** : dans [API Keys](https://console.runpod.io/user/credentials), vérifier/régénérer une clé non révoquée du bon compte, avec accès à l'endpoint SUTRA ; vérifier l'ID dans Serverless et mettre uniquement le maître à jour. Aucun démarrage de worker nécessaire pour refaire le GET de santé. [Permissions](https://docs.runpod.io/get-started/credentials).
3. **Shotstack** : dans [API Keys](https://app.shotstack.io/keys), récupérer séparément stage et production et vérifier que le compte/les clés sont actifs. Si le 403 persiste avec les clés de ce compte, demander au support de lever ou expliquer la restriction ; fournir seulement le code HTTP et l'environnement, jamais les clés.
4. **Suno** : confirmer le fournisseur voulu : [Suno officiel](https://platform.suno.com/) ou [SunoAPI tiers](https://sunoapi.org/). La clé alternative est déjà acceptée pour lire les crédits : ne pas acheter/recharger pour cet audit. Le coordinateur doit ensuite faire réaliser un adaptateur du contrat choisi ; changer seulement l'URL est insuffisant.
5. **Réseaux sociaux, après correction OAuth** : autoriser uniquement les réseaux souhaités via le [parcours officiel Zernio](https://docs.zernio.com/guides/connecting-accounts). Choisir la chaîne YouTube, la Page Facebook, le compte Instagram Business/Creator (Page liée seulement pour Facebook Login), le compte X/TikTok/Threads/Reddit, le profil ou l'organisation LinkedIn et le tableau Pinterest. Pour [Bluesky](https://bsky.app/settings/app-passwords), fournir un mot de passe d'application dédié dans le parcours prévu. TikTok requiert aussi confirmation de l'aperçu/confidentialité/interactions pour chaque contenu ; aucun consentement ou publication automatique.

Les corrections d'architecture OAuth et d'adaptateur musique sont des tâches des propriétaires, pas des actions de configuration que l'utilisateur doit deviner. Aucun achat, déploiement, fusion, migration, connexion OAuth, publication ou appel génératif n'a été réalisé par T04 dans cette reprise.
