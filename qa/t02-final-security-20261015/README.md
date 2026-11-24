# T02 — sécurité finale locale, 15 octobre 2026

Base T01 `49c166d4c15412d2a3c1246c216cf0df319f2df0`, produit identique à `3855665fa79e3cc2171124d864a834214d6ac617` (CI `38598361267`). Branche `codex/sutra-t02-final-security-20261015`. Aucune production ni intégration annoncée par ce lot.

## Défaut T02-CAP-01 : révocation des capabilities médias

**CORRIGÉ LOCAL / PASS**. Une capability de publication émise avant la révocation continuait à obtenir un HTTP307 et une nouvelle signature Storage après `sutra_revocation_pending`, retrait/réaffectation du binding Zernio ou provenance du compte absente/invalide. `authorizePublicationMedia` vérifiait statut/identifiants/expiration mais omettait ces trois autorités déjà contrôlées par le journal T06.

Reproduction sur la route GET réelle, HMAC réel et résolveur de tenant réel ; seul le port DB/Storage et la session sont simulés. Deux utilisateurs UUID distincts, deux profils provider distincts. Le double DB applique les filtres utilisateur/projet/compte et la projection des colonnes. Aucun accès réseau.

Correction limitée à `src/lib/private-media.ts` : réutilisation de `getAuthorizedProfileId`, sélection et contrôle de `metadata.credential_owner`, `metadata.zernio_profile_id`, `metadata.sutra_revocation_pending`. Pas de système d'autorité parallèle, de modification OAuth, de migration ou d'abaissement de protection.

- Avant : `red.json`, `red-0.txt` — **10 PASS / 9 FAIL** ; les neuf refus attendus recevaient307.
- Après : `green.json`, `green-0.txt` — **19 PASS / 0 FAIL / 0 SKIP**. Les refus retournent404 sans corps, Location ni appel de signature ; les deux propriétaires valides restent autorisés.
- Régressions : `regression.json`, `regression-0.txt` — **22 PASS / 0 FAIL / 0 SKIP** : privé7, session/média4, transport/SSRF11.
- Le premier rejeu avait21 PASS/1 FAIL parce que l'ancienne fixture ne définissait ni UUID/binding/provenance. Trace `regression-legacy-fixture*` conservée. Seules ces données ont été adaptées ; assertions inchangées.
- ESLint et TypeScript ciblés : `quality.json`, deux codes0. Ni gate globale ni build identique rejoués. Leur dernier PASS porte sur3855665, pas sur le nouveau candidat à intégrer.

## Commandes exactes

Dans ce worktree, Node24.21.0 installé et dépendances identiques au lockfile de la candidate, sans installation :

```sh
python3 qa/t02-final-security-20261015/run.py --phase green
python3 qa/t02-final-security-20261015/run.py --phase regression
python3 qa/t02-final-security-20261015/run.py --phase quality
```

Chaque manifeste JSON contient l'argv exact et le journal. `run.py` démarre un environnement propre avec seulement PATH/LANG, puis les tests affectent leurs données synthétiques. Le preload `qa/t08/offline.cjs` bloque réseau distant et lecture des fichiers d'environnement. La phase `red` utilisait le helper produit de49c166d avant correction ; ne pas la rejouer sur le helper corrigé en prétendant reproduire l'ancien défaut.

## Couverture et limites par risque

Les PASS réutilisés ci-dessous sont ceux de la CI exacte3855665, dont le produit, les tests, la commande et le lockfile sont identiques à la base49c166d. `reused-evidence.json` vérifie40 entrées, neuf fichiers du précédent lot T02 et les corrections T03 RPC/T06 journal. Il distingue le helper privé désormais modifié. Les compteurs des familles historiques se recouvrent et ne doivent pas être additionnés aux41 tests frais.

| Risque précis | Statut et preuve | Limite / propriétaire |
| --- | --- | --- |
| Session absente, profil étranger, banni/révoqué, erreur DB | PASS réutilisé : `test-security-account`, `test-security-routes`, `test-auth-session` ; nouveaux refus401/404 et zéro signature | Auth Supabase réelle/session distante NON TESTÉE |
| Utilisateurs, projets, quotas et accès client au moteur personnel | PASS réutilisé : parcours T08, contrats owner-only Salad, PG pipeline16/Salad7 ; nouveaux croisements utilisateur/journal/projet/compte | Deux organisations applicatives NON TESTÉ : aucun modèle org/tenant applicatif trouvé ; deux profils Zernio distincts sont testés, sans les assimiler à deux organisations |
| RLS, privilèges des profils/récompenses/tokens/journaux/quota | PASS borné réutilisé :259 assertions PostgreSQL jetable, migrations canoniques, deux utilisateurs, refus de droits clients et révocation | Métadonnées readonly T01 reçues pour six tables ; qualification DML restante T01 ci-dessous |
| Stockage privé, ownership, traversée de chemin, expiration | PASS :22 régressions et19 nouveaux tests ; proofs stockage/route publique antérieures identiques | Bucket distant NON TESTÉ ; URL Storage déjà signée reste potentiellement utilisable jusqu'au TTL300s |
| Cron sans secret / secret dev / mauvais bearer / rotation | PASS réutilisé : `test-release-regressions`, helper existant `assertCronAuth` | Aucun cron exécutant génération/publication activé ; pas de mécanisme concurrent |
| OAuth state aléatoire, session, navigateur, usage unique, expiration, tokens privés | PASS borné réutilisé : `test-t02-oauth-boundaries`, contrats Zernio et PG reprise/OAuth26 | Nouveaux défauts callback/revoke annoncés T06 le15oct encore sous sa responsabilité ; consentement, refresh et révocation provider réels NON TESTÉS |
| SSRF, IP privées/réservées, mélange DNS, épinglage DNS, redirection privée | PASS réutilisé : `test-security-media`, OTS16 ;11 tests de transport rejoués car consommateur privé concerné | Internet/fournisseur réel NON TESTÉ ; aucune assertion de couverture exhaustive de tout réseau |
| Upload MIME/signature/taille, médias compressés/malformés/durée | PASS réutilisé : `test-auth-session`, `test-security-media`, CI médias120 | T05 seul corrige ses nouveaux défauts de concurrence/délais ; ce lot ne valide pas son WIP |
| CSRF, redirection ouverte, XSS/injection/IDOR aux frontières testées | PASS borné réutilisé : redteam14, `test-public-origin`, routes serveur et médias | Aucun audit dynamique universel ni pentest de production affirmé |
| Secrets/diagnostics et séparation clés/comptes sociaux | PASS : refus sans message DB, provenance Zernio ; lot OTS/preuve publique identique et RPC T03 intégré ; contrats Salad clés distinctes | Aucun secret réel lu/copier/env local ; intégration/config T01 uniquement |
| Dépendances applicables | PASS borné réutilisé : audit3855665,0 high/critical,2 low/5 moderate ; transport OTS corrigé | Alertes transitives conservées ; pas de mise à jour majeure aveugle ni affirmation que tout avis modéré est inexploitable |
| En-têtes | PASS borné : privé `private, no-store`, `nosniff` existant, politique origine CSRF | CSP/HSTS/X-Frame-Options globaux non prouvés dans Next ; reverse proxy/production T01, NON TESTÉ dans cette mission |

## RLS : point précis transmis à T01

`rls-inventory.json` inventorie84 définitions sensibles explicites dans les sources SQL/setup. Six ne présentent aucune instruction littérale d'activation RLS dans ces sources : `activity_logs`, `api_logs`, `error_logs`, `contest_submissions`, `referral_commissions`, `referrals`. Ce relevé statique ne prouve ni les ACL effectives ni un accès client exploitable. L'absence de grant client interdit déjà l'accès ; une activation/configuration distante peut aussi différer des sources.

La garde globale `t02_active_account` ne s'applique qu'aux tables déjà RLS ; les259 assertions ne prouvent pas ces six tables. T01, seul propriétaire SQL/config, a reçu le point et la requête **lecture seule** `rls-metadata-review.sql` (non exécutée ici, aucune ligne métier sélectionnée). **Réponse T01 reçue15oct01:14UTC** : RLS activée6/6 ; activity/api/error_logs sans privilège anon/authenticated ; contest_submissions/referrals/referral_commissions avec droits DML et politiques own_* ALL. Métadonnées expurgées et empreintes conservées dans `rls-t01-readonly-evidence.json`. T01 poursuit la qualification des écritures sur copie privée (notamment champs métier sensibles et liaison des deux parties), sans doublon T02. **BLOQUÉ : certification RLS exhaustive attend cette qualification externe**, pas les flags déjà fournis. Aucune exploitation production ni faux PASS général affirmés.

## GitNexus, provenance et dépendances

Index isolé sans embeddings. `index.txt` :19038 nœuds/36791 arêtes ; couverture **TRUNCATED** (1178 candidats supprimés,664 callees perdus,3 budgets de parcours). `impact-grant.txt` avant édition : LOW, un appelant direct GET média, quatre flows. `impact-fixture.txt` : UNKNOWN fichier de test, usages CI revus directement. Première query avant index indisponible, puis query/context réussis, traces conservées.

Analyse du diff avant commit : fichiers `detect-*.txt` ; staged MEDIUM, trois flows du helper attendu. Le compare/main est CRITICAL (2692 fichiers,7989 symboles,229 flows), inclut des changements historiques et ne certifie pas uniquement ce lot ; avertissement explicite communiqué. La revue exacte et les tests ciblés restent la preuve locale ; aucune exhaustivité du graphe affirmée. Scan expurgé : `secret-scan.json`/`secret-scan.log`.

Avis officiels déjà évalués dans le lot T02 intégré : [request SSRF](https://github.com/advisories/GHSA-p8p7-x288-28g6), [uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq), [elliptic](https://github.com/advisories/GHSA-848j-6mx2-7j84). Package/lock inchangés ; chemins OTS et résultats d'audit conservés dans `qa/t02-security-fixes-20261014`.

## Réception

T01 doit ajouter `scripts/test-t02-final-security-grants.mts` à son runner CI, intégrer les seuls fichiers remis, recevoir les deltas T06/T05/T03 puis qualifier le candidat exact avec T08. Aucun autre auteur, callback, worker, migration ou config n'a été modifié. Toutes les écritures locales ont été réservées avant édition. Aucun push/fusion/déploiement, appel fournisseur, calcul IA/GPU, secret, compte connecté ou publication.

Contrôle final de format : espaces de fin de ligne et ligne blanche finale des sorties de test normalisés après échec initial de `git diff --cached --check`. Aucun message, résultat ou code de sortie modifié ; aucun test rejoué pour ce changement documentaire.

Mise à jour T01 reçue15oct01:15UTC : **FAIL EXTERNE REPRODUIT / CORRECTION T01 EN COURS**. Sur copie privée restaurée, trois écritures injustifiées sont confirmées : commission amount/status, referral level/processed et concours score/votes/status sous authenticated. Transactions synthétiques annulées ; aucune production modifiée. RLS activée ne protégeait pas ces colonnes du propriétaire. T01 réserve `migrations/20261015_client_write_permissions.sql` et ses tests ; T02 ne duplique pas. Preuve et empreinte référencées dans `qa/t02-final-security-20261015/rls-t01-owner-followup.json`. Ce constat remplace le statut antérieur de simple qualification en attente ; intégration finale BLOQUÉE à la correction et au retest T01/T08.
