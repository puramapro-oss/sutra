# BATON — SUTRA T01, intégration du 2026-10-12

Branche `codex/sutra-t01-integration-20261012`, worktree isolé homonyme sous `purama-worktrees`. Livraison = commit contenant ce BATON, manifest de sources `qa/integration-20261012/verification.json`.

Les huit lots sont réconciliés avec PR1/PR2/PR3 et `05d164d`, sans fusion aveugle S5. Cinq références protégées dans l'ascendance, main et 47 worktrees étrangers préservés. Matrice : `qa/integration-20261012/MATRIX.md` ; commandes et limitations : `HANDOFF-SUTRA-T01-20261012.md`.

Gates locales : contrats427 PASS/7 SKIP, média33 PASS, PostgreSQL13+9+49 PASS, qualité typecheck/lint/build197pages PASS, Python déploiement9 PASS. Legacy complet1013 PASS/9 FAIL/25 SKIP puis neuf corrections requalifiées9 PASS : agrégat1022 PASS/25 SKIP. Navigateur203 PASS agrégés (suite202 + reprise ciblée5),155 audits axe/0 violation,0 erreur navigateur ; détail au handoff. Audit0haute/critique,5modérées/2faibles. Aucun appel payant ni migration distante.

Release non certifiée : Docker/Linux/OVH/fournisseurs réels et schéma distant non testés. Fonctionnalités S5 versions/hybride/logger non intégrées ; script éditeur sans régénération vocale. Ne pas transformer ces limites en PASS.

Mandat courant autorise commit et push de cette branche, pas un déploiement. Prochaine étape : lire le résultat CI distante du commit poussé, puis qualifier le schéma et le runtime OVH après autorisation distincte. Ne pas refaire les tests inchangés. Recette et rollback sous `deploy/README.md`.

Premier push `0e7575e` confirmé ; CI38289108161 échoue avant tests sur credential SMARANA absent et healthcheck PostgreSQL mal cité. Guillemets du healthcheck corrigés dans le commit courant, actionlint PASS ; aucun code produit modifié.


## T02 — reprise sécurité finale depuis 589732c

Branche isolée `codex/sutra-t02-security-final-20261012`, base exacte `589732cb49959c1a576a3ba381b310cd594600ac`. Le lot T02 antérieur est déjà intégré ; aucun doublon ni fichier produit d’un autre terminal modifié. Delta : migration additive permissions SQL (TRUNCATE global, écritures récompenses, tokens/autorité public.social_accounts), test RLS étendu, POST points arbitraire refusé avant écritures/crédit portefeuille et garde anti-déploiement de la seule branche avant push autorisé.

Preuves fraîches : RLS147, contrats437/7SKIP dont dix nouveaux tests points, média33, SQL13+9, typecheck/lint0erreur111warnings, build197 avec police locale, navigateur203/155 audits axe sans violation. Build canonique hors réseau FAIL Google Fonts, harnais QA T02 explicite ; runner T01 intact. Legacy1022 PASS/25SKIP ; commandes détaillées : `HANDOFF-SUTRA-T02-20261012.md`, manifeste `qa/t02-final/verification.json`.

Prochaine étape : intégrer uniquement le commit T02 depuis son handoff. Stockage privé/URL signée exige contrat durable T03/T05/T06 et migration des références ; DB/Auth/Storage distants et isolation organisations non prouvés. T07 doit adapter le toast/appel de récompense respiration maintenant refusé ; aucune nouvelle autorité financière inventée. Aucun déploiement ni appel payant. SHA final et confirmation du push dans `.coord/handoffs/SUTRA-20261012/T02-COORDINATION.md` à la racine PURAMA.
