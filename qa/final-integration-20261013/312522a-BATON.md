# SUTRA T02 — complément sécurité fournisseurs, 2026-10-13

**LOCAL_DELTA_VERIFIED / FOURNISSEURS BLOQUÉS.** Branche `codex/sutra-t02-provider-security-20261013`, base `48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4`. Trois fuites prouvées dans GET social/accounts (metadata et diagnostics) corrigées ; 12 régressions ajoutées au runner CI existant. Aucun autre produit modifié, aucun fichier réservé T01/T04/T05/T06/T08 écrasé.

Commandes exactes et manifest des sources : `qa/t02-provider-security-20261013/README.md`. `node scripts/run-ci.mjs contracts` : 492 PASS, 0 FAIL, 7 SKIP ; schedule/composition/publication simulée PASS. `node qa/t02-final/run-free-gates.mjs quality` : TypeScript PASS, lint 0 erreur/111 avertissements existants, build webpack PASS (197 pages). Environnement fixtures sans secrets et réseau bloqué. Preuve avant correction : 3 FAIL/9 PASS. Aucune modification pertinente après ces gates ; ne pas les rejouer sans delta.

Sondes T01/T04 depuis le maître réutilisées et figées sans secrets : Mac/OVH RunPod 401, Shotstack 4×403, Suno base 503 sans auth qualifiée ; Zernio GET 200 mais OAuth ancien incompatible. Mapping profil/organisation et minimisation des scopes à raccorder avant consentement. Correction Shotstack détenue par T05 ; aucune intégration dans ce lot. Aucun déploiement/merge/migration/publication/appel payant/modification distante de configuration. Push de code explicitement autorisé ; garde Vercel false ajoutée pour cette branche seulement, hors déclencheurs GitHub Actions.

Prochaine tâche non vérifiée : coordinateur, reprendre les corrections de contrat OAuth/profil et livraison T05 ; utilisateur, rétablir clés RunPod/Shotstack et confirmer fournisseur Suno, puis consentir aux réseaux après qualification. SHA de ce commit et fichiers transmis dans `.coord/handoffs/SUTRA-20261012/T02-PROVIDER-SECURITY-20261013.md` du dépôt coordinateur.

---

Les sections suivantes sont historiques et ne valent pas autorisation de push/déploiement.

# SUTRA — reprise apres verification finale, 2026-10-13

**OVH OPERATIONNEL / RECETTE CONNECTEE EN ATTENTE.** Commit applicatif `f770e272d2d8e3bb3dde5b523fe7aa37f122399d` deploye sur https://sutra.purama.dev ; CI38330861913 : trois jobs SUCCESS. Deux defauts origine Auth/CSRF corriges, sept regressions. Public desktop/mobile affiche et verifie ; 28 controles origine, 10 GET,120 SQL PASS ; logs/base healthy, sauvegarde restauree precedemment et empreintes revalidees, snapshot rollback du precedent3e conserve. Aucun appel payant ni nouvelle migration.

Prochaine tache non verifiee : recette connectee avec un compte SUTRA QA existant dont l'utilisateur fournit uniquement l'adresse. Ne pas creer Authuser (57 triggers hors SUTRA), ne pas utiliser de compte utilisateur reel. Creation de projet, pipeline gratuit authentifie, media prive et SRT live restent non verifies. Ne pas rejouer les gates vertes sans delta. Preuves exactes, commandes et rollback : HANDOFF-SUTRA-T01-20261012.md et qa/postdeploy-20261013/README.md.

Les états plus anciens ci-dessous restent historiques.

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
