# SUTRA T02 — complément sécurité fournisseurs, 2026-10-13

**LOCAL_DELTA_VERIFIED / FOURNISSEURS BLOQUÉS.** Branche `codex/sutra-t02-provider-security-20261013`, base `48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4`. Trois fuites prouvées dans GET social/accounts (metadata et diagnostics) corrigées ; 12 régressions ajoutées au runner CI existant. Aucun autre produit modifié, aucun fichier réservé T01/T04/T05/T06/T08 écrasé.

Commandes exactes et manifest des sources : `qa/t02-provider-security-20261013/README.md`. `node scripts/run-ci.mjs contracts` : 492 PASS, 0 FAIL, 7 SKIP ; schedule/composition/publication simulée PASS. `node qa/t02-final/run-free-gates.mjs quality` : TypeScript PASS, lint 0 erreur/111 avertissements existants, build webpack PASS (197 pages). Environnement fixtures sans secrets et réseau bloqué. Preuve avant correction : 3 FAIL/9 PASS. Aucune modification pertinente après ces gates ; ne pas les rejouer sans delta.

Sondes T01/T04 depuis le maître réutilisées et figées sans secrets : Mac/OVH RunPod 401, Shotstack 4×403, Suno base 503 sans auth qualifiée ; Zernio GET 200 mais OAuth ancien incompatible. Mapping profil/organisation et minimisation des scopes à raccorder avant consentement. Correction Shotstack détenue par T05 ; aucune intégration dans ce lot. Aucun déploiement/merge/migration/publication/appel payant/modification distante de configuration. Push de code explicitement autorisé ; garde Vercel false ajoutée pour cette branche seulement, hors déclencheurs GitHub Actions.

Prochaine tâche non vérifiée : coordinateur, reprendre les corrections de contrat OAuth/profil et livraison T05 ; utilisateur, rétablir clés RunPod/Shotstack et confirmer fournisseur Suno, puis consentir aux réseaux après qualification. SHA de ce commit et fichiers transmis dans `.coord/handoffs/SUTRA-20261012/T02-PROVIDER-SECURITY-20261013.md` du dépôt coordinateur.

---

Les sections suivantes sont historiques et ne valent pas autorisation de push/déploiement.

# SUTRA T02 — sécurité — reprise finale du 2026-10-12

## Livraison et provenance

- Branche : `codex/sutra-t02-security-final-20261012`.
- Worktree : `/Users/matissdornier/purama-worktrees/sutra-t02-security-final-20261012`.
- Base d’intégration exacte, vérifiée propre : `codex/sutra-t01-integration-20261012` à `589732cb49959c1a576a3ba381b310cd594600ac`.
- Livraison = commit atomique contenant ce handoff ; SHA et confirmation distante déposés après push dans `/Users/matissdornier/purama/.coord/handoffs/SUTRA-20261012/T02-COORDINATION.md`.
- AGENTS, politique, LOCKS, handoffs, branches/worktrees/processus contrôlés avant écriture ; `POLICY_OK`. Nouveau worktree isolé créé depuis cette base, sans copie ni réintégration de WIP.
- Le premier lot T02 `d4626a426ad1f3f29e670fb1a19c65298d2f7809` est déjà intégré. Son handoff reste dans cet ancien commit et ses preuves historiques sous `qa/t02/`. Ils ne sont pas présentés comme de nouveaux résultats.
- Seul fichier produit changé : `src/app/api/points/route.ts` (permission POST). Packages, lockfile, workflows, harnais T01/T08, export T05, interface T07 et publication T06 inchangés. `assertCronAuth`, OAuth persistant, sessions, downloader et révocation existants conservés ; leurs tests figurent dans la suite contrats.
- Push de cette seule branche autorisé par le mandat courant ; garde Vercel `git.deploymentEnabled[branche]=false` ajoutée avant push, sans retirer la garde T01. Aucun déploiement, appel payant, publication sociale, secret ou DB distante.

## Vulnérabilités résiduelles reproduites et corrigées

La nouvelle migration `migrations/20261012_t02_final_permissions.sql` s’applique **après toutes les migrations intégrées et `20261012_t02_account_permissions.sql`**, avec le propriétaire de migration. Transactionnelle, rejouable, sans modification de données, montant, split, corps métier ou payload de publication.

| Preuve PostgreSQL avant correction | Correction | Preuve après correction |
| --- | --- | --- |
| Le `GRANT ALL` canonique de `sutra_auto.sql` permet à un utilisateur révoqué de `TRUNCATE` les souvenirs de tous les utilisateurs ; la RLS refuse pourtant son SELECT | Retrait de TRUNCATE/REFERENCES/TRIGGER aux rôles clients sur les tables existantes de `sutra` | TRUNCATE anon/authenticated refusé, lignes des deux utilisateurs préservées |
| Sous grants clients ordinaires, la RLS propriétaire permet de changer son solde `purama_points` et d’insérer un faux cadeau | Écritures des sept tables de soldes/reçus/récompenses réservées au serveur ; retrait des grants de table et colonne, lecture propriétaire actif seulement | INSERT/UPDATE/DELETE clients refusés, lecture autre utilisateur et compte révoqué refusées, écriture serveur conservée |
| Le schéma réel `public.social_accounts` de `sql/social-autopilot.sql` laisse lire le token et réactiver/modifier l’identité d’un compte via grants clients ; la première migration T02 protégeait seulement `sutra.social_accounts` | Tokens, metadata brute et écritures serveur seulement ; SELECT de colonnes descriptives explicites, politique restrictive propriétaire actif | Tokens/refresh/metadata/SELECT étoile et écritures clients refusés ; métadonnées propres lisibles, autre utilisateur/compte révoqué refusés, service autorisé |

Les sept tables : `purama_points`, `point_transactions`, `point_purchases`, `point_milestones`, `daily_gifts`, `user_achievements`, `lottery_tickets`. Les définitions utilisées par les tests proviennent des migrations canoniques, avec rôles PostgreSQL réels et identités synthétiques. Les grants distants ne sont pas connus : ces reproductions locales ne sont pas la preuve d’une exploitation en production.

Le contrat `public.social_accounts` a été retrouvé via le handoff T06. La migration exige son commentaire canonique et ses colonnes d’autorité ; un schéma inconnu déclenche `SUTRA_SOCIAL_SCHEMA_REVIEW_REQUIRED` et annule toute la transaction. Une table absente est ignorée. Les deux chemins sont testés, y compris le rollback des grants. Vérification humaine du schéma partagé requise avant application distante. Ne pas réappliquer ensuite un ancien script de grants ; les tables créées ultérieurement nécessitent leurs propres permissions.

### Contournement de l’autorité serveur sur les points

Le POST `/api/points` de la base accepte `action`, `amount` et `source` du navigateur après la seule authentification. La reproduction sur le handler réel avec SDK simulé renvoie **200, 15 écritures privilégiées et six appels `creditWallet`** pour 1 000 000 points choisis par le client ; un faux `breathe_session` est également accepté. Cette voie contourne les permissions SQL et les contrôles de profil actif ne suffisent pas.

Le POST renvoie maintenant **403** pour une session active, avant lecture du corps, création du service client ou effet financier. Les sessions absentes/interdites/révoquées restent refusées ; le GET propriétaire est conservé. Aucun taux, montant, split ni nouveau système d’attribution n’est inventé. Les actions serveur dédiées existantes restent intactes. **Conséquence produit explicite : l’ancien crédit de respiration par ce POST est suspendu** tant qu’il n’existe pas de preuve serveur de l’activité. Le seul appelant trouvé, `src/hooks/useBreathingSession.ts:96`, appartient à T07 ; son toast de réussite inconditionnel et son appel `addXp` doivent être réconciliés par ce propriétaire. Ne pas réouvrir le POST sur la seule valeur `source` du navigateur.

Dix tests négatifs/positifs exécutent le handler réel, avec Supabase/portefeuille simulés et réseau interdit ; cinq échouent avant correction, dix passent après. `scripts/test-security-account.mts` charge la nouvelle suite pour qu’elle s’exécute déjà dans le runner de contrats canonique, sans modifier celui de T01.

## Validation gratuite et isolée

Environnement : Node **24.21.0**, PostgreSQL **18.4** local, dépendances exactes T01/base589 en lecture seule, aucune installation ni modification dans son `node_modules`. Les preuves et empreintes sont dans `qa/t02-final/verification.json` et `qa/t02-final/evidence/`.

| Commande / preuve | Résultat |
| --- | --- |
| `node scripts/test-security-rls.mjs` | **147 assertions PASS**, sur Node24 ; reproduction avant/après, double migration, grants de colonne/PUBLIC, RLS restrictive, révocation et rollback. Cluster socket privé arrêté, conservé. Premier passage Node26 également PASS, sans additionner les deux |
| `node scripts/run-ci.mjs contracts` | **437 PASS / 7 SKIP / 0 FAIL**, dont les dix tests points nouveaux ; schedule/composition/publication PASS. SDK/transport fournisseurs simulés |
| `node scripts/run-ci.mjs media`, FFmpeg local T05 en lecture seule | **33 PASS / 0 FAIL** : moteur local3 et composition/décodage30, médias synthétiques |
| `node scripts/test-migration-local.mjs`, puis `node --import tsx --test scripts/test-pipeline-postgres.mts` | **13 validations migration + 9 tests concurrence PASS**, cluster jetable loopback créé par T02, arrêté ensuite ; aucune base préexistante utilisée |
| `node scripts/run-ci.mjs quality` (premier passage) | Typecheck PASS, lint PASS **0 erreur / 111 avertissements** ; build canonique **FAIL** : la garde réseau refuse le téléchargement Google Fonts |
| `node qa/t02-final/run-free-gates.mjs quality` (après correctif points) | **Typecheck, lint 0 erreur / 111 avertissements et build197 PASS**, avec la police locale et la garde réseau inchangée |
| `node qa/t02-final/run-free-gates.mjs build` | Build **197/197 pages PASS** avec police publique mise en cache localement ; aucune modification de layout, config ou runner canonique |
| Lint ciblé du test RLS et du harnais QA T02 | PASS, 0 avertissement |
| Navigateur et legacy avec le même harnais de police locale | **203 contrôles navigateur PASS**, 155 audits axe / 0 violation / 0 erreur navigateur ; **1022 legacy PASS / 25 SKIP / 0 FAIL** |
| `python3 -m unittest discover -s deploy -p 'test_*.py'` | **9 PASS**, mocks de déploiement uniquement |
| actionlint workflows web/mobile ; shellcheck `tooling/git-askpass.sh` | PASS |
| `npm audit --omit=dev --audit-level=high --json` | PASS seuil high : **0 haute/critique, 5 modérées, 2 faibles** ; dépendances non changées |

Le harnais `qa/t02-final/run-free-gates.mjs` dérive une copie temporaire du runner T01, ajoute seulement le fixture Next/font et un profil build ciblé. Il vérifie les SHA-256 de cinq polices publiques ; les fichiers binaires restent dans `test-results/t02-fonts`. Les seules requêtes externes de préparation sont ces téléchargements publics gratuits et l’audit npm. Les tests applicatifs gardent la garde réseau T08, les environnements synthétiques et l’interdiction `.env`. Cette preuve ne clôt pas l’erreur du **runner canonique** : T01 doit intégrer son propre contrat de police hors réseau. Aucun faux PASS de `npm run check` inchangé.

Les suites navigateur/legacy complètes précèdent le dernier correctif POST points ; leurs pages/contrats UI sont inchangés et les API navigateur sont simulées. Elles ne prouvent pas le crédit de respiration, désormais suspendu. Le delta route est requalifié ensuite par la suite contrats437 (GET et POST réels avec SDK simulé) et la qualité complète. Aucun rendu visuel manuel n’est revendiqué.

Sept skips contrats explicites : INSEE authentifié4, DB distante2, OpenTimestamps réseau1. Aucun test live nécessitant configuration réelle ou publication lancé. Diagnostic PostgreSQL initial : démarrage refusé sous locale macOS non définie, corrigé dans le lanceur local par `LC_ALL=C` ; aucun service étranger arrêté.

GitNexus : impacts exécutés avant édition, `expectDenied` LOW/1 appelant/0 processus ; SQL `account_is_active`/table réelle non résolus, **UNKNOWN** et revue SQL directe. POST points UNKNOWN/0 appelant résolu ; recherche directe : un consommateur HTTP T07. Fixture compte LOW/1 appelant/0 processus. Index propre au worktree final rafraîchi, mais des entrées/callees/parcours restent tronqués (chiffres dans `gitnexus-index-final.log`). Analyse des changements stagés avant commit archivée ; aucune certification exhaustive du graphe ou de la RLS déduite de LOW.

## Blocages réels à transmettre au coordinateur

1. **Stockage privé et URLs signées : contrat interpropriétaires encore absent.** `src/lib/storage.ts` retourne `getPublicUrl` de `sutra-assets`. Les consommateurs T03/T05/T06 persistent cette URL avec preuve/hash/reprise. Il faut une référence stable bucket/chemin/propriétaire, contrôle d’accès puis signature renouvelée à la lecture/publication, ainsi qu’une reprise des objets et références existants. Aucun consumer réservé ni bucket modifié. Une URL expirante persistée directement casserait le replay exact ; T06 confirme ce blocage dans son handoff.
2. **Schéma/Auth/Storage distants NON TESTÉS.** Migration uniquement locale ; propriété effective de la table publique et grants distants à vérifier avant application autorisée. Invalidations réelles JWT/refresh/provider, stockage privé et tests interorganisations ne sont pas prouvés. Aucun modèle canonique d’organisation trouvé ; isolation prouvée par utilisateur seulement. Limiteur OAuth existant par processus, limite multi-instance non prouvée.
3. **T01 tooling/CI.** Runner canonique build bloqué par Google Fonts hors réseau ; adaptation locale documentée, fichier réservé intact. CI distante de l’intégration589 bloquée avant suites par `SMARANA_READ_TOKEN` absent selon sa clôture ; cette reprise ne fournit pas de preuve GitHub CI. Résiduel audit 5 modérées/2 faibles transmis, aucun downgrade improvisé.
4. **T06 publication/logs.** Révocation locale de T06 intégrée à589 ; sa nouvelle vérification après claim est livrée séparément sur `codex/sutra-t06-social-final-20261012` à `b2ec2eca250948fdb1012ada36829c0296ccab4e` (coordination relue), à intégrer par T01. Aucun WIP T06 repris, aucun test provider réel. L’ancienne demande de supprimer les messages d’erreurs fournisseur bruts doit être soldée par son propriétaire.

5. **T07 récompense respiration.** Adapter l’appel et le toast du hook cité ci-dessus ; attribution suspendue faute de preuve serveur d’activité. Aucun mécanisme financier parallèle ajouté.

## Fichiers du delta

- Produit : `src/app/api/points/route.ts`, `migrations/20261012_t02_final_permissions.sql`.
- Tests : `scripts/test-security-rls.mjs`, `scripts/test-security-points.mts`, import dans `scripts/test-security-account.mts`.
- Garde push : `vercel.json` (ajout de la seule branche T02 à `deploymentEnabled=false`, conserver les gardes des autres terminaux à l’intégration).
- Livraison : ce handoff, ajouts T02 à `BATON.md` et `task_plan.md`, harnais/polices textuelles/manifest/preuves sous `qa/t02-final/`.

Statut : **delta permissions localement vérifié**, commit/push de livraison uniquement ; stockage privé et preuve d’exploitation restent bloqués. Les étapes restantes sont précisément celles ci-dessus, aucune certification de release ou de déploiement.
