# SUTRA T01 — production OVH, 2026-10-13

**DEPLOYE / CI ET SMOKES GRATUITS PASS.** Commit applicatif `3e5596ea287f36427f687d3f3882d35c3f7c407b`, branche `codex/sutra-t01-integration-20261012`, URL https://sutra.purama.dev . CI exacte : https://github.com/puramapro-oss/sutra/actions/runs/38322846966 . L’image déployée est `sha256:4c773d0275baf2260b341901775c7b0f47a64bea5c4c711a686ed4643393e6b3`. Les commits de preuves ultérieurs ne changent pas cette image.

## Intégration et corrections

Les sept livraisons T02–T08 restent intégrées : 1105 empreintes vérifiées, 329 chemins acceptés sans fusion globale ; références propriétaires dans `qa/release-20261012/deliveries.json` et `accepted-content-audit.json`. Les cinq ancêtres protégés 35c137f/a322e53/e1bdd1b/05d164d/7088a0a restent présents. Main, branches propriétaires et 53 worktrees étrangers conservés ; contrôle `qa/deployment-20261013/preservation-release.json`.

La CI 9b0c2c9 a été relancée après l’ajout du secret SMARANA. Le setup fonctionne ; trois courses de navigation E2E ont été corrigées dans 3591818 par des attentes sur les liens visibles et l’URL finale, sans désactiver de test. CI 3591818 verte.

Un premier déploiement 3591818 a passé HTTP/HTTPS, puis le smoke Supabase a révélé 403 sur video_jobs. Rollback applicatif réel exécuté, ancienne image healthy. Les migrations v10/v11 avaient une politique RLS service mais aucun privilège SQL correspondant. Le test injectait des ACL par défaut qui masquaient ce défaut. aaa94f2 supprime cette hypothèse et ajoute SELECT/INSERT/UPDATE sur jobs/quota. 3e5596e corrige le même défaut sur une liste explicite de 25 tables v3 utilisées par les routes serveur. Aucun droit client ou barème modifié ; DELETE réservé au toggle love_reactions. Les 254 assertions de sécurité passent sous PostgreSQL 15 isolé et dans la CI finale. Les 120 contrôles SQL et 35 GET Supabase live passent après correction.

Une première tentative de promotion de 3e5596e a également échoué sur une erreur de syntaxe du script opératoire, après les migrations mais avant le remplacement de l’image. Le rollback a confirmé l’ancienne image saine. Le script corrigé a été compilé avant exécution ; la reprise a réutilisé le snapshot intact et les migrations validées, sans les rejouer. Voir `release-failure-rollback.json` et `release-procedure.py.txt`.

## Tests exacts du commit déployé

| Commande CI | Résultat |
| --- | --- |
| `npm run test:contracts` | 473 PASS, 7 SKIP ; schedule/composition/publication PASS |
| `npm run test:media` | 34 PASS, FFmpeg réel |
| `node qa/t08/run.mjs redteam` | 14 PASS |
| `npm run check` | typecheck/lint/build PASS ; 111 avertissements lint, 197 pages |
| `node qa/t08/run.mjs browser-redteam` | 210+7 contrôles PASS ; 165 audits axe, 0 violation, 0 erreur navigateur |
| `node scripts/run-ci.mjs legacy` | 1022 PASS, 25 SKIP, 0 échec, 0 flaky |
| `npm run test:migration-local` | 13 contrôles PASS, PostgreSQL 16 jetable |
| `node --import tsx --test scripts/test-pipeline-postgres.mts` | 12 PASS, concurrence PostgreSQL |
| `SUTRA_TEST_PG_BIN="$(pg_config --bindir)" node scripts/test-security-rls.mjs` | 254 assertions PASS |
| `python3 -m unittest discover -s deploy -p 'test_*.py'` | 17 PASS |
| `npm audit --omit=dev --audit-level=high` | PASS ; 0 high/critical, 2 low/5 moderate |

Les décomptes contrats/médias et lint/build proviennent des logs locaux du même périmètre inchangé ; la CI finale confirme les commandes PASS et fournit les décomptes E2E/PostgreSQL ci-dessus. Les 7 SKIP contrats sont 4 INSEE live, 2 DB distante et 1 OTS réseau. Les 25 SKIP E2E ne deviennent pas des PASS. La CI complète est la gate finale ; aucun appel fournisseur payant. L’essai local PostgreSQL Mac a aussi rencontré une saturation des segments mémoire système : aucun processus étranger arrêté, validation remplacée par un cluster PostgreSQL 15 isolé Docker sans réseau, 254 assertions PASS. Les échecs historiques et le rollback sont conservés dans les preuves.

## Sauvegardes, migrations et déploiement

Sauvegarde fraîche : `/opt/purama/apps/sutra/backup-t01-coherent-qdule8xx` ; restauration privée `sutra_restore_t01_qdule8xx`. 140 tables restaurées avec comptages identiques. SUTRA et trois tables publiques sociales partagent un snapshot read-only ; dépendance trigger, métadonnées Storage et archive des blobs incluses. Huit migrations appliquées deux fois sur la copie PostgreSQL 15.8. Auth est une fixture limitée aux ID référencés, pas une sauvegarde complète Supabase/Auth ; blobs non gelés transactionnellement. Données, secrets et diagnostics restent dans le répertoire OVH 0700. Empreintes : `backup-release.json`.

Ordre : v10_durable_jobs_quota, v11_pipeline_checkpoints, 20261012_social_publication_journals, 20261012_private_media, 20261012_t02_account_permissions, 20261012_t02_final_permissions, 20261013_job_service_permissions, 20261013_feature_service_permissions. Les six premières migrations ont été appliquées dans une transaction avant 3591818 ; les deux correctives dans une transaction avec 120 assertions avant COMMIT. Verrou 5 s et timeout 90 s ; pas de migration d’une autre app.

Le candidat Linux est construit depuis l’archive Git exacte, SMARANA verrouillé bc3469eb595485714b2044790105acfc5e3b0f31, ESLint du même commit. Conteneur candidat sans réseau externe : cinq GET et FFmpeg subtitles/drawtext/ffprobe PASS. Promotion de cette image exacte avec runtime conservé opaquément. Le helper partagé de déploiement générique a un faux écart : son filtre remote-only exclut deux variables Upstash également présentes côté source ; comparaison opaque confirme les 77 clés identiques. Le helper partagé n’a pas été modifié. La promotion contrôlée contourne ce faux écart en gardant Compose/runtime, en remplaçant seulement l’image et en ajoutant le resolver TLS du routeur SUTRA.

Snapshot applicatif `/opt/purama/apps/sutra/rollback-3e5596ea287f36427f687d3f3882d35c3f7c407b` conservé. Toute erreur de santé, de Supabase ou des smokes déclenche le rollback. Exemple réel 3591818 documenté dans `db-smoke-rollback.json`. Commande exacte depuis ce worktree :

```sh
python3 deploy/ovh.py rollback --source-ref 3e5596ea287f36427f687d3f3882d35c3f7c407b
```

Ce rollback restaure Compose/runtime et l’ancienne image ; il ne restaure pas SQL ni DNS. Les changements SQL additifs et les permissions fermées restent en place. Ne jamais restaurer une ancienne base par-dessus de nouvelles écritures sans analyse. Ne jamais rouvrir le bucket média privé pour rollback. Anciennes images, dumps et Vercel conservés.

## Smokes et Cloudflare

- Interne + HTTPS public : `/`200, `/login`200, `/api/points`401, `/api/video/status/00000000-0000-0000-0000-000000000000`401, `/api/media/b3duZXJzL3UvdGVzdC5tcDQ`401.
- `permissions-live-check.sql` : 120 assertions, y compris protection des colonnes admin/crédits, refus des clients sur les tables privées et bucket non public.
- `supabase-readonly-smoke.mjs` : 35 GET REST avec `limit=0`, 200 attendus ; aucune donnée retournée, écriture ou publication.
- Navigateur public réel Chromium : accueil hydraté puis formulaire de connexion visible, animation terminée, 1440×1000 et 375×812 ; captures affichées et inspectées. Requêtes mutantes bloquées, y compris enregistrement serveur du choix cookies ; aucun formulaire de connexion envoyé.
- Cloudflare : A`sutra`→144.217.14.210, DNS only, TTL Auto ; deux serveurs autoritaires et résolveurs 1.1.1.1/8.8.8.8 cohérents, aucun AAAA.
- TLS Let’s Encrypt, SAN sutra.purama.dev, validation normale sans désactiver la vérification. Resolver renouvelable ajouté uniquement au routeur SUTRA ; proxy partagé intact.

Preuves finales : `qa/deployment-20261013/deployment-release.json`, `ci-release-run.json`, `backup-release.json`, `permissions-production-release.json`, `supabase-release-smoke.json`, `dns-tls-release.json`, `public-browser-release.json`, `test-matrix-release.json`. La route `/api/health` est exclue car elle contacte des fournisseurs payants.

## Limites et reprise

Aucune action manuelle indispensable pour ce déploiement ; secret SMARANA résolu. Les parcours utilisateur authentifiés live, génération et publication payantes ne sont pas revendiqués. Les médias utilisent des références durables autorisées, signatures temporaires renouvelables et registres service-only ; un objet historique sans propriétaire reste conservé et non attribué.

La branche S5 historique non validée n’est pas fusionnée : budget hybride, restauration de versions et journal cron-runs non livrés ; édition du script sans régénération de voix. Ces limites ne constituent pas des preuves de fonctionnalités livrées.

POLICY_OK au démarrage. GitNexus impact service client CRITICAL signalé avant correction ; nouveau SQL non indexé. Graphe TRUNCATED et en retard : les diffs directs, tests et contrôles live constituent des preuves bornées ; aucune prétention d’exhaustivité. Detect-changes exécuté avant chaque commit, puis avant le commit documentaire final. Aucun reset/stash/clean, secret exposé, WIP étranger écrasé, processus étranger arrêté ou worktree supprimé.
