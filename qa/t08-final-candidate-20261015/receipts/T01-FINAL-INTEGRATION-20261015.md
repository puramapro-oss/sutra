# T01 — coordination finale 15 octobre

Base commune confirmée : **49c166d4c15412d2a3c1246c216cf0df319f2df0**, documentaire uniquement après produit testé **3855665fa79e3cc2171124d864a834214d6ac617**. CI38598361267 verte, réutilisable uniquement pour fichiers inchangés. Aucun nouveau SHA candidat avant collecte. Production dernier constat86d04c8, sonde lecture seule actuelle en cours.

## Propriétaires et dépendances
- T02 : private-media.ts / capability, fixture test-private-media. T06 autorité sociale reste propriétaire OAuth/journal ; réutiliser helper existant.
- T03 : video-queue.ts, pipeline-state.ts, production-pipeline.ts et proposition SQL QA seulement. T01 possède migrations canoniques.
- T04 : image worker reproductible container ; pas d’adaptateur concurrent. **SALAD_API_KEY master vérifiée actuellement malformée (texte commande/non ASCII), aucune requête envoyée, utilisateur informé. Ne pas dupliquer la sonde, ne pas recopier cette valeur.**
- T05 : ffmpeg-concurrency.ts, ffmpeg-compositor.ts, ffmpeg-encoder.ts. Coordination interface pipeline avec T03, sans modification croisée.
- T06 : périmètre social réservé.
- T07 : login/page.tsx et signup/page.tsx réservés ; backend inchangé.
- T08 : recette indépendante du candidat exact, aucune duplication par T01. Le candidat3855665 reste ancienne référence : de nouveaux défauts prouvés15oct attendent correctifs auteurs. Verdict final à rejouer uniquement sur delta intégré, pas de build global concurrent.

Chaque auteur livre SHA, chemins, preuves rouge/vert, commandes, dépendances et limites dans son handoff. Aucun cherry-pick aveugle. Aucun terminal fermé. Promotion gelée jusqu’à corrections et validation T08. Consentements personnels non effectués ; ordonnanceur exécutant des appels fournisseurs reste désactivé. T01 seul OVH/config/migrations.

## Runtime confirmé 2026-10-15T01:07:42.495268+00:00
OVH sert86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164, healthy,0restart. Aucun cron SUTRA hôte/systemd/pg_cron,0queued/processing/expired/uncertain,0autoactive,0autopublication. Salad désactivé, gateway absente. CRON_SECRET présent, runtime0600. Aucun provider appelé. Base sept auteurs49c166d inchangée; attendre leurs deltas, ne pas promouvoir3855665.

## 2026-10-15T01:10:46.042642+00:00 — SUTRA-T01:DEPLOY-GUARDS — délégation bornée ACTIVE
T01 attribue exclusivement à son auxiliaire postdeploy_security les fichiers deploy/ovh.py, deploy/test_ovh.py, deploy/promotion_guards.py, deploy/test_promotion_guards.py, deploy/test_salad_promotion.py, qa/t01-consolidation-20261014/promote.py, verify-checkpoint-concurrency.py ; checkpoint-transition.py uniquement option CLI --proof-dir. Worktree /Users/matissdornier/purama-worktrees/sutra-final-providers-20261013, base49c166d4c15412d2a3c1246c216cf0df319f2df0. Corrections backup/SQL exacts, CAS rollback, SSH incertain, preuve concurrence. Tests locaux simulés seulement, aucune action distante, aucun secret, aucun commit. Tous autres WIP réservés à leurs propriétaires. T01 intègre et reste seul OVH/migrations ; ne remplace pas T08.

## Reponse T02 — metadata OVH 2026-10-15T01:14:01.062244+00:00
Lecture autorisee T01 uniquement : six tables existent et RLS=true partout. Logs api/activity/error aucun privilege anon/authenticated, service_role seul. contest_submissions/referrals/referral_commissions : privileges DML anon/authenticated avec politiques own_* et t02_active_account ; qualification precisement bornee en cours T01 sur copie privee, aucune vulnérabilite affirmee par simples ACL. Preuves qa/t01-final-20261015/rls-{metadata,policies}.json. Ne pas dupliquer ni modifier SQL. Nouvelle sauvegarde/restauration privee PASS141tables, comptages exacts, quatre contrats de schema. Production86d inchangee.

## T01-SQL-01 — trois permissions defectueuses confirmees

| SUTRA-T01-20261015:FINAL-SQL-PERMISSIONS | 2026-10-15T01:15:51.603905+00:00 — T01 exclusivement reserve migrations/20261015_client_write_permissions.sql, qa/t01-final-20261015/rls-*.py/.json, scripts/test-final-write-permissions.mjs et futurs outils ACL transition dans qa/t01-final-20261015. Trois mutations injustifiees reproduites sur copie privee restauree (commission amount/status, referral level/processed, concours score/votes/status) sous authenticated; transaction synthetique rollback. Aucun solde/donnee/regle financiere modifie. Correction droits clients uniquement, serveur conserve. Impact GitNexus tables requis, tests PG et rollback ACL exact avant production. Aucun fichier T02 auteur modifie. | ACTIF T01 SQL |

Preuve qa/t01-final-20261015/rls-write-red-admin.json : 3 mutations non autorisees sur fixtures privees, rollback total, aucune production touchee. T02/T08 : readOnly metadata ne suffisait pas ; maintenant correctif permissions T01 en cours. RLS active et active-account restrictive ne protegeaient pas les colonnes propres. T02 ne duplique pas SQL.
