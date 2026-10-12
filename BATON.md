# BATON — SUTRA T01, intégration du 2026-10-12

Branche `codex/sutra-t01-integration-20261012`, worktree isolé homonyme sous `purama-worktrees`. Livraison = commit contenant ce BATON, manifest de sources `qa/integration-20261012/verification.json`.

Les huit lots sont réconciliés avec PR1/PR2/PR3 et `05d164d`, sans fusion aveugle S5. Cinq références protégées dans l'ascendance, main et 47 worktrees étrangers préservés. Matrice : `qa/integration-20261012/MATRIX.md` ; commandes et limitations : `HANDOFF-SUTRA-T01-20261012.md`.

Gates locales : contrats427 PASS/7 SKIP, média33 PASS, PostgreSQL13+9+49 PASS, qualité typecheck/lint/build197pages PASS, Python déploiement9 PASS. Legacy complet1013 PASS/9 FAIL/25 SKIP puis neuf corrections requalifiées9 PASS : agrégat1022 PASS/25 SKIP. Navigateur203 PASS agrégés (suite202 + reprise ciblée5),155 audits axe/0 violation,0 erreur navigateur ; détail au handoff. Audit0haute/critique,5modérées/2faibles. Aucun appel payant ni migration distante.

Release non certifiée : Docker/Linux/OVH/fournisseurs réels et schéma distant non testés. Fonctionnalités S5 versions/hybride/logger non intégrées ; script éditeur sans régénération vocale. Ne pas transformer ces limites en PASS.

Mandat courant autorise commit et push de cette branche, pas un déploiement. Prochaine étape : lire le résultat CI distante du commit poussé, puis qualifier le schéma et le runtime OVH après autorisation distincte. Ne pas refaire les tests inchangés. Recette et rollback sous `deploy/README.md`.

Premier push `0e7575e` confirmé ; CI38289108161 échoue avant tests sur credential SMARANA absent et healthcheck PostgreSQL mal cité. Guillemets du healthcheck corrigés dans le commit courant, actionlint PASS ; aucun code produit modifié.


## Reprise T08 — QA intégrée du 2026-10-12 (état courant de cette branche)

Branche `codex/sutra-t08-qa-integrated-20261012`, base exacte `589732cb49959c1a576a3ba381b310cd594600ac`. Les lignes T01 ci-dessus sont conservées comme historique. Mandat : QA uniquement, commit/push autorisés ; aucun déploiement, appel payant, publication réelle, migration ou secret. LOCKS T08 réservés, produit et tooling propriétaires inchangés.

Sources/commandes/rapports : `qa/t08/integrated/verification.json` et `HANDOFF-SUTRA-T08-20261012.md`. Matrice 43 exigences : 26 PASS, 5 FAIL, 5 BLOQUE, 7 NON TESTE. Nouvelle garde URL encodée corrigée : 14 tests garde/charge PASS. Contrats427 PASS/7 SKIP, média33 PASS, Python9 PASS ; navigateur203 PASS + T08 5 PASS/1 FAIL, 156 audits axe/0 violation ; legacy complet1022 PASS/25 SKIP/0 FAIL, sans reprise. Typecheck/lint PASS (111 warnings hérités), build197 pages PASS avec polices locales réelles ; build sans cache bloqué par garde réseau. SQL13+9+49 T01 hérité sans migration rejouée.

Prochaine tâche : T07 reçoit le défaut reproductible T08-I01 (deux POST export dans la même frame), T01 intègre explicitement le delta QA et les corrections propriétaires, puis rejoue seulement les tests affectés. Les fonctions budget hybride/versions/logger S5 restent absentes ; CI T01 échoue avant tests au setup SMARANA. RELEASE_CERTIFICATION = BLOQUE. Ne pas assimiler les mocks à une recette DB/fournisseur/OVH réelle. Aucun PASS inchangé à rejouer.
