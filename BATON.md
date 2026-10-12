# BATON — SUTRA T01, intégration du 2026-10-12

Branche `codex/sutra-t01-integration-20261012`, worktree isolé homonyme sous `purama-worktrees`. Livraison = commit contenant ce BATON, manifest de sources `qa/integration-20261012/verification.json`.

Les huit lots sont réconciliés avec PR1/PR2/PR3 et `05d164d`, sans fusion aveugle S5. Cinq références protégées dans l'ascendance, main et 47 worktrees étrangers préservés. Matrice : `qa/integration-20261012/MATRIX.md` ; commandes et limitations : `HANDOFF-SUTRA-T01-20261012.md`.

Gates locales : contrats427 PASS/7 SKIP, média33 PASS, PostgreSQL13+9+49 PASS, qualité typecheck/lint/build197pages PASS, Python déploiement9 PASS. Legacy complet1013 PASS/9 FAIL/25 SKIP puis neuf corrections requalifiées9 PASS : agrégat1022 PASS/25 SKIP. Navigateur203 PASS agrégés (suite202 + reprise ciblée5),155 audits axe/0 violation,0 erreur navigateur ; détail au handoff. Audit0haute/critique,5modérées/2faibles. Aucun appel payant ni migration distante.

Release non certifiée : Docker/Linux/OVH/fournisseurs réels et schéma distant non testés. Fonctionnalités S5 versions/hybride/logger non intégrées ; script éditeur sans régénération vocale. Ne pas transformer ces limites en PASS.

Mandat courant autorise commit et push de cette branche, pas un déploiement. Prochaine étape : lire le résultat CI distante du commit poussé, puis qualifier le schéma et le runtime OVH après autorisation distincte. Ne pas refaire les tests inchangés. Recette et rollback sous `deploy/README.md`.

Premier push `0e7575e` confirmé ; CI38289108161 échoue avant tests sur credential SMARANA absent et healthcheck PostgreSQL mal cité. Guillemets du healthcheck corrigés dans le commit courant, actionlint PASS ; aucun code produit modifié.

## Reprise T05 — 2026-10-12, base intégrée 589732c

Worktree isolé `sutra-t05-media-export-final-20261012`, branche `codex/sutra-t05-media-export-final-20261012`. Code `834e30edefafd224461616e9854ded42e857f3d4` : mesures sources/lineage/audio obligatoires dans la validation de buffer ; preuve liée au SHA-256 et à la taille des octets avant upload. Deux régressions reproduites puis corrigées.

Gates gratuites fraîches : contrats429 PASS/7 SKIP + schedule/composition/publication PASS ; média34 PASS ; typecheck PASS ; lint0 erreur/111 warnings. Build initial bloqué Google Fonts hors réseau ; reprise du seul build avec vrais WOFF2 T01 locaux PASS197 pages, garde réseau maintenue. Aucun changement UI/package/CI, aucun appel payant/déploiement. Détails et manifest : `HANDOFF-SUTRA-T05-20261012.md` et `docs/t05-final-evidence/manifest.json`. Les anciens blocages S5 du handoff T05 sont remplacés par ce constat sur base T01.

Prochaine étape : coordinateur T01 intègre le delta T05 et les autres reprises sans remplacement aveugle ; qualifier séparément CI vierge/polices, runtime Linux/OVH et fournisseurs réels. Ne pas rejouer les PASS inchangés. SHA de livraison et push confirmés dans le pointeur T05 de `.coord/handoffs/SUTRA-20261012/`.
