# Déploiement OVH SUTRA — préparé, jamais exécuté par la CI

Depuis ce worktree, remplacer `<SHA40>` par le commit final poussé :

```sh
python3 deploy/ovh.py deploy --source-ref <SHA40> --schema-ready
python3 deploy/ovh.py rollback --source-ref <SHA40>
```

Ne lancer la première commande qu'après revue et vérification du schéma distant. La migration est séparée, manuelle et non effectuée dans cette livraison. Ordre testé sur PostgreSQL local jetable : `v10_durable_jobs_quota.sql`, `v11_pipeline_checkpoints.sql`, `20261012_social_publication_journals.sql`, `20261012_t02_account_permissions.sql`. Les fonctions/RLS existantes de production doivent être inventoriées avant application ; le jeu local ne prouve pas la compatibilité de données distantes inconnues.

Le wrapper exige un SHA complet, un commit disponible et le hash attendu du helper OVH canonique. Il archive Compose et la configuration runtime par copies opaques privées dans `/opt/purama/apps/sutra/rollback-<SHA40>/`. Le snapshot refuse l'écrasement, son marqueur n'est écrit qu'après les deux copies. Le helper prend les sources par `git archive` du SHA ; ESLint vient de ce même commit, SMARANA du commit verrouillé. Il prépare l'image Node 24/webpack, FFmpeg avec drawtext/subtitles, puis le service `purama-sutra` sur `root@144.217.14.210`.

Rollback : restauration du Compose et du runtime précédents, `docker compose up -d --no-deps sutra`, attente explicite de l'état healthy. Les anciennes images doivent rester disponibles. Aucune annulation SQL automatique : les migrations restent en place. Un échec de santé est bloquant, jamais un succès silencieux. La commande est locale à cette machine : helper épinglé sous `purama/.coord/handoffs/OVH-MIGRATION-20261005/deploy_next.py` et son inventaire nécessaires.

Preuve bornée : tests Python sans SSH, Docker ni credentials. Docker absent localement ; image Linux et rollback OVH réel **non exécutés**. Aucun contact avec OVH ni fichier de secrets lu pendant l'intégration.
