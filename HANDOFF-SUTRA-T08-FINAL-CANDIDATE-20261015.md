# T08 → T01 — recette indépendante finale, 15 octobre

**NON PRÊT aux essais réels.** SHA testé : `3855665fa79e3cc2171124d864a834214d6ac617`. Branche livraison : `codex/sutra-t08-final-candidate-20261015` ; SHA du commit local transmis dans le miroir de coordination après commit. T01 confirme officiellement qu'un nouveau candidat doit intégrer les corrections15oct ; aucun SHA final encore fourni.

- Matrice : **45 PASS,12 FAIL,2 BLOQUÉS,13 NON TESTÉS**,72 exigences. Un FAIL direct T08, onze exigences rouges propriétaires.
- Tests directs : **62 PASS,1 FAIL,0 SKIP** ;13 scénarios du parcours complet simulé PASS. Annulation C04 reste rouge, pas ignorée. TS/lint ciblés et Python AST PASS.
- Provenance :99 contrôles PASS ; CI exacte38598361267, artefacts navigateur/SQL/CPU et37MP4 vérifiés, aucun build global répété. Deux captures affichées.
- Fichiers : nouveaux `qa/t08-final-candidate-20261015/**`, ce handoff, append `BATON.md`/`task_plan.md`. Aucun produit ou test propriétaire modifié.

Défaut direct transmis à **T03** : POST production cancel, session valide et requestId UUID ; RPC cancel_video_job renvoie un diagnostic synthétique. Attendu5xx expurgé ; observé503 avec diagnostic interne. `python3 qa/t08-final-candidate-20261015/run.py cancellation` :3PASS/1FAIL. Cause `cancelJobByKey` réutilise error.message puis catch HTTP l'expose. Corriger dans le scope auteur, préserver C04, retester sur candidat intégré.

Autres rouges : capabilities privées T02 ; autorité/répétition/purge/historique OAuth T06+SQL T01 ; permissions SQL client T01 ; concurrence/deadline CPU T05 ; auth clavier/double submit et panne/dialogue social T07 ; reprise/checkpoints T03. T05 livre44cbbab mais un vert local n'est pas une intégration. Reproductions, attendus, observés, sources : [DEFECTS.md](qa/t08-final-candidate-20261015/DEFECTS.md).

La nouvelle restauration T01 du15oct01:10UTC prouve141 tables et les comptages sur copie privée, avec limites auth/blob explicites. Configuration inactive (cron/Salad), clé Salad malformée signalée T01, consentements personnels et budget réel absent sont distincts des bugs. Génération GPU, qualité IA, publication publique, appareils mobiles réels, lecteur écran, alertes et rollback production restent NON TESTÉS.

**Dépendance externe restante : T01 fournit SHA intégré + manifeste des deltas et preuves.** Rejouer seulement les rouges/régressions affectés, puis le parcours complet selon [SMOKE-T01.md](qa/t08-final-candidate-20261015/SMOKE-T01.md). Aucun ACK de promotion ni fusion. Aucun coût/secret/production affecté. Actions personnelles minimales et liens officiels : [README.md](qa/t08-final-candidate-20261015/README.md#conditions-restantes).

Matrice et preuves : [MATRIX.md](qa/t08-final-candidate-20261015/MATRIX.md), [README.md](qa/t08-final-candidate-20261015/README.md).
