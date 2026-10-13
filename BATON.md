# BATON — SUTRA T01, OVH en production

2026-10-13 : **DEPLOYE / CI ET SMOKES GRATUITS PASS**. Commit applicatif `3e5596ea287f36427f687d3f3882d35c3f7c407b`, poussé et déployé sur https://sutra.purama.dev. CI finale : https://github.com/puramapro-oss/sutra/actions/runs/38322846966 . Les derniers commits documentaires ne changent ni l’application ni l’image déployée.

Huit migrations SUTRA appliquées après sauvegardes/restaurations ; dernière restauration : 140 tables aux comptages identiques, huit migrations rejouées deux fois. 254 assertions RLS en CI, 120 contrôles SQL live, 35 GET Supabase sans lignes, 5 GET internes et 5 HTTPS publics PASS. DNS Cloudflare A 144.217.14.210 DNS-only ; TLS Let’s Encrypt valide. Aucun appel fournisseur payant.

Le premier déploiement 3591818 a été annulé automatiquement après un 403 Supabase ; les droits service_role manquants ont été corrigés et testés sans droits par défaut artificiels. L’image finale passe ce smoke. Sauvegardes, anciennes images et snapshot rollback `/opt/purama/apps/sutra/rollback-3e5596ea287f36427f687d3f3882d35c3f7c407b` conservés ; ne jamais rouvrir le bucket média privé pour rollback.

État détaillé, commandes exactes et limites : HANDOFF-SUTRA-T01-20261012.md, deploy/README.md, qa/deployment-20261013/. Les 53 worktrees étrangers et cinq ancêtres protégés sont conservés. Aucune action manuelle indispensable ; parcours authentifiés et fournisseurs payants non revendiqués. Les sections ci-dessous sont des archives historiques, sans autorité de déploiement actuelle.

## Archive antérieure au déploiement final

# BATON — SUTRA T01, production autorisée

2026-10-13 : **CORRECTION_PERMISSIONS_AVANT_REDEPLOIEMENT**. CI3591818 intégralement verte (run38320118213). Six migrations appliquées atomiquement après backup/restore136 tables. Candidat Linux exact promu ; cinq GET HTTPS PASS, DNS Cloudflare A144.217.14.210 DNS-only, TLS Let’s Encrypt valide.

Le smoke Supabase supplémentaire a détecté403 sur video_jobs : les migrations v10/v11 ne donnaient aucun droit SQL au service_role. Rollback applicatif effectué et healthy ; migrations additives, bucket privé et DNS OVH conservés. Migration20261013_job_service_permissions.sql ajoute uniquement SELECT/INSERT/UPDATE sur jobs/quota. Test corrigé pour ne plus injecter de droits par défaut ; régression reproduite. Le contrôle élargi a trouvé le même manque sur les tables v3 utilisées par les routes serveur : migration20261013_feature_service_permissions.sql, liste explicite25 tables, droits clients inchangés, DELETE uniquement pour le toggle love_reactions. Aucun appel payant.

Prochaine étape : CI du correctif verte, sauvegarde fraîche, migration corrective testée sur copie privée, promotion du candidat exact, smoke Supabase + HTTP + DNS/TLS. Preuves : qa/deployment-20261013/. Le rapport final remplacera les états historiques du handoff et du plan. Conserver les53 worktrees étrangers, les7 lots intégrés, les commits protégés et toutes les images/backups.
