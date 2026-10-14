# T08 — clôture ciblée, 14 octobre 2026

Base intégrée confirmée T01 : `e09fdaeafbf1ec8554a7b689fe3c44dd696d0140`. Branche `codex/sutra-t08-closure-20261014`. Cette recette porte sur cette base disponible, pas sur le candidat encore en préparation ni sur la production. Verdict détaillé : [MATRIX.md](MATRIX.md), export [matrix.json](matrix.json).

**Non prête aux essais utilisateur complets.** Les quatre anciens FAIL ont été retestés et clos. Les nouveaux défauts de code et l'absence du prochain SHA intégré restent explicites. Aucun test rouge masqué, ignoré ou transformé en vert. Les corrections produit appartiennent à T03/T06/T07 ; T08 ne modifie que ses fixtures et preuves.

## Résultats exécutés

| Commande depuis la racine du worktree | Résultat | Preuve |
| --- | --- | --- |
| `python3 qa/t08-closure-20261014/run.py journey` | 13 PASS / 0 FAIL / 0 SKIP | `journey.json`, `journey.log` |
| `python3 qa/t08-closure-20261014/run.py suno` | 19 PASS | `suno.json` |
| `python3 qa/t08-closure-20261014/run.py oauth` | 9 PASS | `oauth.json` |
| `python3 qa/t08-closure-20261014/run.py oauth-races` | 38 PASS | `oauth-races.json` |
| `python3 qa/t08-closure-20261014/run.py storage-proof` | 18 PASS | `storage-proof.json` |
| `python3 qa/t08-closure-20261014/run.py ots` | 16 PASS | `ots.json` |
| `python3 qa/t08-closure-20261014/run.py production-error` | **3 PASS / 1 FAIL** | `production-error.json`, copie auteur byte-identique |
| `purama-heavy NODE24 qa/t07-frontend-fixes-20261014/browser.mjs` | 25 PASS, dev isolé | `browser.json`, `browser/after/results.json` |
| TypeScript ciblé, ESLint des trois fichiers de tests, compilation syntaxique Python | PASS | commandes exactes `quality-final.json` |

`NODE24` = `/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node`. `purama-heavy` = `/Users/matissdornier/.purama-perf/bin/purama-heavy`. La commande navigateur a été exécutée avec un environnement limité à PATH/HOME/TMPDIR/LANG, `NEXT_TELEMETRY_DISABLED=1`, `NODE_OPTIONS=--require=<worktree>/qa/t08/offline.cjs`, `SUTRA_T07_OUTPUT=<worktree>/qa/t08-closure-20261014/browser`. Le runner propriétaire ajoute uniquement ses fixtures synthétiques. Aucun `.env` ou secret maître chargé.

Total de cette exécution bornée, fichiers de tests distincts : **141 PASS, 1 FAIL, 0 SKIP**, navigateur compris. Les 13 scénarios ont été rejoués après adaptation de leurs données de fixture ; ce second passage n'est pas additionné. Les nombres de la matrice comptent des exigences, pas des assertions : 53 lignes, **37 PASS / 5 FAIL / 2 BLOQUÉ / 9 NON TESTÉ**. Quatre lignes FAIL sont fondées sur les reproductions propriétaires récentes explicitement identifiées ; R49 est aussi reproduit directement par T08.

## Frontières et limites

Les 13 scénarios T08 réutilisés exécutent les vraies routes création/statut/export/publication, queue, worker, pipelines, contrat de composition et journal social. Ils couvrent projet, quota, génération simulée, timeout/reprise, montage, validation, export, planification et publication simulée ; doubles clics par rafales de 12, erreurs partielles, perte d'ACK, panne de persistance, isolation et absence de fallback payant. Session, DB/CAS/RPC, fournisseurs, média et transport social restent des fixtures. Ce n'est pas une connexion OAuth personnelle ni un E2E sur DB réelle.

La bibliothèque passe dans le navigateur local : pagination, erreurs et reprise, filtres, double clic et retours sociaux. Deux captures 375/1440 ont été affichées et inspectées ; les autres preuves visuelles restent des assertions automatiques. Aucun lecteur d'écran ni parcours manuel complet certifié. Le modal légal est un défaut différent du bouton cookies déjà corrigé.

Les 37 MP4 CPU de T05 ont été vérifiés par SHA-256 et taille, les 11 producteurs par empreinte ; les six modules produit et le lockfile correspondent au candidat. Voir `t05-proof-verification.json`. Le lot auteur `2da10b34a1715a6f33b1087f8c53480353727f56` conserve son premier rouge d'attendu puis le retest ciblé ; 49 scénarios distincts, pas une nouvelle exécution T08 des encodeurs. Cette preuve ne valide aucune génération GPU ni publication.

CI `38508390596` et son SHA `86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164` réutilisés : aucun changement src/scripts/dépendances/config Next/CI jusqu'à e09 (`provenance.json`). Aucun build, CI globale, installation, sonde fournisseur ou test distant relancé par T08.

## Adaptation demandée par T06/T01

Le durcissement social refuse l'ancien identifiant synthétique `u`. T08 a réservé puis adapté exclusivement `scripts/test-t08-integration-journey.mts` et `qa/t08-integration-journey-20261014/database.mts` : UUID, binding et provenance de profil cohérents. Le helper T06 et le garde produit restent intacts. Toutes les lignes d'assertion sont inchangées (`fixture-adaptation.json`) ; 13 PASS sur e09. La compatibilité avec le correctif T06 doit être retestée sur le candidat intégré, pas déduite de ce résultat.

Autorisation auteur séparée donnée à T06 pour les seules données de `qa/t08/integrated/load.test.mts`, assertions préservées ; T08 n'édite pas ce fichier en parallèle.

GitNexus : index propre à ce worktree ; impact `journeyDatabase` LOW, un appelant test, aucun flux trouvé. Le graphe est tronqué, FTS désactivé ; ce résultat ne prouve pas l'exhaustivité. `detect-changes` avant commit : staged HIGH (22 symboles/10 flux, membres imbriqués de la fixture), comparaison historique main CRITICAL (2301 fichiers/7073 symboles/231 flux). Alertes annoncées ; revue directe confirme aucun produit modifié, assertions conservées. Détails `precommit-review.json`, contrôle secrets PASS. `POLICY_OK` au démarrage. Aucun nettoyage, secret, push, merge, migration distante, déploiement, calcul IA/GPU Mac ni publication.

La prochaine action est uniquement la réception du SHA T01 après gel T03/T06/T07 et SQL T01, puis [SMOKE-T01.md](SMOKE-T01.md). Pas de nouvel audit général.
