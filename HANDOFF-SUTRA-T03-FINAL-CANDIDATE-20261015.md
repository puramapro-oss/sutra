# T03 → T01 / T08 — final durable sur cb3f893

FIN_ECRITURE produit : aucun changement produit. Branche `codex/sutra-t03-final-candidate-20261015`, base `cb3f893c35599a6c9c50a4d23c82013c10c5f3ae`. SHA de livraison : commit contenant ce handoff, reporté intégralement dans le miroir commun T03-FINAL-DURABLE-20261015 après commit.

**PASS local** :13 nouveaux scénarios API réelle + PostgreSQL privé (11 initiaux puis2contre-épreuves de fixtures),29T03 invariants réutilisés après14hash identiques,20empreintes T07 identiques. TS/lint stricts ciblés. Zéro défaut produit démontré dans ce delta ; deux corrections de fixture seulement. Deux clusters arrêtés,14jobs réglés,aucun quota réservé restant. Aucun fournisseur/secret/push/production.

Tests, transitions, fichiers, preuves brutes rouges/vertes, limites et commandes exactes : [dossier QA](qa/t03-final-candidate-20261015/README.md). Source/receipts : `integration-proof.json`, `invariants.json`, `api-postgres.json`, `replay-two-api-postgres.json`, journaux settlement/pg-stop. Aucun total artificiel entre CI recouvrantes et tests réutilisés.

Migration canonique déjà intégrée : `migrations/20261015_final_durable_integrity.sql`, SHA256 `e8befa9e9fa602d80c483245bc71d07831fe56aad9ee05ed83dc2261a1d7805c`. Aucune migration supplémentaire. Ordre T01 : durable → permissions clients → historique social. Reçus T01 backup/restauration/replay/rollback privés relus ; aucune application distante T03. Fraîcheur backup, rollback attendu et droits finaux à relire par T01 avant toute opération autorisée.

**FAIL restant T03 : aucun démontré. BLOQUÉ :** ACK/intégration T01/T08 et qualification release globale indépendante. **NON TESTÉ :** runtime candidat/transport distant/fournisseurs/facturation/remboursements/stockage réel/publication réelle. Annulation durable job et quota ≠ arrêt garanti du fournisseur. Pas de certification production ni de zéro bug garanti.

Après intégration : vérifier ces empreintes et rejouer uniquement les tests affectés si route/queue/SQL/dépendances changent. Le delta livré est QA/docs ; aucun build global identique demandé. Moteur existant et ownership T04/T05/T06/T07 préservés.

GitNexus final **CRITICAL**, associations de noms génériques et graphe tronqué : avertissement conservé, portée réelle QA/docs contrôlée par Git. Gitleaks code PASS ; scans complets exit1 avec trois empreintes de test prouvées non secrètes par reconstruction exacte (`gitleaks-triage.json`). Aucun faux PASS brut. T01 confirme20:26UTC que son WIP planning ne change pas nos routes d'annulation/moteur ; candidat relu cb3f893.
