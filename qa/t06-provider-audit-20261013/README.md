# SUTRA T06 — audit final fournisseurs et autonomie sociale

13 octobre 2026. **AUDIT TERMINÉ ; ACTIVATION FOURNISSEURS BLOQUÉE.** Base `48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4`, descendante de `589732cb49959c1a576a3ba381b310cd594600ac`. Branche `codex/sutra-t06-provider-audit-20261013`. Aucun code produit modifié par T06, aucun appel payant, génération, compte connecté, publication, migration, fusion ou déploiement.

Instructions et verrous lus avant intervention, `POLICY_OK`. T01/T04 possèdent les sondes depuis le maître et Mac/OVH ; T08 les contre-tests et gates communes ; T02 la correction des erreurs GET comptes ; T05 la sélection de clé Shotstack. T06 livre le complément comptes/consentements/révocation/reprise et la synthèse. Le journal T08 est normalisé uniquement pour ses espaces de fin de ligne (empreinte source conservée). Les snapshots ci-joints sont leurs preuves expurgées, **pas des sondes indépendantes T06**. `source-manifest.json` donne auteurs, chemins, SHA et empreintes : 752 fichiers produit/tests/config identiques à T01/T08, aucun PASS inchangé rejoué par T06.

## Verdicts et preuves gratuites

| Fournisseur | Verdict | Preuve et limite |
| --- | --- | --- |
| RunPod | **ACTION UTILISATEUR REQUISE** | Liste endpoints et health : HTTP **401**, même après normalisation diagnostique du maître, Mac et OVH. Health classe la clé invalide. L'endpoint, ses permissions et son worker restent non validés. |
| Shotstack | **ACTION UTILISATEUR REQUISE** | Deux clés × deux environnements officiels `stage`/`v1`, GET templates : **403 INVALID_OR_DISABLED** pour chaque combinaison, Mac et OVH. Inverser les environnements ne résout pas le refus. Clé invalide, désactivée et restriction de compte ne sont pas départageables par cette réponse. |
| Suno | **BLOQUÉ pour SUTRA ; authentification tiers VALIDÉE pour GET crédits** | L'ancien `SUNO_BASE_URL` utilisé par SUTRA répond **503** sans credential envoyé. L'alias maître `SUNO_API_BASE_URL`, inutilisé dans le code, désigne `sunoapi.org` : GET crédits avec clé maître normalisée répond **HTTP 200 + code 200**, schéma valide. Aucun morceau généré. Ce tiers n'est pas la plateforme officielle Suno et son contrat diffère du client SUTRA. |
| Zernio / réseaux | **Authentification GET VALIDÉE ; connexion/publication BLOQUÉE** | GET accounts **200**, zéro compte connecté, Mac/OVH ; T01 GET profiles **200**, un profil. OAuth SUTRA incompatible avec le contrat actuel, rattachement utilisateur/organisation au profil absent. Aucun droit de publication ni consentement validé par ces GET. |

Preuves : `t04-master-mac-vps-normalized.json`, `t01-master-mac-normalized.json`, `t01-suno-alternative-auth.json`, `t08-zernio-contract.json`. Sondes GET, TLS vérifié, aucune redirection d'identifiants, tentatives bornées ; T04 : timeout 18 s, une tentative par sonde. L'erreur fournisseur brute n'est pas consignée. Les refus après normalisation, et non les premières valeurs mal formées, fondent les verdicts.

## Source unique et configurations comparées en lecture seule

**Credentials des sondes : `~/.env.purama.master`, mode 0600.** Aucune valeur affichée, aucun secret copié par T06, aucun `.env.local` créé ou modifié. Mac : `~/purama/sutra/.env.local`, mode 0600, comparé seulement. OVH : conteneur `purama-sutra` actif et sain selon T04, configuration et sondes lues sans modification ; image `sha256:956b477deb4b7049914db5f51d934cf15fb0c3ea5fe289d6029c23b4c599e417`.

| Variables | Provenance et concordance |
| --- | --- |
| `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID` | Une occurrence dans le maître ; suffixe littéral `\n` supprimé **en mémoire seulement** pour diagnostic ; alors identiques au Mac et au conteneur actif. |
| `SHOTSTACK_API_KEY`, `SHOTSTACK_PRODUCTION_KEY` | Même constat ; valeurs non enregistrées. |
| `SUNO_API_KEY`, `SUNO_BASE_URL` | Même suffixe/concordance diagnostique ; la base legacy n'est pas un contrat officiel API qualifié. |
| `SUNO_API_BASE_URL` | Présent dans le maître, absent du Mac/runtime, inutilisé par le code ; désigne le tiers dont l'authentification GET a été prouvée. |
| `ZERNIO_API_KEY`, `ZERNIO_BASE_URL` | Présents dans le maître, identiques au Mac/runtime sans normalisation. |
| `ZERNIO_WEBHOOK_SECRET` | Présent dans le maître, absent du Mac/runtime ; aucun consommateur webhook trouvé. |
| `RUNPOD_POD_URL`, `SHOTSTACK_ENV`, `SHOTSTACK_BASE_URL` | Non fournis dans le maître ; les deux premiers également absents des configurations comparées. Shotstack utilise par défaut `stage` et des URLs fixes, pas cet alias de base. |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL` | Présents mais différents entre maître et application ; les origines du maître ne sont pas celles de SUTRA. Ne pas remplacer le callback avec une valeur globale. |
| `CRON_SECRET`, `NEXT_PUBLIC_APP_SCHEMA` | Présents dans le maître et sur Mac mais différents ; hors correction T06, ne pas recopier. |
| `NEXT_PUBLIC_SUPABASE_DB_SCHEMA`, `SUPABASE_APP_SCHEMA` | Présents dans le maître, absents de la configuration Mac examinée ; alias à ne pas substituer au schéma canonique. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_SUPABASE_URL` | Absents du maître, présents sur Mac ; non utilisés comme credentials par les sondes. Les variables Google ne constituent pas un connecteur social natif démontré. |

Les six suffixes restent dans le maître : aucune correction de secret effectuée. Le parseur dotenv transforme le suffixe en retour à la ligne ; `.trim()` reproduit les valeurs Mac, sans expliquer à lui seul les refus persistants (`t04-master-format.json`). Deux fichiers runtime correspondent aux fournisseurs normalisés ; un troisième diffère. L'échec SSH255 T01 et l'hôte maître différent de l'origine déployée restent archivés (`t01-vps-attempt.json`) ; ils n'annulent pas la vérification OVH réussie par T04. Ne pas modifier la cible OVH ou ses configurations à partir de ces seuls écarts.

## Contrats, reprise et erreurs

- **RunPod** : une seule soumission POST, intention/checkpoint avant appel, GET de statut après identifiant persisté, timeout borné, redirections refusées et erreurs HTTP expurgées. Réponse perdue = `unknown`/réconciliation, pas de nouvelle génération automatique ni de fallback. La clé refusée empêche de qualifier le schéma du worker et l'idempotence distante ; un timeout ne prouve pas un job annulé.
- **Shotstack** : URLs attendues `https://api.shotstack.io/edit/stage` et `/edit/v1`. Soumission unique, checkpoint de render puis GET, requête de polling 15 s et budget 300 s ; 401/403/404 fatals. T05 corrige sur sa branche la sélection `SHOTSTACK_PRODUCTION_KEY` pour `v1` ; le code de base utilisait toujours la clé sandbox. Ce correctif n'est pas intégré ici et n'annule pas les 403. T04 a réservé séparément l’alignement du diagnostic administratif `env.ts` ; non intégré ici.
- **Suno** : le client attend POST `/generate` avec `id` puis GET `/songs/:id` ; le tiers fournit une enveloppe de tâche et GET `/generate/record-info?taskId=…`. Changer seulement l'URL ne suffit pas. La [documentation actuelle du tiers](https://docs.sunoapi.org/suno-api/get-remaining-credits) affiche aussi une autre origine ; aucune clé n'y a été transférée par T06. La [plateforme officielle Suno](https://platform.suno.com/) propose une API derrière connexion : ne pas affirmer qu'aucune API officielle n'existe. Choix de fournisseur et adaptateur compatibles requis. T08 reproduit une fuite d’erreur dans une réponse fournisseur 2xx ; le cas HTTP401 est expurgé. T04 a réservé son correctif, non intégré dans cette base.
- **Social** : [SOCIAL-AUDIT.md](SOCIAL-AUDIT.md) détaille le contrat OAuth, TTL/state à usage unique, liaison utilisateur/navigateur présente et session précise/organisation absentes, scopes minimaux, expiration, refresh sans consommateur, révocation locale avant tentative distante, tokens conservés et invalidation native non démontrée. Les garde-fous production/plateforme/compte, média vérifié/approbation, reprise après réponse perdue, statut distant et état partiellement publié sont conservés. PR2 calendrier IANA/DST/récurrence/déduplication inchangé. TikTok exige des choix/consentements par média non représentés ; Pinterest nécessite une destination tableau explicite. Ne pas inventer ces consentements.

## Tests et périmètre de validité

| Auteur / preuve | Résultat |
| --- | --- |
| T01 `t01-free-gates.json`, contrats avec garde réseau et fixtures | **480 PASS, 7 SKIP, 0 FAIL**, puis schedule/composition/publication PASS. Commandes exactes conservées. |
| T08 `t08-typecheck.json`, `t08-lint.json` | TypeScript PASS, lint PASS avec 0 erreur / 111 avertissements hérités. Équivalence des 752 fichiers vérifiée par T06. |
| T08 `t08-redteam.json` + `.log` | **1 PASS / 5 FAIL** : endpoint OAuth, paramètres, réponse `authUrl`, callback hébergé, erreur Suno 2xx. Ces FAIL restent ouverts. |
| T02, branche distincte | Correction d’expurgation GET comptes et 12 régressions livrées en `312522a8c0cb7a011eaf42d7459e3c635b75f8e3` ; 492 contrats PASS/7 SKIP selon le handoff propriétaire. Pas intégrée ni retestée par T06. |
| T05, branche distincte | Correctif Shotstack livré en `47e49ee94381ed1e8a378f22efd66676b68e032f`, 89 tests ciblés et 488 contrats PASS / 7 SKIP, typecheck/lint/build PASS selon son rapport ; pas intégré ici. |
| T06 | Vérification documentaire, empreintes des snapshots et des sources, diff borné, JSON/guard, absence de secrets dans le lot ; `validation.json`. `detect_changes` : LOW, 3 sections documentaires, aucun processus affecté ; index partiel/périmé, aucune certification exhaustive de graphe. |

Les SKIP préservent les frontières réseau/DB. Aucun test fournisseur payant, nouveau build produit ou parcours OAuth réel rejoué par T06. Les builds et CI antérieurs sont historiques ; les validations des branches modifiées T02/T05 leur appartiennent. La seule configuration modifiée ici est `vercel.json`, désactivation de l'auto-preview **pour cette branche T06 uniquement** avant le push autorisé. Aucun workflow déclenché volontairement.

## Actions minimales réservées à l'utilisateur

1. Dans [RunPod Credentials](https://console.runpod.io/user/credentials), vérifier le bon compte/endpoint et activer ou remplacer la clé refusée, avec permission de lecture de cet endpoint pour le diagnostic. Dans [Shotstack API Keys](https://app.shotstack.io/keys), vérifier clés Sandbox/Production et compte actif ; solliciter leur support si des clés confirmées actives restent refusées. Enregistrer les valeurs uniquement dans le maître, sans suffixe parasite ; jamais dans un message.
2. Confirmer le fournisseur musical voulu : [Suno officiel](https://platform.suno.com/) ou le tiers déjà authentifié [sunoapi.org](https://sunoapi.org/). L'équipe adaptera ensuite le contrat ; aucun achat/génération requis pour cette décision.
3. **Après correction OAuth**, autoriser seulement les réseaux souhaités dans le [parcours Zernio](https://docs.zernio.com/guides/connecting-accounts), choisir les destinations exactes et les consentements de publication. La liste par réseau et les particularités Bluesky/TikTok sont dans [SOCIAL-AUDIT.md](SOCIAL-AUDIT.md).

Les corrections techniques OAuth/Suno, la liaison des profils, les diagnostics/configurations applicatives et l'intégration des lots appartiennent à l'équipe, pas à des consentements à demander prématurément à l'utilisateur. Aucune activation réelle autorisée par ce rapport.
