# BATON — SUTRA T01, intégration du 2026-10-12

Branche `codex/sutra-t01-integration-20261012`, worktree isolé homonyme sous `purama-worktrees`. Livraison = commit contenant ce BATON, manifest de sources `qa/integration-20261012/verification.json`.

Les huit lots sont réconciliés avec PR1/PR2/PR3 et `05d164d`, sans fusion aveugle S5. Cinq références protégées dans l'ascendance, main et 47 worktrees étrangers préservés. Matrice : `qa/integration-20261012/MATRIX.md` ; commandes et limitations : `HANDOFF-SUTRA-T01-20261012.md`.

Gates locales : contrats427 PASS/7 SKIP, média33 PASS, PostgreSQL13+9+49 PASS, qualité typecheck/lint/build197pages PASS, Python déploiement9 PASS. Legacy complet1013 PASS/9 FAIL/25 SKIP puis neuf corrections requalifiées9 PASS : agrégat1022 PASS/25 SKIP. Navigateur203 PASS agrégés (suite202 + reprise ciblée5),155 audits axe/0 violation,0 erreur navigateur ; détail au handoff. Audit0haute/critique,5modérées/2faibles. Aucun appel payant ni migration distante.

Release non certifiée : Docker/Linux/OVH/fournisseurs réels et schéma distant non testés. Fonctionnalités S5 versions/hybride/logger non intégrées ; script éditeur sans régénération vocale. Ne pas transformer ces limites en PASS.

Mandat courant autorise commit et push de cette branche, pas un déploiement. Prochaine étape : lire le résultat CI distante du commit poussé, puis qualifier le schéma et le runtime OVH après autorisation distincte. Ne pas refaire les tests inchangés. Recette et rollback sous `deploy/README.md`.
