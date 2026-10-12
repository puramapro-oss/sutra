# BATON — SUTRA T01, production autorisée

2026-10-13 : **CORRECTION_PERMISSIONS_AVANT_REDEPLOIEMENT**. CI3591818 intégralement verte (run38320118213). Six migrations appliquées atomiquement après backup/restore136 tables. Candidat Linux exact promu ; cinq GET HTTPS PASS, DNS Cloudflare A144.217.14.210 DNS-only, TLS Let’s Encrypt valide.

Le smoke Supabase supplémentaire a détecté403 sur video_jobs : les migrations v10/v11 ne donnaient aucun droit SQL au service_role. Rollback applicatif effectué et healthy ; migrations additives, bucket privé et DNS OVH conservés. Migration20261013_job_service_permissions.sql ajoute uniquement SELECT/INSERT/UPDATE sur jobs/quota. Test corrigé pour ne plus injecter de droits par défaut ; régression reproduite. Aucun appel payant.

Prochaine étape : CI du correctif verte, sauvegarde fraîche, migration corrective testée sur copie privée, promotion du candidat exact, smoke Supabase + HTTP + DNS/TLS. Preuves : qa/deployment-20261013/. Le rapport final remplacera les états historiques du handoff et du plan. Conserver les53 worktrees étrangers, les7 lots intégrés, les commits protégés et toutes les images/backups.
