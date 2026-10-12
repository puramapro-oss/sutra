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
