# BATON — SUTRA T01, intégration du 2026-10-12

Branche `codex/sutra-t01-integration-20261012`, worktree isolé homonyme sous `purama-worktrees`. Livraison = commit contenant ce BATON, manifest de sources `qa/integration-20261012/verification.json`.

Les huit lots sont réconciliés avec PR1/PR2/PR3 et `05d164d`, sans fusion aveugle S5. Cinq références protégées dans l'ascendance, main et 47 worktrees étrangers préservés. Matrice : `qa/integration-20261012/MATRIX.md` ; commandes et limitations : `HANDOFF-SUTRA-T01-20261012.md`.

Gates locales : contrats427 PASS/7 SKIP, média33 PASS, PostgreSQL13+9+49 PASS, qualité typecheck/lint/build197pages PASS, Python déploiement9 PASS. Legacy complet1013 PASS/9 FAIL/25 SKIP puis neuf corrections requalifiées9 PASS : agrégat1022 PASS/25 SKIP. Navigateur203 PASS agrégés (suite202 + reprise ciblée5),155 audits axe/0 violation,0 erreur navigateur ; détail au handoff. Audit0haute/critique,5modérées/2faibles. Aucun appel payant ni migration distante.

Release non certifiée : Docker/Linux/OVH/fournisseurs réels et schéma distant non testés. Fonctionnalités S5 versions/hybride/logger non intégrées ; script éditeur sans régénération vocale. Ne pas transformer ces limites en PASS.

Mandat courant autorise commit et push de cette branche, pas un déploiement. Prochaine étape : lire le résultat CI distante du commit poussé, puis qualifier le schéma et le runtime OVH après autorisation distincte. Ne pas refaire les tests inchangés. Recette et rollback sous `deploy/README.md`.

Premier push `0e7575e` confirmé ; CI38289108161 échoue avant tests sur credential SMARANA absent et healthcheck PostgreSQL mal cité. Guillemets du healthcheck corrigés dans le commit courant, actionlint PASS ; aucun code produit modifié.

## 2026-10-12 — reprise T06 sur l'intégration finale

Branche `codex/sutra-t06-social-final-20261012`, worktree T06 existant isolé, base exacte `589732cb49959c1a576a3ba381b310cd594600ac`. Code `d4238596abb84a88f84e3c3e49f3a46aed44fd0d` : relecture des droits/média/compte après claim replay/retry ; profil actif requis pour les envois service-role, GET de réconciliation conservé après révocation. Ancien lot T06 déjà intégré, aucun doublon ni modification T02/T03/T05.

Gates gratuites actuelles : contrats448 PASS/7 SKIP (dont51 T06), trois scripts calendrier/composition/publication PASS, typecheck/lint/build197 PASS (111 warnings préexistants), média33 PASS après reprise du compositeur avec FFmpeg-static existant, navigateur203 PASS/155 audits axe sans violation, legacy1022 PASS/25 SKIP/0 FAIL, Python9 PASS. Aucun fournisseur réel, DB distante ou déploiement. SQL/audit/workflows inchangés : preuves T01 conservées sans rejeu. GitNexus HIGH, index tronqué non exhaustif.

Preuves liées au code : `qa/t06-final/verification.json`. Transmission : `HANDOFF-SUTRA-T06-20261012.md`. Commit/push autorisés, garde Vercel de la branche présente. Prochaine action coordinateur : intégrer ce seul delta avec les autres propriétaires ; stockage privé et qualification distante restent externes. Ne pas refaire les PASS inchangés.
