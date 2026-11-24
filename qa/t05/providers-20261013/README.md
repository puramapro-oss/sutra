# SUTRA T05 — audit fournisseurs, 13 octobre 2026

**DELTA SHOTSTACK VALIDÉ LOCALEMENT ; FOURNISSEURS ET OAUTH RÉELS BLOQUÉS.**
Base d'intégration vérifiée : `48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4`, descendante de la base demandée `589732cb49959c1a576a3ba381b310cd594600ac`. Branche T05 : `codex/sutra-t05-provider-contract-20261013`. Aucun déploiement, fusion, migration, publication, génération ou rendu fournisseur exécuté.

## Répartition et provenance

Politiques, instructions, deux LOCKS et WIP lus avant modification ; `POLICY_OK`. Worktree isolé, dépendances existantes utilisées sans installation. T04 possède les sondes master/Mac/OVH ; T08 les contre-tests des contrats distants ; T02 les limites de sécurité ; T06 les consentements et la révocation. T05 ne rejoue aucune sonde ni ne modifie leurs sources. Les snapshots expurgés sont attribués à leurs auteurs dans `manifest.json` ; ils ne constituent pas des sondes T05 indépendantes.

Source unique des identifiants utilisés par T04 : `~/.env.purama.master`, permissions `0600`. Les autres fichiers ne servent qu'à comparer la configuration. Aucun secret copié dans ce worktree, aucun `.env.local` créé ou existant remplacé. Les tests T05 utilisent uniquement des identifiants fictifs, avec réseau distant et lectures `.env` interdits.

T04 observe un suffixe littéral `\n` dans `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, `SHOTSTACK_API_KEY`, `SHOTSTACK_PRODUCTION_KEY`, `SUNO_API_KEY`, `SUNO_BASE_URL`. Son deuxième diagnostic retire ce suffixe **en mémoire seulement**. Les refus persistent : ne pas présenter ce diagnostic normalisé comme une correction du maître. La première tentative SSH a échoué ; le deuxième diagnostic a effectivement vérifié le VPS.

| Variables | Provenance et comparaison opaque Mac/OVH |
| --- | --- |
| `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID` | Présentes une fois dans le maître ; égales au Mac et au conteneur actif après normalisation diagnostique. |
| `SHOTSTACK_API_KEY`, `SHOTSTACK_PRODUCTION_KEY` | Même constat ; valeurs jamais affichées. |
| `SHOTSTACK_ENV` | Absente du maître, Mac et conteneur : défaut applicatif `stage`. |
| `SUNO_API_KEY`, `SUNO_BASE_URL` | Présentes et concordantes après normalisation diagnostique. |
| `SUNO_API_BASE_URL` | Présente dans le maître, différente de l'autre alias, absente du runtime et non consommée par cet adaptateur. |
| `ZERNIO_API_KEY`, `ZERNIO_BASE_URL` | Présentes, concordantes sans normalisation. |
| `ZERNIO_WEBHOOK_SECRET` | Présent dans le maître, absent du Mac et du conteneur ; présence seule ne prouverait pas un raccord webhook. |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL` | Présentes mais différentes entre maître et configuration applicative ; origine callback à réconcilier par le propriétaire avant activation. |
| `RUNPOD_POD_URL` | Absente : chemin serveur sans pod dédié configuré. |

OVH : conteneur `purama-sutra` running/healthy dans la preuve T04, lecture seule. Les deux premiers fichiers runtime correspondent aux variables de fournisseurs normalisées ; un troisième diffère. Ne pas recopier aveuglément un ancien fichier ou les origines du maître.

## Verdicts fournisseurs

| Fournisseur | Verdict et preuve gratuite | Suite nécessaire |
| --- | --- | --- |
| RunPod | **ACTION UTILISATEUR REQUISE** : GET liste des endpoints et `/health` refusés **401** depuis Mac et OVH, même après normalisation ; health indique clé invalide. Permissions sur l'endpoint et contrat du worker non validés. | Vérifier/régénérer une clé du bon compte et ses droits sur l'endpoint existant ; corriger le maître sans suffixe littéral. Aucun lancement GPU nécessaire. |
| Shotstack | **ACTION UTILISATEUR REQUISE** : les deux clés sur les deux URLs officielles de templates renvoient **403 INVALID_OR_DISABLED**, Mac et OVH. Ce résultat ne permet pas de distinguer clé désactivée, mauvaise clé et restriction de compte. Une simple permutation stage/production n'a pas levé le refus. | Contrôler les deux clés et l'état du compte dans le dashboard, puis retester seulement GET. Correctif T05 de sélection de clé livré ci-dessous. |
| Suno | **BLOQUÉ** : base legacy utilisée par le code, GET public **503**, aucun secret envoyé faute de contrat d'authentification vérifié. POST `/generate` + GET `/songs/:id` et leurs schémas ne sont pas rattachés à une documentation officielle prouvée. | Obtenir le contrat et l'accès de la plateforme officielle Suno ; confirmer ou remplacer l'adaptateur. Ne pas déclarer l'absence de toute API officielle : `platform.suno.com` existe. |
| Zernio / réseaux | **AUTHENTIFICATION VALIDÉE, CONNEXION BLOQUÉE** : GET accounts **200**, zéro compte, Mac et OVH. L'OpenAPI 1.273.0 documente GET `/v1/connect/{platform}`, `profileId`, `redirect_url`, `scopes`, réponse `authUrl`. Les trois routes `/v1/oauth/url`, `/exchange`, `/refresh` utilisées par l'adaptateur ne figurent pas au contrat. | Corriger le raccord et le mapping de profils avant tout consentement utilisateur ; aucune connexion/publication lancée. |

Sources officielles vérifiées : [RunPod — identifiants](https://docs.runpod.io/get-started/credentials), [requêtes serverless](https://docs.runpod.io/serverless/endpoints/send-requests), [Shotstack — API](https://shotstack.io/docs/api/), [clés par environnement](https://shotstack.io/docs/guide/getting-started/request-api-keys/), [plateforme Suno](https://platform.suno.com/), [Zernio — connexion](https://docs.zernio.com/connect/get-connect-url), [OpenAPI](https://docs.zernio.com/api/openapi).

## Correction T05 et contrats d'exécution

`assembleFinalVideo` employait toujours `SHOTSTACK_API_KEY`, y compris en production. Il sélectionne désormais `SHOTSTACK_PRODUCTION_KEY` pour `SHOTSTACK_ENV=v1`, et `SHOTSTACK_API_KEY` pour `stage` ou le défaut. Environnement ou clé manquante : refus avant résolution des médias ou HTTP. Submit et reprise utilisent la même clé ; aucun essai de l'autre clé après échec. URLs fixes officielles `https://api.shotstack.io/edit/{stage,v1}` ; pas de base fournie par un utilisateur.

Régression rouge avant correction : 16 tests, 11 PASS et 5 FAIL (quatre cas et leur parent). Après correction : 89 tests ciblés PASS, dont 16 dans le fichier Shotstack. Cas ajoutés : stage, production, défaut, production sans clé sandbox, reprise GET seule, clé propre absente, environnement inconnu. Les clés et médias sont fictifs.

Revue conservée : POST de soumission non rejoué automatiquement ; intention durable avant appel, identifiant distant avant polling, soumission incertaine bloquée en réconciliation ; poll GET borné à 300 s avec requête 15 s maximum, 401/403/404 fatals, redirections refusées et erreurs HTTP expurgées. RunPod a également une seule tentative de POST, état `unknown` sans resoumission/fallback automatique et reprise par GET ; aucun contrat de worker réel ou coût GPU n'est déduit des mocks. Aucun de ces contrôles ne prouve l'idempotence côté fournisseur d'un POST dont la réponse serait perdue.

Les contrats média précédemment intégrés restent canoniques : voix/musique/sous-titres/intro/outro/logo selon brief, aucune vidéo brute après échec du montage, validation des octets finaux et SHA-256 avant stockage. Dimensions source/native/améliorée/demandée/finale distinctes, upscale 4K distinct de native 4K attestée. Les contrôles FFmpeg de décodage complet, corruption, audio/synchronisation, SAR, codec, FPS et sous-titres n'ont pas changé : preuve synthétique historique de 34 tests conservée, non revendiquée comme rejouée ou comme génération native réelle.

Résiduel partagé transmis à T01/T04 : `src/lib/env.ts` continue de diagnostiquer seulement `SHOTSTACK_API_KEY`. Il faut aligner le diagnostic administratif sur l'environnement ; ce fichier transversal n'est pas modifié par T05. Les identifiants refusés restent un blocage externe indépendant du correctif local.

## Audit OAuth, sécurité et consentements

T08 reproduit **5 échecs / 1 PASS** avec fixtures hors réseau : quatre incompatibilités Zernio (endpoint, paramètres, `authUrl`, callback hébergé) et une fuite de corps d'erreur Suno dans une réponse HTTP 2xx sans identifiant. Le cas Suno HTTP 401 est expurgé et passe. Ces résultats restent des **FAIL**, séparés des contrats existants verts ; correction aux propriétaires Suno/OAuth, pas à T05.

Revue T06 : state haché, secret navigateur 32 octets, TTL 600 s, consommation atomique DELETE RETURNING liée utilisateur/plateforme/navigateur/expiration ; session utilisateur vérifiée, cookie HttpOnly/Lax/Secure HTTPS. Pas de liaison à un identifiant de session précis ni de mapping serveur utilisateur/organisation vers profil Zernio. `scopes=posting` n'est pas transmis. Le callback attend encore `code/state/platform`, incompatible avec `connected/profileId/accountId/username` du flux hébergé. Les paramètres du callback ne sauraient prouver seuls l'appartenance d'un compte.

Expiration connue invalide bloque la publication ; expiration absente ne prouve pas la validité. Refresh sans consommateur, ancien endpoint non qualifié, rotation/webhook non prouvés. Révocation locale avant DELETE distant, incertitude conservée `remoteStatus=unconfirmed` ; les champs de tokens restent en base. Déconnexion Zernio ne prouve pas révocation de consentement chez le réseau. GET comptes exclut les tokens ; expurgation des erreurs DB/transport traitée séparément par T02.

Liste de connexions réservée à l'utilisateur **après correction OAuth** : choisir seulement les réseaux souhaités ; Google/YouTube et chaîne, administrateur Facebook et Page, Instagram Business/Creator (Page liée seulement si Facebook Login), X avec API `twitter`, LinkedIn profil ou organisation administrée, TikTok compte puis confirmations par média/confidentialité/interactions, Pinterest et tableau, Reddit et destination, Threads. Bluesky nécessite un mot de passe d'application dédié. Snapchat/Tumblr/Mastodon/Vimeo ne sont pas qualifiés comme destinations publiables. Détail canonique : snapshot `t06-social-audit.md` et [guide officiel](https://docs.zernio.com/guides/connecting-accounts).

## Vérifications locales gratuites

| Commande | Résultat T05 sur ce delta |
| --- | --- |
| Contrats ciblés, commande dans `targeted-results.json` | 89 PASS, 0 FAIL, 0 SKIP. |
| `node scripts/run-ci.mjs contracts` | 488 PASS, 7 SKIP, 0 FAIL ; schedule/composition/publication PASS. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | PASS. |
| `node node_modules/eslint/bin/eslint.js .` | PASS, 0 erreur, 111 avertissements hérités. |
| `python3 qa/t05/providers-20261013/build.py` | PASS, 197 pages, police TTF commitée, aucun réseau. |

Les 7 SKIP concernent INSEE live (4), DB distante (2), OpenTimestamps réseau (1). Rien de payant ou distant n'est reclassé PASS. Le helper historique de cache Google Fonts a été arrêté avant build : hypothèse périmée, car l'intégration utilise déjà une police locale. Build normal réussi, aucun changement de police.

GitNexus propre à ce worktree indexé avant édition : `baseUrl` LOW, un appelant direct ; `assembleFinalVideo` sans appelant retourné, donc UNKNOWN. Lecture directe des injections dans le compositor/pipelines complète cette limite. Graphe partiel (plafond de flows, 952 entrées et 526 callees omis), jamais présenté comme exhaustif. `detect-changes.txt`, `manifest.json` et comparaison Git bornent le delta exact. Une entrée Vercel désactive l'auto-preview de cette branche uniquement, pour respecter le push T05 autorisé sans déploiement.

## Actions minimales restantes

1. Remplacer les identifiants refusés et corriger leur format dans le maître, via [RunPod](https://console.runpod.io/user/credentials) et [Shotstack](https://app.shotstack.io/keys). Vérifier les droits du bon endpoint et l'activation du compte ; ne lancer aucune génération pour cela.
2. Obtenir l'accès et le contrat compatibles sur la [plateforme officielle Suno](https://platform.suno.com/). L'adaptation du code revient au propriétaire, pas à une manipulation utilisateur de paramètres supposés.
3. Après correction du raccord Zernio par l'équipe, consentir uniquement aux comptes/destinations choisis dans le [parcours officiel](https://docs.zernio.com/guides/connecting-accounts). Aucun consentement n'est demandé avant ce correctif.

Intégration du delta T05, diagnostic administratif Shotstack, adaptation Suno/OAuth, rotation/révocation et réconciliation des origines restent des tâches internes distinctes. Aucun déploiement ni modification distante de configuration n'est autorisé par ce rapport.
