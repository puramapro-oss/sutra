# SUTRA — preuves de déploiement du 2026-10-13

Commit applicatif déployé : `3e5596ea287f36427f687d3f3882d35c3f7c407b`. CI : https://github.com/puramapro-oss/sutra/actions/runs/38322846966 . État final : `deployment-release.json`, `test-matrix-release.json`, `dns-tls-release.json` et `public-browser-release.json`.

Les suffixes `release` désignent la dernière preuve. Les fichiers antérieurs conservent les étapes et échecs historiques, sans remplacer le résultat final. `ci-run.json` documente la reprise de 9b0c2c9, corrigée ensuite dans 3591818. Le premier déploiement 3591818 a été annulé automatiquement après un 403 Supabase (`db-smoke-rollback.json`). Les correctifs aaa94f2/3e5596e et la CI finale résolvent ce défaut.

`release-first-attempt.py.txt` est l’archive de l’essai qui a appliqué les deux dernières migrations avec 120 assertions atomiques, puis rencontré une erreur de syntaxe avant la promotion. `release-failure-rollback.json` confirme le rollback. `release-procedure.py.txt` est la reprise corrigée exécutée avec succès : elle ne réapplique pas ces migrations, vérifie le snapshot intact, compile le Python distant et promeut l’image immuable. Ces archives sont des preuves, pas des commandes à relancer aveuglément.

`backup-release.json` prouve une restauration de 140 tables et huit migrations appliquées deux fois. Son champ `productionDdl:false` et sa limitation « Production was not migrated » décrivent uniquement l’action du script de sauvegarde, antérieure aux migrations. L’état effectif est donné par `production-migration.json` (six premières), `permissions-production-release.json` (deux dernières) et `storage-cutover.json` (bucket privé).

`permissions-live-check.sql` vérifie 120 prédicats, dont les privilèges serveur requis et les refus clients. `supabase-readonly-smoke.mjs` envoie 35 GET avec limit=0. Aucun secret, ligne de base, dump ou valeur d’environnement n’est publié. Les artefacts sensibles restent sur OVH avec permissions restreintes.

Les captures publiques desktop/mobile ont été affichées et inspectées après l’animation d’entrée. Seul le parcours accueil → formulaire de connexion est prouvé : toutes les requêtes mutantes sont bloquées, y compris l’enregistrement serveur du choix cookies ; pas de connexion, génération ou publication réelle. Aucun appel fournisseur payant, aucune sonde `/api/health`.

Les décomptes contrats/médias et lint/build proviennent des logs locaux sur le même périmètre inchangé (`local-count-excerpts.json`). La CI finale prouve chaque commande PASS ; E2E, navigateurs et PostgreSQL ont leurs décomptes dans les artefacts CI. Les SKIP restent des SKIP. La matrice ne doit pas être additionnée : plusieurs suites couvrent les mêmes contrats.

`preservation-release.json` compare les 53 worktrees étrangers à l’état de départ, conserve leurs HEAD/status et empreintes des fichiers suivis modifiés, ainsi que les cinq ancêtres protégés. Aucun reset/stash/clean ni arrêt de processus étranger. Les fichiers générés GitNexus non suivis restent localement conservés.
