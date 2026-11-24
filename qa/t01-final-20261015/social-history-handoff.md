# SUTRA — historique d’autorisation social, auxiliaire T01

Date : 2026-10-15. Propriétaire : délégation unique T01, agent oauth_owner. Base locale : `49c166d4c15412d2a3c1246c216cf0df319f2df0`, branche `codex/sutra-final-providers-20261013`. Sources figées ; aucun commit ni déploiement effectué par cette délégation.

## Livré et testé localement

- `migrations/20261015_social_authorization_history.sql` : journal append-only `sutra.social_authorization_history`, déclencheur atomique sur `public.social_accounts`, strictement pour les lignes marquées `credential_owner=zernio` et `sutra_oauth_revision`.
- `scripts/test-final-social-history.mjs` : 23 contrôles PostgreSQL réels, privés, avec fixtures synthétiques. Aucun transport distant ni fournisseur. Le cluster créé par le test est arrêté ; aucune autre instance n’est affectée.
- `social-history-metadata.sql` : lecture seule, état absent géré par `to_regclass`, empreinte table/RLS/ACL, colonnes/ACL/défauts, contraintes/indexes, politiques, déclencheurs, fonctions/droits/SECURITY DEFINER/search_path. Ne lit ni comptes ni événements.
- `social-history-rollback.sql` : retire seulement le déclencheur de capture et sa fonction ; conserve table, événements, RLS, ACL, fonction et déclencheur d’immutabilité. La capture reste suspendue jusqu’à réapplication explicite.

## Contrat T06

Le CAS existant reste la source des opérations ; aucune modification des routes, des services T06 ou de l’UI n’est nécessaire pour alimenter le journal. L’UUID `sutra_oauth_revision` est l’identifiant de révision/opération. Un événement est unique par `(account_id, revision_id, event_type)`.

Événements : `connection`, `reconnection`, `revocation_requested`, `revocation_confirmed`, et `authorization_observed` pour la seule révision historique effectivement présente avant la première transition observée. L’observation historique ne reconstitue pas les anciennes autorisations déjà perdues, ne prétend pas connaître leur date, leur consentement ou leurs scopes demandés. Son horodatage est celui du serveur au moment de l’observation.

`requested_scopes=['posting']` uniquement pour les nouvelles connexions/reconnexions écrites par le flux SUTRA ; `NULL` pour les observations historiques et révocations. `granted_scopes=NULL`, `grant_evidence='unknown'` partout. `profile_provenance='application_server_metadata'` décrit la provenance réelle ; elle ne prétend pas constituer une attestation indépendante du fournisseur. `remote_outcome='unknown'`, sauf confirmation persistée de révocation, qui produit `confirmed_revoked` avec la même révision que la demande. Une demande incertaine conservant `pending=true` n’invente pas un second événement.

Projection limitée aux identifiants, propriétaire, plateforme, état, scopes demandés, provenance et horodatage. Aucun token, état OAuth, session, corps d’erreur ou métadonnée libre recopié. L’ID externe et le profil sont bornés au format Zernio 24 hex ; révision UUID. Propriétaire/id/plateforme immuables lors d’une transition. Un profil absent, désactivé ou banni ne peut établir une nouvelle connexion.

L’écriture directe du journal est refusée à `PUBLIC`, `anon`, `authenticated`, `service_role`, y compris les droits de colonnes. Lecture utilisateur : propriétaire + `sutra.account_is_active()`. Lecture serveur conservée. Fonction de capture `SECURITY DEFINER`, `search_path=''`, références qualifiées et périmètre du déclencheur vérifié. Pour les lignes SUTRA, l’auteur SQL doit être `service_role`, superutilisateur ou propriétaire de la table partagée ; un autre rôle d’application n’obtient pas les droits du déclencheur. Les lignes non SUTRA restent inchangées, même pour un autre rôle écrivain. L’échec d’une insertion du journal annule la mutation du compte dans la même transaction.

## Preuves exactes

Depuis le worktree d’intégration :

```sh
/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node scripts/test-final-social-history.mjs
/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node --check scripts/test-final-social-history.mjs
/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node node_modules/eslint/bin/eslint.js scripts/test-final-social-history.mjs
node .gitnexus/run.cjs detect-changes --scope all --repo .
```

- PostgreSQL 18.4 Homebrew, Node v24.21.0 : **23 PASS / 0 FAIL / 0 SKIP**. Rapport : `social-history-result.json`, sortie : `social-history-tests.log`.
- Syntaxe JS et ESLint ciblé : exit 0 ; sortie lint : `social-history-lint.log`.
- Réapplication de migration : faits et empreinte identiques ; ACL/RLS de la table partagée inchangées.
- Rollback : historique conservé et toujours protégé ; écriture du compte pendant suspension sans faux événement ; réapplication suivie d’une transition produit une observation historique aux scopes inconnus puis une reconnexion. Métadonnées : `social-history-baseline-metadata.json`, `social-history-metadata.json`, `social-history-rollback-metadata.json`.
- Autres contrôles : huit écrivains CAS simultanés, échec d’audit et rollback transactionnel, isolement utilisateur, identité absente/révoquée/bannie, écriture directe et TRUNCATE refusés, rôle étranger, tentative d’usurpation via ACL du parent, tables temporaires masquant le search_path, mauvais déclencheur, suppression physique du compte sans perte d’événements, réutilisation de révision et transitions invalides refusées.

## Impact et limites

Impact GitNexus exécuté avant modifications : `updateSocialOAuthAccount` exact, LOW, quatre dépendants ; SQL et nouveau runner non représentés, résultat UNKNOWN. Le graphe était indexé sur `e09fdae`, antérieur à la base. Risque partagé HIGH signalé à T01 avant édition, compensé par revue directe callback/CAS/révocation/DELETE et tests PostgreSQL bornés. Aucun réindex concurrent lancé.

`detect-changes --scope all` : exit 0, 19 fichiers, 46 symboles, quatre processus, MEDIUM, sortie `social-history-gitnexus-detect.log`. Ce résultat couvre aussi le WIP étranger présent dans le worktree et ne certifie pas l’exhaustivité du nouveau SQL. T01 conserve la gate intégrée, le réindex approprié et le commit final.

HISTORY-01 est prouvé ici par le vrai PostgreSQL. Le test T06 utilisant un faux stockage sans déclencheurs ne prouve pas une migration ; il appartient à T06/T01 de relier sa gate à cette preuve, sans supprimer les assertions de conservation. Aucun résultat de production, d’OVH ou de fournisseur n’est revendiqué. La restauration de copie et l’application éventuelle restent à T01 sous ses autorisations et ses contrôles de dérive.

Cette migration ne recrée pas de faits définitivement effacés avant son application, n’effectue aucun consentement et n’ajoute aucune architecture d’historique client. Aucun fichier T06, UI, secret, verrou, BATON ou CI modifié. WIP d’autres propriétaires préservé.

## Empreintes des sources figées

| Source | SHA-256 |
|---|---|
| migrations/20261015_social_authorization_history.sql | `f78dd649afccc975236a6a0bc54b03dce1126d0023024a0ec7da3ff301896376` |
| scripts/test-final-social-history.mjs | `0af3cf59013031caab092689472cff9af1a1a2bebd5f6f76f00536afd0ea3995` |
| social-history-metadata.sql | `dea3bdf959413529ae449a24c50ec4b8475f1583b9ce4e32911011d40cb66dcc` |
| social-history-rollback.sql | `985bd492d6beee3042af7d07d9f1f4f447bc043d9095f7fbc11315bcf60e4db3` |

Documentation officielle vérifiée : [transaction des déclencheurs PostgreSQL](https://www.postgresql.org/docs/current/trigger-definition.html), [SECURITY DEFINER et search_path](https://www.postgresql.org/docs/current/sql-createfunction.html), [RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

Action manuelle utilisateur requise pour ce lot local : aucune. Application distante non exécutée par cette délégation.

## Extension T01 : transition préparée, uniquement simulée ici

Réservation explicite `SUTRA-T01:SOCIAL-TRANSITION` dans les LOCKS ; aucune propriété T06 transférée. Deux fichiers additionnels réservés au préfixe social-history : `social-history-transition.py` et `social-history-transition-test.py`.

Le module importe sans commande ni lecture de secret et exporte `MIGRATION`, `STATE_SQL`, `digest(value)` et `state(database)` pour les gates de promotion. `STATE_SQL` est la copie exacte attestée de `social-history-metadata.sql`. Il reprend `checkpoint-transition.transition` et `RemotePort`, leurs préconditions sauvegarde/runtime/jobs actifs, leur unique soumission et leur comportement UNKNOWN sans relance sur timeout/transport incertain. Le port adapte seulement la lecture d’état, le dossier de preuve et le SQL gardé. Un verrou transactionnel sur les comptes partagés précède la comparaison d’état ; les objets existants du journal et ses fonctions sont également verrouillés. Aucun autre fichier du moteur n’a été modifié par cette délégation.

`verify-copy` vérifie les artefacts protégés, l’identité du schéma restauré et de la production, applique et rejoue la migration sur la copie, suspend la capture par rollback, réapplique, puis rejoue le rollback. Les données des comptes et les faits existants sont comparés par agrégats calculés dans PostgreSQL. Le rollback attendu diffère volontairement du schéma initial absent : journal et protections conservés, capture retirée. Une erreur ou un résultat incertain arrête le scénario sans compensation automatique. Le scénario réel reste à exécuter par T01 ; la simulation n’est pas une preuve de restauration distante.

Receipt `social-history-restore.json` : `status`, `migrationSha256`, `beforeStateSha256`, `afterStateSha256`, `rollbackStateSha256`, `dataUnchanged`, `replaySafe`, `rollbackPreservesHistory`, `productionChanged`, `protectedRollback`, `rollbackSha256`. Le receipt d’application contient `mode`, `source`, `migrationSha256`, `stateVerified`, `stateSha256`, `observedAt`. La cible additive est transmise au moteur via `rollbackDefinitionsSha256` ; une capture désactivée après rollback ne peut être présentée comme retour au schéma initial absent.

Apply/rollback exigent les octets exacts du commit pour module, moteur, migration, metadata et rollback, ainsi qu’une preuve de restauration concordante. Apply exige en plus CI du même SHA terminée verte, trois jobs verts, candidat sans réseau du même SHA et sauvegarde âgée de moins de quatre heures. Les receipts et sauvegardes de tentative sont créés exclusivement ; une tentative antérieure doit être inspectée avant toute nouvelle action. Aucune exception brute distante, valeur de configuration ou ligne de compte n’est imprimée.

Commandes de validation locales exécutées :

```sh
python3 qa/t01-final-20261015/social-history-transition-test.py
node .gitnexus/run.cjs detect-changes --scope all --repo .
```

**12 tests de simulation PASS / 0 FAIL** : import inerte, SQL et garde de périmètre, rollback conservant exactement les protections, scénario copie apply/replay/rollback/reapply, refus de données modifiées, timeout sans compensation, receipt de cible appliquée ou additive, preflight refusé, transport/drift UNKNOWN, binding commit/CI/candidat/sauvegarde/preuve et receipt existant. Les commandes SSH et Docker du module n’ont pas été exécutées. Analyse syntaxique AST Python et absence d’espaces finaux : PASS. Le propriétaire des gates a communiqué **47 tests promotion + 8 wrapper PASS** avec l’interface réelle ; ces tests relèvent de son propre handoff.

À exécuter par T01 seulement après ses préconditions : `python3 qa/t01-final-20261015/social-history-transition.py verify-copy`. Ne pas appeler cette commande pour remplacer une inspection après résultat UNKNOWN.

Empreintes figées :

- `social-history-transition.py` : `8223050a368001fb92887cab8e2171a3e4b3fb88d580693a9af047ffb6fc38a6`.
- `social-history-transition-test.py` : `9faa3fe58eed3723c37eda8d841b26d91167e0b4949a69c98db37b1265aaf582`.

Impact GitNexus des nouveaux symboles/helper préalable : UNKNOWN car non indexés. Le risque opérationnel HIGH du verrou/DDL sur la table partagée a été signalé à T01 avant édition. Le rapport `social-history-gitnexus-detect.log` a été rafraîchi après le helper ; ses résultats globaux ne certifient toujours pas les nouveaux symboles non indexés ni la production.
