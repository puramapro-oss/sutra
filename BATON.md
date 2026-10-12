# BATON — reprise SUTRA T07 du 2026-10-12

Branche `codex/sutra-t07-ux-ui-reprise-20261012`, base intégrée et distante vérifiée `589732cb49959c1a576a3ba381b310cd594600ac`. Worktree T07 réutilisé propre ; ancienne branche et travaux étrangers préservés. LOCKS `SUTRA-T07-20261012:REPRISE-589732c`.

Jalon : correctifs client de navigation production, recherche stock, cache de mots-clés et export après navigation implémentés. Typecheck/lint/build197 pages PASS ; contrats427/7 SKIP, média33, PostgreSQL13+9+49 et Python9 PASS. Recette production210 PASS / axe164 sans violation / 0 erreur navigateur ; legacy1022 PASS / 25 SKIP en une exécution complète. Revue visuelle des cinq largeurs effectuée. Commandes et preuves : `qa/t07-reprise/README.md`. Aucun contrat serveur modifié. Commit/push autorisés par la reprise utilisateur, garde anti-déploiement de cette seule branche ajoutée.

Code et preuves committés : `b2e7f3a89af740537f5b2e3fa8ab85d7a125dcda` ; 44 empreintes de sources/configuration et 39 preuves vérifiées depuis Git. Handoff final : `HANDOFF-SUTRA-T07-20261012.md`. Le SHA distant de livraison est consigné dans `.coord/handoffs/SUTRA-20261012/T07-HANDOFF.md` à la racine PURAMA. Aucun blocage local restant ; intégration coordinateur et CI T01 (credential SMARANA absent) restent externes. Pas de release certifiée. Ne pas rejouer les PASS inchangés.

## Archive T01 — base de reprise

# BATON — SUTRA T01, intégration du 2026-10-12

Branche `codex/sutra-t01-integration-20261012`, worktree isolé homonyme sous `purama-worktrees`. Livraison = commit contenant ce BATON, manifest de sources `qa/integration-20261012/verification.json`.

Les huit lots sont réconciliés avec PR1/PR2/PR3 et `05d164d`, sans fusion aveugle S5. Cinq références protégées dans l'ascendance, main et 47 worktrees étrangers préservés. Matrice : `qa/integration-20261012/MATRIX.md` ; commandes et limitations : `HANDOFF-SUTRA-T01-20261012.md`.

Gates locales : contrats427 PASS/7 SKIP, média33 PASS, PostgreSQL13+9+49 PASS, qualité typecheck/lint/build197pages PASS, Python déploiement9 PASS. Legacy complet1013 PASS/9 FAIL/25 SKIP puis neuf corrections requalifiées9 PASS : agrégat1022 PASS/25 SKIP. Navigateur203 PASS agrégés (suite202 + reprise ciblée5),155 audits axe/0 violation,0 erreur navigateur ; détail au handoff. Audit0haute/critique,5modérées/2faibles. Aucun appel payant ni migration distante.

Release non certifiée : Docker/Linux/OVH/fournisseurs réels et schéma distant non testés. Fonctionnalités S5 versions/hybride/logger non intégrées ; script éditeur sans régénération vocale. Ne pas transformer ces limites en PASS.

Mandat courant autorise commit et push de cette branche, pas un déploiement. Prochaine étape : lire le résultat CI distante du commit poussé, puis qualifier le schéma et le runtime OVH après autorisation distincte. Ne pas refaire les tests inchangés. Recette et rollback sous `deploy/README.md`.

Premier push `0e7575e` confirmé ; CI38289108161 échoue avant tests sur credential SMARANA absent et healthcheck PostgreSQL mal cité. Guillemets du healthcheck corrigés dans le commit courant, actionlint PASS ; aucun code produit modifié.
