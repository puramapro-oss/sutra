# SUTRA T03 — reprise finale sur intégration 589732c

Code : **`8103fff5f86fb3cfc60e2ed921f24b41897f0ded`**. Branche : **`codex/sutra-t03-pipeline-resume-20261012`**.
Base exacte : `589732cb49959c1a576a3ba381b310cd594600ac`. La livraison documentaire est le commit contenant ce handoff ; son SHA final et la confirmation de push sont remis au coordinateur dans `.coord/handoffs/SUTRA-20261012/T03-REPRISE-589732c.md` à la racine PURAMA.
Worktree : `/Users/matissdornier/purama-worktrees/sutra-t03-pipeline-resume-20261012`.
État : **LOCAL_DELTA_VERIFIED**, intégration des reprises des autres terminaux à réaliser par T01, **RELEASE_NOT_CERTIFIED**.

## Reprise et delta exact

LOCKS, worktrees, branches et T01 distant vérifiés avant écriture. `POLICY_OK`.
PR1 `a322e53`, PR2 `e1bdd1b`, PR3 `7088a0a` et correctif `05d164d` sont déjà dans l'ascendance de T01, ainsi que le premier lot T03 `289eaa4`/`fc308f1`. Aucun de ces lots n'a été dupliqué. Ancien T03, T01 et WIP étrangers préservés ; seules les preuves nécessaires du nouveau delta ont été reprises.

Les neuf checkpoints, la file durable PR1, les protections PR2, les reçus DB et la reprise sans seconde génération payante étaient déjà intégrés. Le nouveau delta corrige des refus incomplets démontrés par tests rouges avant correctif :

- Une comparaison SQL avec `NULL` laissait passer un bail absent ou un propriétaire absent dans trois RPC. `finish_video_job`, `persist_video_job_video` et `record_video_job_event` rejettent désormais explicitement ces états, avant toute mutation ou règlement de quota. Heartbeat et checkpoint étaient déjà fermés et restent couverts.
- La présence d'une clé de checkpoint ne prouve pas sa fin. `ready`/`pending_approval` exigent huit étapes terminées ou explicitement non applicables ; scènes, composition et export doivent être `complete`, avec une liste de scènes non vide. Une piste obligatoire doit être `complete`, contenir une chaîne non blanche autre que `null`, et le média final doit prouver l'audio par le booléen JSON `true`.
- La preuve finale exige des booléens littéraux, des dimensions positives entières, des durées positives et une fréquence valide. Les champs numériques JSON encodés comme chaînes et les URL blanches sont refusés. Le garde TypeScript refuse aussi NaN/Infinity, dimensions fractionnaires et durée mesurée nulle. Les contrôles URL brute, hash, dimensions et durée concordantes restent actifs.
- Les pistes facultatives peuvent rester `skipped` et la publication `pending` jusqu'au processus de publication T06. Aucune seconde publication ni nouvelle architecture de file n'est introduite.

## Fichiers du commit de code

| Fichier | Modification |
| --- | --- |
| `src/lib/pipeline-state.ts` | Garde de preuve finale strict |
| `migrations/v11_pipeline_checkpoints.sql` | Bail/propriétaire non NULL et garde DB `ready` |
| `scripts/test-pipeline-interruptions.mts` | Durées, dimensions et booléens invalides ; reprise/idempotence conservées |
| `scripts/test-pipeline-postgres.mts` | Trois nouveaux tests SQL, valeurs invalides et invariance des écritures/quota |
| `qa/t03-resume/run-postgres.mjs` | Cluster privé local avec arrêt en finally et données conservées |
| `qa/t03-resume/run-gate.mjs` | Build/navigateur/legacy hors réseau avec véritables polices en cache |
| `vercel.json` | Désactivation du déploiement automatique de cette seule branche |

Documentation/proofs : ce handoff, `BATON.md`, `task_plan.md`, `LOCKS-T03.md`, `qa/t03-resume/README.md`, `qa/t03-resume/verification.json` et `qa/t03-resume/evidence/*`. Liste exhaustive et empreintes dans le manifest. Aucune modification des adaptateurs T04, du média T05, de la publication T06, de l'UI T07, de la sécurité T02 ou de la CI/dépendances T01.

## Tests gratuits et preuves

Commandes et environnement : [qa/t03-resume/README.md](qa/t03-resume/README.md).
Sources liées au commit et empreintes des preuves : [verification.json](qa/t03-resume/verification.json).

| Gate locale | Résultat |
| --- | --- |
| Contrats Node, concurrence, reçus perdus, neuf reprises indépendantes | **428 PASS / 7 SKIP / 0 FAIL** ; 17 interruptions incluses |
| Schedule / composition / publication | **PASS** pour les trois scripts complémentaires |
| PostgreSQL v10 / pipeline v11 / permissions RLS | **13 + 12 + 49 PASS** ; bases locales distinctes, migrations rejouées |
| FFmpeg synthétique réel, moteur et composition | **33 PASS** avec FFmpeg 6.0 complet |
| Navigateur Chromium réel, serveur Next local et Supabase factice | **203 PASS**, 155 audits axe, 0 violation, 0 exception navigateur |
| Legacy desktop/tablette/mobile complet | **1 022 PASS / 25 SKIP / 0 FAIL**, 0 flaky |
| Typecheck / lint global / build final | **PASS / 0 erreur (111 avertissements) / 197 pages PASS** |
| Tests Python du déploiement, mocks uniquement | **9 PASS**, aucun déploiement |
| Audit npm production | **0 critique / 0 haute**, 5 modérées et 2 faibles héritées |
| Diff et GitNexus avant commit | Diff sans erreur ; 7 fichiers, 28 symboles, listes de graphe abrégées |

Les fournisseurs sont simulés, jamais appelés. Les tests SQL vérifient notamment 12 soumissions concurrentes, 24 checkpoints parallèles, l'ancien worker et les baux NULL, les effets dédupliqués, le règlement unique et les refus `ready` sans piste/scène/preuve. Les tests d'interruption vérifient la perte de reçu avant/après écriture et 30 appels concurrents partageant une opération. Un résultat fournisseur ambigu reste en réconciliation, jamais une autorisation de resoumission payante.

Le navigateur et le legacy portent sur les parcours UI/API factices inchangés. Le tout dernier resserrement durée TypeScript/type numérique SQL a été revalidé par les contrats, PostgreSQL, RLS, typecheck, lint et build ; les suites UI déjà vertes n'ont pas été rejouées pour ce delta sans changement de leur parcours. Aucun résultat navigateur n'est une preuve fournisseur ni une validation visuelle manuelle.

GitNexus : impact préalable **CRITICAL**, cinq appelants directs et cinq processus ; avertissement avant édition. Fonctions SQL non résolues : **UNKNOWN**, revue directe et tests PostgreSQL. Index final : 12 859 nœuds, 25 072 relations, 369 flux, mais 931 entrées/519 callees omis et quatre parcours limités. Le résultat `LOW/0 processus` de detect-changes ne remplace pas cet impact ni une revue exhaustive. Analyse exécutée aussi avant le commit documentaire.

## Blocages réels et intégration T01

1. **Migration locale seulement.** Appliquer ou réappliquer le contenu corrigé de `v11_pipeline_checkpoints.sql` après v10 sur le schéma cible uniquement sous autorisation distincte. Conserver l'ordre intégré : v10, v11, `20261012_social_publication_journals.sql`, puis `20261012_t02_account_permissions.sql` pour les permissions finales. Ne pas lancer une ancienne v11 par-dessus les derniers droits T02 sans les réappliquer. Aucun accès ni changement de DB distante ici.
2. **CI de la base T01 en échec avant les tests** : [run 38289517548](https://github.com/puramapro-oss/sutra/actions/runs/38289517548), credential `SMARANA_READ_TOKEN` absent. Aucun secret lu ni modifié. Les filtres push actuels ne lancent pas la CI sur cette nouvelle branche T03 ; aucune CI distante verte n'est revendiquée.
3. **Environnement de build vierge hors réseau** : Google Fonts est refusé par le garde QA. Le build passe avec les octets WOFF2 authentiques déjà en cache T01, dont les hashes sont archivés. Ce harnais local ne corrige pas la CI T01 : prévoir des polices/cache offline dans son périmètre. Le FFmpeg système sans libass/drawtext produit six échecs ; le binaire complet local donne 33 PASS. Les échecs initiaux sont conservés, les reprises réussies identifiées.
4. **Intégration des reprises propriétaires encore distincte.** Comparer les deltas T02/T04/T05/T06/T07/T08 depuis la même base ; ne pas écraser leurs reprises par les fichiers de ce worktree. Conserver les gardes de branches de `vercel.json`. T08 a signalé à T07 une double soumission UI export ; cela ne prouve pas une double dépense et n'autorise pas T03 à modifier le hook UI.
5. Docker/Linux/OVH, média privé publié, schéma distant complet, providers réels et preuves appareil/Store restent non testés. Les 7 SKIP contrats et 25 SKIP legacy ne sont pas des PASS. Audit npm résiduel transmis à T01/T02. Aucun blocage de tests locaux T03 restant ; aucune certification de release déduite.

Commit et push limités à la branche T03 autorisée. Aucun déploiement, appel payant, publication réelle, secret ou nettoyage ; artefacts et worktrees conservés. Confirmation SHA local/distant dans le pointeur coordinateur après push.

---

## Archive — premier lot T03, déjà intégré dans 589732c

Le texte ci-dessous conserve le contexte historique. Ses mentions de non-intégration, lint rouge et absence de push ne décrivent pas la reprise actuelle.

# SUTRA — T03 pipeline vidéo — 2026-10-12

**Implémentation locale : `289eaa41c8a57fde60d0709e98550ee3d81208ef`.**
Branche : `codex/sutra-t03-pipeline-20261012`.
Worktree : `/Users/matissdornier/purama-worktrees/sutra-t03-pipeline-20261012`.
État : `LOCAL_DELTA_VERIFIED`, `INTEGRATION_NOT_TESTED`, `GLOBAL_LINT_BLOCKED_BASELINE`, `RELEASE_NOT_CERTIFIED`.

## Base et propriété

Inspection préalable des instructions, politique (`POLICY_OK`), LOCKS, branches, worktrees, PR1, PR2, PR3 et correctif HTTP/média. Le worktree est isolé sur PR3 ; aucun cherry-pick aveugle, push, déploiement ou changement des worktrees étrangers.

| Source inspectée | SHA |
| --- | --- |
| PR1, file durable et quota | `a322e53d046b02005b3e05b91f42083a5ca20b1e` |
| PR2, protections | `e1bdd1b5489721aef7b7b8a42e946e2dee1202e8` |
| Correctif demandé | `05d164daafff3502ab764d852742f5e1bf17a8ca` |
| PR3, base du lot | `7088a0a3e733de8d2e85f3576bd86627127da369` |

Les trois premières références sont ancêtres de la base PR3. La branche canonique observée, `renfort/r4-sutra-smart-split-double-effects` à `8ff4fd26bb85178eb239496ae171bbd8ea9a1afb`, et son WIP sont préservés. Les autres terminaux, dont T05 média/export, restent propriétaires de leurs changements.

Propriété T03 : files, pipelines create/production/auto/export, worker commun, états, raccordement des routes à cette file, migration et tests associés. Voir [LOCKS-T03.md](LOCKS-T03.md). Aucun changement UI, prix, split ou adaptateur fournisseur. Les tests OAuth existants ont été déplacés dans leur fichier dédié pour conserver leur couverture sans dépasser la limite de taille du fichier de régressions.

## Comportement livré

- `submit_video_job` sérialise une intention par verrou transactionnel. Quota, ligne vidéo initiale et tâche sont créés ensemble. Douze soumissions concurrentes identiques produisent une tâche, une vidéo et une réservation. Une réponse perdue ne crée pas d'orphelin au rejeu.
- Les quatre routes et le cron utilisent le même `runVideoJob`. Chaque worker porte un identifiant UUID. Toute écriture de checkpoint, heartbeat, résultat, vidéo ou événement vérifie le propriétaire et le bail vivant dans la transaction DB ; le code exige un reçu explicite.
- Les checkpoints parallèles fusionnent chaque clé `steps`/`scenes` atomiquement. Le résultat est enregistré avant la finalisation. La réservation est soldée exactement une fois avec la tâche et dans son mois d'origine, y compris lors d'une annulation.
- Une intention payante est persistée **avant** l'appel. Un résultat acquis n'est pas régénéré. Un ID LTX/Shotstack confirmé permet de reprendre le polling ; une soumission ou un résultat ambigu sans reçu exploitable exige `reconciliation_required`. Les protections HTTP de `05d164d` restent présentes : pas de nouvelle soumission POST sur simple erreur réseau/500.
- Les scènes manquantes, une voix/musique obligatoire absente, une URL brute ou un export sans mesure vérifiable empêchent `ready` et `pending_approval`. La preuve finale lie URL, SHA-256, durée, dimensions, fréquence et présence audio. Le stockage final reste protégé contre un worker périmé.
- Les notifications, activités et effets AUTO (mémoire et compteur de thème) ont des reçus dédupliqués. Une reprise ne remet pas une vidéo publiée/programmée en `ready`.

| Checkpoint indépendant | Résultat conservé |
| --- | --- |
| `stage:script` | Script/plan généré ; intention LLM avant soumission |
| `stage:scenes` | Clips ; résultats et IDs distants aussi conservés par scène |
| `stage:images` | Images des clips ; `skipped` si non applicable |
| `stage:voice` | URL vocale ; buffer ou morceaux/hash conservés avant upload |
| `stage:music` | URL musicale ; intention avant soumission |
| `stage:subtitles` | Segments déterministes |
| `stage:composition` | Résultat de composition ; ID distant réutilisable |
| `stage:export` | Média final et preuve mesurée |
| `stage:publication` | Résultat de l'autopilote CREATE, ou `pending` pour publication séparée |

Une étape de production demandée isolément ne prétend pas avoir exécuté les autres. La publication AUTO/EXPORT/PRODUCTION demeure une opération séparée, sous le CAS durable existant. Son checkpoint `pending` ne constitue pas une publication réussie. Les évolutions de publication T06 ne sont pas intégrées ici.

Transitions de tâche : `queued → processing → done`, ou retour `queued` avec acquis conservés. Ambiguïté payante ou tentatives épuisées : `reconciliation_required`, réservation conservée. Annulation : `cancelled`, réservation libérée une fois. Un bail expiré ne peut être ressuscité par l'ancien worker.

## Contrat d'idempotence pour T01 et les consommateurs

La même intention renvoie la tâche d'origine, même si la réponse initiale a été perdue. Sans clé explicite, une empreinte déterministe du contenu sert de clé : répéter exactement la même demande ne lance plus une nouvelle génération. Pour une **nouvelle génération volontaire**, fournir un nouvel `Idempotency-Key` ; PRODUCTION, EXPORT et AUTO acceptent aussi `requestId`. Réutiliser une clé avec un contenu différent renvoie 409. Les tâches terminées renvoient leur résultat, celles actives 202, celles annulées/à réconcilier 409.

AUTO cron lie la clé à l'utilisateur, l'horaire et l'occurrence ISO. Le payload initial, ses identifiants vidéo et son contexte fournisseur restent ceux de la première soumission. Les plafonds proviennent toujours de `PLAN_LIMITS`, sans nouveau tarif ni règle métier.

## Preuves locales liées au commit

Voir [manifest.json](docs/evidence/t03-20261012/manifest.json) : SHA du commit d'implémentation et empreintes de ses fichiers lues via `git show`, scripts compris. Les sorties des commandes, avec espaces de fin de ligne normalisés, figurent dans [docs/evidence/t03-20261012](docs/evidence/t03-20261012/). Aucun artefact de preuve ne dépend d'un fichier source non committé.

| Vérification | Résultat |
| --- | --- |
| Interruptions, soumission, production, auto/export, régressions et OAuth | **77/77 PASS**, fournisseurs simulés |
| PostgreSQL réel local, socket `/tmp`, base jetable dédiée conservée | **9/9 PASS** |
| Contrats vidéo/API/environnement/moteur/Shotstack/LTX/publication/auth | **165/165 PASS**, aucun appel payant |
| Contrats vidéo/API rejoués après raccordement atomique des routes | **6/6 + 22/22 PASS**, déjà inclus dans les 165 |
| Total de tests distincts | **251/251 PASS** |
| `npx tsc --noEmit` | **PASS**, sortie 0 |
| `npm run build`, Next 16.3.8, configuration factice isolée | **PASS**, sortie 0 |
| ESLint sur fichiers TypeScript T03 | **PASS**, 0 erreur, 3 avertissements |
| `git diff --cached --check` | **PASS** |
| `npm run lint` global | **FAIL hérité : 7 erreurs, 131 avertissements** |

Les tests d'interruption couvrent les neuf étapes, les reçus perdus avant/après persistance, trente appels concurrents sur une même étape et la reprise par ID distant. PostgreSQL couvre douze claims concurrents, vingt-quatre checkpoints parallèles, le rejet d'un ancien propriétaire, les garde-fous `ready`, huit rejeux des effets AUTO, dix notifications concurrentes, le règlement unique du quota et la soumission atomique. Ce schéma local minimal prouve les transactions testées ; il ne certifie pas la compatibilité du schéma distant complet.

Les sept erreurs de lint proviennent de six fichiers **identiques à PR3**, vérifiés par diff : `scripts/test-auto-composition.mjs`, `scripts/test-auto-publication.mjs`, `scripts/test-auto-schedule.mjs`, `scripts/test-ui-isolated.mjs` (console), `src/lib/ltx.ts` et `src/lib/sutra-auto.ts` (taille). Aucun PASS global n'est annoncé. L'unique changement après les checks de code est la suppression d'une ligne vide finale d'un test déplacé ; aucun changement sémantique.

Commandes et conditions reproductibles : [validation.md](docs/evidence/t03-20261012/validation.md).

## Impact et limites

Analyses préalables : `executeProductionStep`, `checkpoint`, `triggerAutopilot`, voix/assemblage à risque HIGH ; `finishJob` CRITICAL (5 appelants directs, 5 processus sur l'index initial). Avertissements communiqués avant édition. SQL et certains handlers n'ont pas de cible exploitable : revue directe, résultat `UNKNOWN`, jamais « aucun impact ».

Index final : 11 307 nœuds, 21 018 relations, 304 flux. `detect-changes --scope staged` avant commit : **25 fichiers, 193 symboles, 22 processus, CRITICAL**. Graphe **tronqué** : 790 entrées sur 990 omises, 460 callees omis, un parcours limité. L'affichage CLI abrège aussi les listes. Les chemins du diff ont été revus directement ; aucune exhaustivité du graphe n'est certifiée.

Pas de DB distante, de publication réelle, de génération payante, de smoke fournisseur authentifié, de preuve navigateur/device, de push ou de déploiement. Les dépendances et artefacts nécessaires sont conservés. Aucun secret ni fichier `.env*` n'a été ouvert ou modifié.

## Reprise par l'intégrateur

1. Intégrer les commits T03 après comparaison des deltas T01/T02/T04/T05/T06, particulièrement les contrats média vérifié, les états de publication et le nom/ordre de migration. Ne pas remplacer leurs changements par ce worktree.
2. **Migration `v11_pipeline_checkpoints.sql` requise après v10, avant exécution de ce code.** Elle n'a été appliquée qu'à une base PostgreSQL locale de test. Faire la qualification sur un schéma complet sous l'ownership de l'intégrateur, sans appel payant. La migration absente bloque les nouvelles générations avant fournisseur.
3. Réconcilier les anciennes tâches : une clé ancienne sans `request_hash` est refusée au lieu de créer une nouvelle génération ; un ancien export sans `requiredTracks` exige une réconciliation. Ne pas effacer un marqueur de soumission payante pour forcer un rejeu. Conserver les IDs distants, reçus et réservations jusqu'à résolution prouvée.
4. Brancher les nouvelles intentions explicites côté client et présenter les états 202/409/réconciliation. Résoudre le lint hérité avec ses propriétaires avant de déclarer une gate globale verte.

Ne rejouer que les preuves touchées par le delta d'intégration. Aucune autorisation de release n'est déduite de ce handoff.
