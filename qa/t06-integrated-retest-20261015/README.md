# T06 — recette sociale intégrée, 15 octobre 2026

Verdict : **PASS local composite : correctif T06 + correction SQL livrée par T01,9/9tests intégrés**. Le candidat de base conserve son rouge8/1 ; le nouveau SHA intégré T01 reste à recevoir. Aucune certification de production, aucun consentement ni envoi réel.

## Base et intégration

- Branche : `codex/sutra-t06-integrated-retest-20261015` ; base T01 `56754679abed9aa1e51323c29aed5bef38bc17d0`, reçus documentaires du produit `d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2`.
- Lot précédent `10693a2096c8b193d9adf034f1863966c212c393` : 48 chemins comparés, 45 fichiers non partagés identiques ; seuls BATON/task_plan/ERRORS ont été consolidés par T01. `integration.json` est le contrôle **avant** le nouveau correctif, pas une affirmation que le nouveau delta est intégré.
- Le SQL historique intégré est `migrations/20261015_social_authorization_history.sql`. Aucun changement SQL/configuration/OVH effectué par T06.
- `source-manifest.json` identifie les sources et dépendances vérifiées. Environnement enfant limité aux chemins système et valeurs de fixture ; aucun fichier de secrets lu. Toutes les identités sont synthétiques. Garde réseau `qa/t08/offline.cjs`, fournisseur remplacé par un transport simulé. PostgreSQL18 sur port loopback éphémère, cluster propre arrêté et conservé après chaque campagne, y compris en échec.

## Défauts reproduits

### T06-INTEGRATED-01 — PASS après correction locale

Reproduction avant correction : créer un consentement via les vraies routes, activer le vrai `trigger_social_accounts_updated_at`, puis simuler DELETE fournisseur200. Le trigger remplace `updated_at` fourni par JavaScript ; la confirmation CAS utilise alors un timestamp différent. Résultat503, barrière pending persistante et reconnexion409 malgré succès distant. Le test antérieur sans ce trigger ne reproduisait pas le défaut.

Un seul fichier produit corrigé : `src/lib/social-account-revocation.ts`. Après confirmation distante, relire le snapshot SQL ; vérifier identité, utilisateur/plateforme de lecture, cible distante, statut, révision de cette opération, pending et provenance/profil. Confirmer par CAS sur ce snapshot exact. Une modification concurrente reste refusée ; aucun deuxième DELETE. Un nettoyage concurrent des anciennes credentials peut changer le timestamp sans invalider la révision légitime.

Le parcours connexion → révocation → deuxième révocation idempotente → reconnexion est vert avec les deux vrais triggers. L'historique garde connection/revocation_requested/revocation_confirmed/reconnection, les tokens restent absents. Les courses avant et après relecture empêchent une fausse confirmation ; 12 nettoyages concurrents ne causent qu'un seul DELETE.

### T06-INTEGRATED-02 — FAIL de base, PASS avec correction propriétaire T01

Ancien compte connected avec `credential_owner=zernio` et un `zernio_profile_id` valide, sans `sutra_oauth_revision`. La première révocation crée la révision et pending, mais le trigger historique calcule `old_scoped=false`, puis refuse la transition avec `SUTRA_SOCIAL_HISTORY_REVOCATION_INVALID`. Route503 ; la transaction annule la barrière et l'effacement des anciens tokens ; aucun DELETE distant.

Cas exact : dernier test de `history-routes.test.mts`, `legacy scoped account without revision must still revoke locally`. Le rouge n'est ni ignoré ni marqué attendu : la commande `history` sort1. T01 a reçu le défaut puis livré sa correction SQL à13:30UTC : provenance Zernio stricte, profil valide inchangé, absence réelle de révision et absence de révocation pending. Aucun consentement antérieur inventé. Copie de fixture exacte `t01-social-history.sql`, SHA256 `d2f6a9cb380a15285759085cdf602701f0d9d785d4a7f76f2061438d38ab9ddc`, provenance dans `t01-social-history-source.json`. T06 ne modifie pas la migration propriétaire. Le retest **history-t01 passe9/9** avec les deux corrections ; preuve `postgres-t01.log`. Ce PASS composite ne modifie pas rétroactivement le verdict du SHA de base.

## Preuves et commandes

Runtime de cette exécution : `/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node` (Node24). Depuis la racine du worktree, `NODE24` ci-dessous désigne ce binaire ; `run.mjs` accepte aussi `SUTRA_QA_NODE_BINARY`. Chaque reçu `*-result.json` conserve l'argv exact et le résultat. À la demande T01, le runner accepte `SUTRA_TEST_PG_BIN`, défaut Mac conservé ; chemin explicite testé. Après intégration du SQL propriétaire, Linux CI pourra utiliser `SUTRA_TEST_PG_BIN="$(pg_config --bindir)" NODE24 qa/t06-integrated-retest-20261015/run.mjs history`. Linux lui-même est NON TESTÉ par T06.

| Commande | Résultat | Risque couvert |
| --- | --- | --- |
| `NODE24 qa/t06-integrated-retest-20261015/run.mjs oauth` | **PASS 76/76**, 0 skip | State aléatoire 32 octets, cookie séparé HttpOnly/Secure/SameSite, durée10min, session/utilisateur/profil, refus/rejeu/expiration, connexion/révocation/reconnexion, provenance tenant, tokens/erreurs expurgés. Rejoué après correctif. |
| `NODE24 qa/t06-integrated-retest-20261015/run.mjs publication` | **PASS 92/92**, 0 skip | Comptes absents/expirés/révoqués, médias URL+SHA vérifiés et approbation, partiel conservé par compte, reprise ciblée, réponse perdue/timeout, clés stables, réconciliation GET, aucune nouvelle création aveugle. Exécuté sur base avant delta ; seul consommateur touché rejoué ci-dessous. |
| `NODE24 qa/t06-integrated-retest-20261015/run.mjs schedule auto-publication` | **PASS**, assertions non TAP | Quotidien/hebdomadaire/toutes les 2 semaines/mensuel ; Europe/Paris été/hiver, trou avancé, heure répétée une seule fois selon politique existante, Lord Howe30min, ligne de date ; identités/limites d'occurrence, alias/comptes manquants. Code inchangé. |
| `NODE24 qa/t06-integrated-retest-20261015/run.mjs history` | **FAIL : 8 PASS / 1 FAIL / 0 skip** | Vraies routes + PostgreSQL18 + DDL/trigger timestamp et migration historique actuels. Concurrence12callbacks, state et audit atomiques, panne d'audit rollback, révocation confirmée/inconnue, courses ; seul ancien compte sans révision reste FAIL sur le SQL de base ; correction T01 testée séparément ci-dessous. |
| `NODE24 qa/t06-integrated-retest-20261015/run.mjs history-t01` | **PASS9/9**,0skip | Mêmes9cas, seul SQL historique remplacé par la copie exacte livrée par T01. Ancien compte sans révision révoqué, tokens effacés, connexion/reconnexion et courses préservées. |
| `NODE24 qa/t06-integrated-retest-20261015/run.mjs postgres-cas` | **PASS 7/7**, 0 skip | CAS réel24sessions, NULL/JSONB, révision et propriétaire, révocation concurrente, unicité première connexion. Fixture historique complémentaire, sans prétendre couvrir le trigger d'historique. |
| `NODE24 qa/t06-integrated-retest-20261015/run.mjs revocation-consumer` | **PASS 1/1** | Consommateur de publication affecté par le helper de révocation, déjà inclus dans les92 ; ne pas additionner comme nouveau test. |
| `NODE24 qa/t06-integrated-retest-20261015/run.mjs typecheck lint` | **PASS** | TypeScript ciblé avec imports produit ; ESLint sans warning sur helper et nouveau banc. |

Le premier banc intégré avait6tests, **4PASS/2FAIL** : `postgres-before-fix.log`. Le banc final en a9 (trois cas de course ajoutés) : `postgres.log` pour le SQL de base et `postgres-t01.log` pour le SQL corrigé T01. Les reçus avant correction sont conservés. `postgres-cas-tests.log` contient les7tests et `postgres-cas-tests-result.json` le reçu du cluster ; `postgres-cas.log` est le résumé du runner. Un chevauchement initial de noms de logs a été corrigé puis cette seule phase rejouée pour conserver les deux preuves.

Les reprises ne font pas un total de tests distincts. Aucun build/gate global identique relancé. La CI T01 verte sur d21b7b4 est une preuve de la base, pas une validation du présent delta produit. Le build global du delta est **NON TESTÉ** ici ; intégration et gate finale appartiennent à T01.

## GitNexus et contrôle de portée

Impact préalable de `revokeSocialAccount` : LOW, deux appelants directs indexés (DELETE accounts et ancien test PG), aucun processus indexé touché. Index local régénéré avant/après ; graphe **TRUNCATED**,1269entrées et678callees omis,3marches interrompues : absence de flux ≠ preuve d'absence. Les lectures directes et tests complètent cette analyse bornée. Résultats dans `gitnexus-impact-revoke.json`, index logs et `gitnexus-detect-*.txt`. Après réindexation incrémentale, les recherches impact par nom/UID deviennent UNKNOWN/target absent ; le résultat LOW est donc la preuve préalable seulement. Recherche directe confirme DELETE accounts et les deux consommateurs de tests rejoués. Impact du hook de fixture avant sélection du SQL également UNKNOWN. Le detect_changes staged signale **critical/363flux** avec associations manifestement hors périmètre (onConfirmation du banc vers KarmaHub/CommunityScreen, entre autres). Cette alerte est conservée et non certifiée ; elle ne remplace pas le diff exact : un seul helper produit, aucun SQL/API/UI. Le compare `main`, également critical et liste plafonnée, comprend la lignée candidate entière (3492fichiers/4159symboles) ; il ne représente pas le delta T06. Les logs bruts sont conservés avec normalisation des espaces de fin de ligne uniquement pour diff-check.

## Limites et prochaines actions

- **PASS logiciel local** : T06-INTEGRATED-01 et02 avec le helper T06 et le SQL exact T01,9/9. **FAIL historique conservé** : candidat de base et helper seul. T01 doit intégrer ces deux deltas puis publier le reçu `history` sur son SHA exact ; aucun nouveau défaut social non corrigé reproduit dans ce périmètre.
- **EN ATTENTE T01** : commit/intégration du composite et contrôle du binding réel utilisateur→profil→organisation. La correction SQL a été livrée et testée, elle ne reste plus un blocage logiciel local. Le modèle local lie un UUID utilisateur à un profil Zernio unique ; aucun identifiant d'organisation distinct n'est inventé par ce banc.
- **NON TESTÉ** : PostgREST/ACL complet en production, OAuth chez les fournisseurs, scopes effectivement accordés, rotation des tokens gérée par Zernio, révocation/reconnexion réelle, exécution cron et publication publique. Le champ historique `granted_scopes` reste null ; `posting` est la demande minimale du contrat applicatif, pas une preuve de tous les grants distants.
- **Absence de consentement** : intervention personnelle attendue de Matiss, distincte d'un bug. Aucune nouvelle clé demandée. Parcours exact dans `PARCOURS-MATISS.md` ; aucun clic de consentement effectué par l'agent.
