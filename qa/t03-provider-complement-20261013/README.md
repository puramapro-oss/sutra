# SUTRA T03 — complément pipeline et audit fournisseurs

13 octobre 2026. Branche `codex/sutra-t03-provider-complement-20261013`, base exacte `48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4`. **Complément local validé ; activation fournisseurs bloquée.**

Les verrous T01/T04 (sondes maître/Mac/OVH), T05 (Shotstack), T06 (social), T02 (sécurité) et T08 (contre-tests) sont respectés. T03 ajoute seulement des tests de reprise et consolide leurs preuves expurgées. Aucun symbole produit, secret, `.env.local`, service, compte ou configuration distante modifié ; aucun appel fournisseur par T03. Aucun déploiement, fusion, migration, publication ou génération payante.

Le push déjà demandé est protégé par une seule entrée locale `vercel.json` : aperçu désactivé pour cette branche T03 uniquement. Les autres branches et les workflows sont inchangés ; aucun workflow push ne cible cette branche. Cette garde ne constitue pas un déploiement ni une modification de la configuration du service en cours.

## Résultat par fournisseur

| Fournisseur | Verdict | Preuve et limite |
| --- | --- | --- |
| RunPod | **BLOQUÉ — action utilisateur requise** | T01/T04 : GET liste endpoints 401. Après retrait diagnostique en mémoire du suffixe littéral `\n`, GET health encore 401 `INVALID_API_KEY`, depuis Mac et OVH. L'accès à l'endpoint et ses permissions ne sont donc pas validés. |
| Shotstack | **BLOQUÉ — action utilisateur requise** | Deux clés × deux environnements `stage`/`v1`, GET templates : quatre 403 `INVALID_OR_DISABLED`, aussi après normalisation, Mac et OVH. Les URLs correspondent à la référence officielle. Une simple inversion stage/prod n'explique pas ces quatre refus ; clé désactivée, mauvaise clé ou restriction du compte restent indissociables avec cette réponse. |
| Suno | **BLOQUÉ — contrat à remplacer/qualifier** | `SUNO_BASE_URL`, variable effectivement utilisée, désigne l'ancien contrat `api.suno.ai/v1` après normalisation : GET public 503, sans envoi de clé. `SUNO_API_BASE_URL` désigne `sunoapi.org`, fournisseur distinct, mais cet alias n'est pas lu par le code. Aucune authentification musicale validée ; aucun transfert de clé entre ces domaines. La plateforme officielle Suno existe maintenant et doit être distinguée de ce tiers. |
| Zernio | **VALIDÉ pour l'authentification GET seulement ; OAuth SUTRA BLOQUÉ** | GET accounts 200, zéro compte connecté, Mac et OVH ; GET profiles T01 200, un profil. Cela ne prouve ni des droits de publication ni le raccord OAuth. Le code utilise `/oauth/url`, `/oauth/exchange`, `/oauth/refresh`, absents du contrat OpenAPI examiné. |

Preuves : `provider-evidence.json` conserve les résultats expurgés et les chemins/empreintes des originaux T01/T04/T08/T06/T05. Les mesures sont datées dans les fichiers propriétaires ; elles ne certifient pas leurs futurs changements.

## Provenance et configuration

Source de credentials des sondes : **`~/.env.purama.master`, mode 0600**. T03 a vérifié en lecture privée la présence unique, sans doublon contradictoire, de `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, `SHOTSTACK_API_KEY`, `SHOTSTACK_PRODUCTION_KEY`, `SUNO_API_KEY`, `SUNO_BASE_URL`, `ZERNIO_API_KEY`, `ZERNIO_BASE_URL`. Aucune valeur n'est enregistrée ici.

T01/T04 démontrent un suffixe littéral `\n` sur les six premières variables de cette liste. Leur retrait **en mémoire uniquement** rapproche ces valeurs des configurations Mac/OVH, sans rendre RunPod ou Shotstack valides. Le maître n'a pas été corrigé par T03. Les URLs publiques APP/SITE du maître diffèrent de celles de l'application ; ne pas recopier tout le fichier aveuglément. `ZERNIO_WEBHOOK_SECRET` est présent dans le maître et absent des configurations applicatives examinées ; sa présence seule ne raccorderait pas les événements.

T04 a lu le conteneur OVH `purama-sutra` : actif/sain, image `sha256:956b477deb4b7049914db5f51d934cf15fb0c3ea5fe289d6029c23b4c599e417`. Les variables fournisseurs actives correspondent au maître normalisé. Les configurations historiques supplémentaires ne sont pas toutes équivalentes. L'échec SSH initial T01 ne remplace pas cette preuve OVH ultérieure, et l'ancien hôte du maître ne doit pas être promu automatiquement comme cible active.

## Reprise, facturation et média final

Le nouveau test utilise le véritable chemin par défaut de `executeProductionStep` vers Suno, avec HTTP et stockage durable simulés. Environnement synthétique uniquement ; garde réseau existante `qa/t08/offline.cjs`, aucune clé maître chargée.

**9/9 PASS** : panne réseau de soumission, HTTP 503 de soumission, panne de polling, HTTP 403 de polling, écriture résultat refusée, accusé résultat perdu, accusé étape perdu, succès puis reprise, intention non confirmée. Chaque cas vérifie zéro second POST ; l'intention non confirmée vérifie zéro HTTP. Le résultat déjà persisté est repris sans fournisseur. Une intention sans résultat reste `SUTRA_RECONCILIATION_REQUIRED`.

Limite explicite : ce comportement empêche la relance facturable, mais ne garantit pas une reprise automatique. L'identifiant Suno n'est pas persisté avant son polling ; une interruption à cet endroit nécessite une réconciliation. Le helper WAN présente une limite analogue avant l'enregistrement du résultat. Ne jamais effacer le marqueur `started` pour débloquer un job incertain.

Revue directe du code inchangé : checkpoints distincts script/scènes/images/voix/musique/sous-titres/composition/export/publication, résultat mis en cache après confirmation de persistance, écritures sous bail vérifiées, état final exigeant média vérifié URL + SHA-256 + dimensions/durée/fréquence et pistes obligatoires. Le correctif T03 précédent est déjà intégré ; ses tests DB/concurrence n'ont pas été refaits sans delta. Les nouveaux mocks ne sont pas une preuve PostgreSQL ni une preuve média distante.

RunPod : un seul POST `/run`, redirections refusées, polling borné, erreurs HTTP expurgées, état de soumission incertain conservé. Le timeout local ne démontre pas l'échec du job. Le schéma `input` dépend du worker et ne peut être certifié avec une clé refusée. La rétention officielle limitée des résultats impose une réconciliation avant toute nouvelle demande.

Suno : soumission sans retry POST, polling borné, mais contrat distant non qualifié et payload d'erreur 2xx propagé brut. T08 reproduit ce dernier défaut à la route musique ; à corriger par le propriétaire fournisseur. Les protections de reprise T03 ne le corrigent pas.

## OAuth : contrôles présents et blocages

State aléatoire, hash SHA-256 et secret navigateur, TTL 600 s, consommation atomique DELETE RETURNING filtrée par utilisateur/plateforme/navigateur/expiration, session utilisateur relue, cookie HttpOnly/Lax/Secure en HTTPS : contrôles locaux présents. Aucun identifiant distinct de session ni rattachement serveur organisation → profil Zernio n'est persisté.

Le contrat actuel attend `/connect/{platform}`, `profileId`, `redirect_url`, réponse `authUrl`. Le callback hébergé retourne `connected/profileId/accountId/username` ; le code attend `code/state/platform`. Les identifiants de retour doivent être relus côté serveur et liés au profil autorisé. `scopes=posting` permet une minimisation sur les plateformes compatibles, avec leurs permissions d'identité/renouvellement/sélection obligatoires. Ce réglage n'est pas présent dans SUTRA.

Expiration invalide/expirée et révocation locale bloquent la publication ; expiration absente ne prouve pas la validité distante. `refreshAccessToken` n'a pas de consommateur trouvé ; santé distante et événements `account.disconnected` non raccordés. Révocation locale avant DELETE distant, statut incertain conservé si panne ; tokens historiques non effacés et invalidation côté réseau non démontrée. Aucun consentement, refresh, DELETE ou publication réel testé.

T08 : **1 PASS / 5 FAIL** de contre-tests, quatre écarts OAuth et une fuite d'erreur Suno. Ces échecs sont des blocages réels, pas des tests ignorés. Les correctifs T02/T05 en cours ne sont pas intégrés par cette branche.

## Validation reproductible et limites

Commande : `python3 qa/t03-provider-complement-20261013/verify.py` ; sélection possible `music-recovery`, `typecheck`, `lint`.

- Reprise T03 : 9 PASS, 0 échec, 0 ignoré.
- TypeScript ciblé, adaptateur et imports inclus : PASS. Le premier essai isolé omettait les types ambiants Next ; le tsconfig de test a été corrigé, aucun code produit modifié.
- ESLint du nouveau test : PASS, zéro avertissement.
- Gitleaks sur les nouvelles preuves, avec sortie expurgée : PASS, zéro secret détecté.
- T08 : TypeScript et lint complets PASS sur code/config équivalents à T01 ; réutilisés, sans doublon de gate. Les cinq contre-tests rouges restent distincts.
- T05 : contrats Shotstack/media et TypeScript/lint PASS sur sa branche modifiée uniquement ; aucune certification de ce correctif sur la présente branche.
- GitNexus `detect_changes` exécuté : worktree isolé non enregistré, sortie 1. L'index T01 consulté pour navigation avait six commits de retard ; aucune certification exhaustive de graphe. `source-manifest.json` établit l'équivalence des sources et paramètres de validation examinés. La seule configuration modifiée est la garde d'aperçu Vercel de cette branche.
- Aucun nouveau build : pas de modification produit ; preuve de build/CI intégrée précédente conservée. Le nouveau test est vérifié séparément.

## Actions restantes minimales

1. Corriger les six suffixes littéraux dans le maître, puis y fournir une clé RunPod active autorisée sur l'endpoint exact et les bonnes clés Shotstack actives stage/production. Consoles : [RunPod credentials](https://console.runpod.io/user/credentials), [Shotstack keys](https://app.shotstack.io/keys). Ne pas envoyer les valeurs dans un message. Si les clés actives restent refusées, faire vérifier l'état du compte par le support fournisseur.
2. Confirmer le compte/fournisseur musical voulu et son accès API : [plateforme officielle Suno](https://platform.suno.com/). Le contrat ancien n'est pas prouvé compatible ; l'alias tiers ne permet pas de deviner à quel service appartient la clé. Adapter et qualifier le client avant activation.
3. Après correction OAuth, autoriser uniquement les réseaux voulus dans le parcours Zernio et choisir explicitement leurs destinations. Liste exacte par réseau dans le [rapport T06](../../../sutra-t06-social-autonomy-20261012/qa/t06-provider-audit-20261013/SOCIAL-AUDIT.md) : chaîne YouTube, Page Facebook, compte Instagram professionnel, compte X, profil/organisation LinkedIn, compte et consentements TikTok par média, tableau Pinterest, compte Threads/Reddit et destination Reddit ; mot de passe d'application distinct pour Bluesky. Aucune connexion requise tant que le raccord SUTRA est bloqué.

Les corrections OAuth, l'expurgation Suno et la qualification des contrats sont des tâches techniques des propriétaires, pas des consentements à déléguer à l'utilisateur.

## Références officielles consultées

- [RunPod requêtes et états](https://docs.runpod.io/serverless/endpoints/send-requests)
- [Shotstack API](https://shotstack.io/docs/api/)
- [Suno officiel](https://platform.suno.com/) ; [documentation du tiers sunoapi.org](https://docs.sunoapi.org/)
- [Zernio connexion, callback et scopes](https://docs.zernio.com/connect/get-connect-url), [multi-tenant](https://docs.zernio.com/multi-tenant), [santé des comptes](https://docs.zernio.com/accounts/get-account-health)
