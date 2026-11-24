# T08 — recette indépendante du candidat d21b7b4

**NON PRÊT aux essais réels.** SHA testé : `d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2`. Reçu documentaire `56754679abed9aa1e51323c29aed5bef38bc17d0` :22fichiers sans intersection avec les1034sources testées. CI exacte [38677062190](https://github.com/puramapro-oss/sutra/actions/runs/38677062190), trois jobs SUCCESS. Les quatre nouveaux défauts restent ouverts jusqu'au nouveau SHA T01.

Matrice : **53 PASS,5 FAIL,2 BLOQUÉS,13 NON TESTÉS** sur73exigences. Les5FAIL sont R49,R64,R65,R67,R73 et correspondent à4causes reproductibles, détaillées dans [DEFECTS.md](DEFECTS.md). Les12anciens FAIL ont tous été réexaminés :9clos dans leur périmètre,3réouverts sur la frontière SQL réelle (R64/R65/R67). Aucun statut précédent repris comme preuve.

Preuves exécutées et réutilisées :

- T08 direct, `python3 qa/t08-acceptance-d21b7b4-20261015/run.py` :91PASS/0FAIL/0SKIP — annulation4, capacités privées19, autorité sociale15, durable34, modes6, parcours13. Commandes exactes, environnement synthétique, SHA et horodatages dans les JSON adjacents. Les dépendances réseau sont simulées, preload externe bloquant ; aucune génération payante ni publication réelle.
- T08 nouveau contre-test indépendant :6tests,2PASS/4FAIL/0SKIP, `harness-boundaries.test.mjs`. Les rouges ne sont ni ignorés ni convertis en verts. Ils révèlent une qualification excessive d'erreurs de mutation pendant une navigation WebKit, sans affirmer une panne produit réellement observée en CI.
- Vérification indépendante de provenance :1110contrôles PASS (ce ne sont pas1110tests fonctionnels),1034sources et blobs d21,5artefacts CI hashés,20familles navigateur,17exports CPU réels. Les diagnostics CI qualifiés sont tous GET ; leurs assertions UI spécifiques restent recevables, le contre-exemple générique R73 reste FAIL.
- CI exacte réutilisée : contrats955PASS/7SKIP, legacy1022PASS/25SKIP ; aucun FAIL, aucun total additionné entre suites recouvrantes. TS/lint/build PASS. PostgreSQL jetable :261RLS,30ACL,23historique,46durable/social,16pipeline,7Salad. Ces résultats ne masquent pas les nouveaux scénarios PG T06 rouges.
- T07 cbcf174 :142assertions Chromium375/1440 et39contrôles axe sans violation, sources produit identiques ; WebKit réutilisé de CI. T05 f0bb470 :82sources inchangées,5tests/3exportsCPU4K synthétiques réels, aucune génération native4K. Aucun build ou encodage identique relancé par T08.
- Qualité du nouveau delta QA : AST Python2fichiers, node --check, ESLint ciblé PASS ; `quality.json`.

La chaîne indépendante utilise les routes, la file, le worker, le pipeline, le contrat export et le journal social réels, avec session/DB/fournisseurs/stockage simulés. Les exports CPU et tests PG constituent des preuves réelles séparées. Aucun parcours continu navigateur→DB distante→GPU→publication publique n'est certifié.

Limites restantes : nouveau SHA corrigé attendu de T01 ; cron/auto-publication volontairement inactifs (inventaire13:23UTC), annulation durable serveur non câblée dans /create ; aucun login OAuth personnel, compte social/consentement réel, GPU/24Go/génération IA/coût réel, publication publique, SLA distant, lecteur écran physique, alerte exploitation ou restauration complète auth/sessions/blobs. Backup T01 frais restauré141tables à13:21UTC, périmètre auth IDs et blobs non atomiques explicitement borné. Aucun changement de production T08.

Les reçus fournisseur sur runtime86d04c8 sont datés et distincts du candidat d21 : health/templates200 n'est ni preuve GPU ni génération. Les variables du test sont synthétiques uniquement ; aucun secret master/.env lu/copié/committé. Les reçus copiés contiennent uniquement métadonnées expurgées.

Coordination : nouvelle branche `codex/sutra-t08-acceptance-d21b7b4-20261015`, scope QA réservé ; aucun fichier produit/harnais propriétaire modifié. Voir [SMOKE-T01.md](SMOKE-T01.md) pour la seule reprise nécessaire sur le prochain SHA et [MATRIX.md](MATRIX.md) pour chaque exigence.

GitNexus : analyse21025nœuds/40986relations, graphe TRUNCATED (1160liens interlangage non résolus,1269points d’entrée et678callees hors couverture). detect_changes staged :53fichiers/14symboles/0processus/LOW, aucun symbole produit ; compare main :3501fichiers/9335symboles/228processus/CRITICAL plafonné. Ce dernier est historique, ne certifie pas le delta QA. Huit UUID de fixtures navigateur retirés des données brutes dérivées après scan ; preuves CI originales et leurs hashes conservés. Aucun test exclu. Logs bruts conservent leurs espaces d’assertion ; diff --check sources/docs hors logs PASS.
