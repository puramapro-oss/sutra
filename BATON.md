# BATON — SUTRA T03, reprise finale du 2026-10-12

Branche `codex/sutra-t03-pipeline-resume-20261012`, base T01 `589732cb49959c1a576a3ba381b310cd594600ac`, code `8103fff5f86fb3cfc60e2ed921f24b41897f0ded`. Worktree isolé homonyme sous `/Users/matissdornier/purama-worktrees`.

LOCAL_DELTA_VERIFIED : baux SQL NULL refusés ; checkpoints/pistes obligatoires et preuve finale stricts. Les neuf checkpoints et la file durable déjà intégrés sont préservés. Détails, fichiers et commandes : `HANDOFF-SUTRA-T03-20261012.md`, `qa/t03-resume/verification.json`.

Gates : contrats428 PASS/7 SKIP ; média33 PASS ; SQL13+12+49 PASS ; navigateur203 PASS/155 audits axe sans violation ; legacy1022 PASS/25 SKIP ; Python9 PASS ; typecheck/lint0erreur/build197 PASS avec polices réelles en cache. Aucun test fournisseur payant. Dernier delta de garde revalidé par contrats/SQL/RLS/typecheck/lint/build ; parcours UI inchangés non rejoués.

Prochaine étape appartenant à T01 : intégrer ce delta et les reprises propriétaires sans écrasement, fournir le credential CI SMARANA manquant et une recette offline de polices, qualifier/réappliquer v11 puis les permissions finales sur le schéma cible après autorisation distincte. Aucun déploiement ni DB distante dans ce mandat. Ne pas rejouer les PASS inchangés.

Commit et push T03 autorisés ; SHA final/confirmation origin dans `.coord/handoffs/SUTRA-20261012/T03-REPRISE-589732c.md` racine PURAMA. Ancien T03, T01 et WIP étrangers préservés. Release non certifiée.

---

## Archive du BATON T01 reçu à la base

# BATON — SUTRA T01, intégration du 2026-10-12

Branche `codex/sutra-t01-integration-20261012`, worktree isolé homonyme sous `purama-worktrees`. Livraison = commit contenant ce BATON, manifest de sources `qa/integration-20261012/verification.json`.

Les huit lots sont réconciliés avec PR1/PR2/PR3 et `05d164d`, sans fusion aveugle S5. Cinq références protégées dans l'ascendance, main et 47 worktrees étrangers préservés. Matrice : `qa/integration-20261012/MATRIX.md` ; commandes et limitations : `HANDOFF-SUTRA-T01-20261012.md`.

Gates locales : contrats427 PASS/7 SKIP, média33 PASS, PostgreSQL13+9+49 PASS, qualité typecheck/lint/build197pages PASS, Python déploiement9 PASS. Legacy complet1013 PASS/9 FAIL/25 SKIP puis neuf corrections requalifiées9 PASS : agrégat1022 PASS/25 SKIP. Navigateur203 PASS agrégés (suite202 + reprise ciblée5),155 audits axe/0 violation,0 erreur navigateur ; détail au handoff. Audit0haute/critique,5modérées/2faibles. Aucun appel payant ni migration distante.

Release non certifiée : Docker/Linux/OVH/fournisseurs réels et schéma distant non testés. Fonctionnalités S5 versions/hybride/logger non intégrées ; script éditeur sans régénération vocale. Ne pas transformer ces limites en PASS.

Mandat courant autorise commit et push de cette branche, pas un déploiement. Prochaine étape : lire le résultat CI distante du commit poussé, puis qualifier le schéma et le runtime OVH après autorisation distincte. Ne pas refaire les tests inchangés. Recette et rollback sous `deploy/README.md`.

Premier push `0e7575e` confirmé ; CI38289108161 échoue avant tests sur credential SMARANA absent et healthcheck PostgreSQL mal cité. Guillemets du healthcheck corrigés dans le commit courant, actionlint PASS ; aucun code produit modifié.
