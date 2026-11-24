# T08 → T01 — recette indépendante d21b7b4

**NON PRÊT aux essais réels.** Candidat testé `d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2`, reçu documentaire56754679, CI38677062190. Branche locale `codex/sutra-t08-acceptance-d21b7b4-20261015` ; aucun push/fusion/production. Commit de preuves à relever via `git log -1 --format=%H -- qa/t08-acceptance-d21b7b4-20261015` (distinct du SHA candidat).

Matrice :53PASS/5FAIL/2BLOQUÉS/13NON TESTÉS sur73exigences. Sur12anciens FAIL,9clos dans leur périmètre et3réouverts après preuve route/trigger SQL T06. Les4causes restantes sont T02-RPC-02 (diagnostic privé HTTP/durable), T06-INTEGRATED-01 (CAS timestamp SQL), T06-INTEGRATED-02 (révocation legacy SQL), T08-HARNESS-01 (mutation masquée par preuve GET). Propriétaires informés et ACK T01 reçu13:22UTC. Aucun fichier propriétaire édité.

T08 direct91PASS0FAIL0SKIP, nouveau contre-test harnais2PASS4FAIL0SKIP conservé.1034sources exactes et1110contrôles de preuve PASS,20familles navigateur et17exports CPU vérifiés ; CI exacte TS/lint/build/contrats/PG réutilisée sans répétition. Nouveaux reçus T07 cbcf174 (142assertions/39axe) et T05 f0bb470 (3exports4K synthétiques/5tests) réutilisés. Qualité nouveau QA PASS. Aucun appel fournisseur réel, secret, GPU, IA Mac, publication ou migration production.

Fichiers : nouveau `qa/t08-acceptance-d21b7b4-20261015/**` (tests, logs, matrice JSON/Markdown, preuves et reprises), ce handoff, append propres BATON/task_plan. Aucun code produit modifié. GitNexus analyse fraîche tronquée ; résultats de delta à joindre, aucune certification exhaustive du graphe.

Blocage immédiat : nouveau SHA T01 intégrant les4corrections attendu. Reprise exacte : [qa/t08-acceptance-d21b7b4-20261015/SMOKE-T01.md](qa/t08-acceptance-d21b7b4-20261015/SMOKE-T01.md), tests affectés puis parcours13une fois. Cron inactif, annulation UI /create non câblée, consentements personnels/GPU/publication/SLA/lecteur écran/backup auth complet restent hors preuve ; aucune autorisation de promotion déduite.

Détails : [matrice](qa/t08-acceptance-d21b7b4-20261015/MATRIX.md), [défauts reproductibles](qa/t08-acceptance-d21b7b4-20261015/DEFECTS.md), [rapport](qa/t08-acceptance-d21b7b4-20261015/README.md). Snapshot2026-10-15T13:31:41.071939+00:00.

GitNexus : analyse21025nœuds/40986relations, graphe TRUNCATED (1160liens interlangage non résolus,1269points d’entrée et678callees hors couverture). detect_changes staged :53fichiers/14symboles/0processus/LOW, aucun symbole produit ; compare main :3501fichiers/9335symboles/228processus/CRITICAL plafonné. Ce dernier est historique, ne certifie pas le delta QA. Huit UUID de fixtures navigateur retirés des données brutes dérivées après scan ; preuves CI originales et leurs hashes conservés. Aucun test exclu. Logs bruts conservent leurs espaces d’assertion ; diff --check sources/docs hors logs PASS.
