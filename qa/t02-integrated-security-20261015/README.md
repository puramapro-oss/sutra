# T02 — verdict sécurité après intégration, 15 octobre 2026

**PASS sur le périmètre testé du candidat intégré.** Aucun FAIL restant reproduit. Ce verdict local ne certifie ni la production ni des comptes fournisseurs réels.

- Correctif T02 transmis : `8c416290ebdabe9b0e8a1fa9708f537c8c0a45f5`, réception T01 et import `72f406b940b7e3cdfb27873751a4059375646f25` vérifiés.
- Candidat applicatif T01 : `c7a7ebd876d36c521b1c30f6d487b7bb07f000a8`.
- HEAD exact retesté : `d5d49a458e9e630ffbc1a433a7693a8cecd7dad5`, descendant documentaire ; aucun delta src/SQL/dépendances par rapport à c7. `integration.json` atteste cette égalité.
- Branche isolée : `codex/sutra-t02-integrated-security-20261015`. Aucune modification produit, migration, fichier OAuth T6, médias T5 ou configuration T1. Nouveau lot limité aux preuves/runner et append propres d'état.

## Correctifs réellement intégrés

| Défaut | Preuve intégrée | Verdict |
|---|---|---|
| T02-RPC-02 : diagnostic claim RPC/profil/worker exposé en HTTP et last_error | Route identique au commit T02 ; allowlist exacte avant réponse et persistance ; 19/19 tests réels de route | PASS |
| T06-INTEGRATED-01 : confirmation CAS avec timestamp JS remplacé par trigger SQL | Helper identique à `3edae7ae1d3c13ed2b385a9602a9ad8da6ca5b6d` ; relecture du timestamp serveur et identité/révision/provenance ; routes+PG9/9, CAS7/7 | PASS |
| T06-INTEGRATED-02 : anciens comptes Zernio sans révision non révocables | Migration canonique T01 SHA256 `d2f6a9cb380a15285759085cdf602701f0d9d785d4a7f76f2061438d38ab9ddc` ; 27/27 contrôles SQL dont legacy/courses/refus de provenance, 9/9 routes avec vrais triggers | PASS |

Les anciens rouges sont conservés dans les dossiers T02/T06 intégrés. Aucun nouvel échec produit n'a justifié une correction supplémentaire. Six anciens correctifs T02 restent identiques aux commits auteurs (`previous-fixes.json`).

## Commandes et preuves fraîches

```sh
python3 qa/t02-integrated-security-20261015/run.py production oauth publication history postgres-cas social-history boundaries typecheck lint
python3 qa/t02-integrated-security-20261015/run.py cron rls write-permissions ssrf
```

Chaque reçu JSON contient la commande complète, le HEAD exact, le code retour et le hash du log. `results.json` récapitule les résultats ; `source-manifest.json` couvre les entrées produit/SQL/scripts. Les écritures de reçus des harnais T1/T6 sont redirigées uniquement vers ce dossier via `evidence-output.cjs` ; assertions, migrations et fixtures originales restent inchangées.

| Groupe | Résultat | Risque couvert |
|---|---|---|
| production | 19 PASS, 0 FAIL, 0 SKIP | Anonyme/session expirée/révoquée401, identité et plan serveur, accès Alice/Bob, codes publics exacts, diagnostic RPC HTTP et erreur durable |
| oauth | 76 PASS, 0 FAIL, 0 SKIP | State aléatoire, expiration/usage unique/session/utilisateur/profil, callbacks et révocation |
| publication | 92 PASS, 0 FAIL, 0 SKIP | Consommateurs de révocation, reconnect/fence, permission sociale ; transport fournisseur simulé uniquement |
| history, PostgreSQL18 | 9 PASS, 0 FAIL, 0 SKIP | Routes réelles + timestamps/triggers canoniques ; state concurrent, utilisateur/session/profil croisés, legacy, rollback et courses |
| postgres-cas | 7 PASS, 0 FAIL, 0 SKIP | Révocation/CAS concurrentes sur base jetable locale |
| social-history | 27 PASS, 0 FAIL, 0 SKIP | ACL/RLS historique, owner-only, refus anon/cross-user/révoqué, provenance, replay et atomicité |
| boundaries | 76 PASS, 0 FAIL, 0 SKIP | Authentification, isolation utilisateur, ownership et fichiers privés/URL signées, permission sociale |
| cron | 21 PASS, 0 FAIL, 0 SKIP | `assertCronAuth` existant ; secret absent et credentials invalides refusés, rotation et succès autorisé |
| rls | 261 assertions PASS | Deux utilisateurs et anon, tables/RPC sensibles, élévations refusées, replay canonique local |
| write-permissions | 30 contrôles PASS | Colonnes sensibles, argent/classement, ACL clients bornées |
| ssrf | 61 PASS, 0 FAIL, 0 SKIP | DNS mixte/privé, redirections metadata, erreurs expurgées, deadlines, OTS et moteur personnel owner-only |
| typecheck | PASS | Route et helpers consommateurs, tests RPC/OAuth/PG |
| lint | 0 erreur, 1 warning préexistant | `_requestId` non utilisé dans production/route.ts:108 ; aucune protection désactivée |

Pas d'addition entre compteurs de tests et assertions. Node **24.22.0** et PostgreSQL **18.4**, environnement synthétique sans HOME/master/.env, blocage réseau externe. Le chemin Node existant a changé depuis les reçus précédents24.21.0 ; cron/RLS/permissions/SSRF ont donc été rejoués une seule fois. Tous clusters privés arrêtés et conservés, aucun serveur partagé touché. Build/CI globaux inchangés non relancés ; preuve T01 c7 CI38750974353 SUCCESS réutilisée comme preuve T01, pas comme exécution T02.

## Dépendances et limites

Lockfile inchangé : inventaire/audit npm T02 déjà livré reste applicable au même graphe. **Audit npm non clean** : 7 alertes production (2low/5moderate), 30 totales (4low/8moderate/17high/1critical), aucun nouveau chemin API exploitable démontré dans l'analyse précédente. Tripwires request/ECDSA/BitcoinRPC réexécutés dans ssrf : aucune utilisation des chemins vulnérables. Risque conditionnel du serveur LHCI optionnel maintenu, pins étroits proxy-addr2.0.8/compression1.8.2 relèvent de T01 avant usage exposé. Aucun nouveau scan registre ni mise à jour massive pour rejouer un résultat inchangé.

- **NON TESTÉ** : deux organisations applicatives natives (dimension absente du modèle examiné). Deux utilisateurs et profils Zernio distincts ne remplacent pas cette preuve.
- **NON TESTÉ** : révocation/rotation fournisseur réelle, consentements personnels, PostgREST/ACL/stockage/SSRF réseau en production. Toutes actions fournisseurs sont simulées. URL signée déjà émise : validité jusqu'au TTL300s, pas de révocation instantanée promise.
- **BLOQUÉ hors T02** : promotion soumise à T01 et recette indépendante T08 ; ce PASS n'autorise aucun déploiement. Aucun blocage technique restant pour le lot T02 testé.
- GitNexus réindexé sans embeddings/IA Mac : graphe de processus tronqué explicitement signalé. Context retrouve les deux appelants directs du helper (DELETE social et test PG), tous exercés. Analyse des changements avant commit jointe ; aucun faux certificat exhaustif tiré du graphe. Diff manuel et manifeste attestent zéro changement produit de ce lot.

Contrôle final : 845 entrées du manifeste identiques dans le worktree T02 et chez T01 ; HEAD T01 toujours d5d49a4. Son WIP AGENTS est préservé, ses nouveaux reçus de clôture et journaux restent sous sa propriété (`preservation-final.json`). GitNexus staged : risque LOW, uniquement QA/docs ; comparaison historique à main : CRITICAL, 4036 fichiers, 10119 symboles, 228 processus, liste plafonnée et graphe incomplet. Cette comparaison historique ne qualifie pas ce lot ni toute l'application. Les deux logs normalisés ont seulement perdu leurs lignes blanches finales ; hashes avant/après conservés.

T01 prépare un futur candidat avec les travaux T07. Le présent PASS ne lui est pas attribué par anticipation : T08 reçoit ce futur SHA après intégration et contrôle les deltas concernés.

Aucun secret lu/affiché, compte connecté, publication, GPU, appel payant, push, fusion ou déploiement.

Contrôle de secrets : 15 détections initiales étaient les SHA256 vérifiés de fichiers contenant auth/api dans leur nom. Provenance recalculée, classification jointe et manifeste reformatté en champs path/sha256 distincts. Aucune règle du scanner ni protection applicative désactivée ; reçus initial et final conservés.
