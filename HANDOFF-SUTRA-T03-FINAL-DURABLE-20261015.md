# T03 → T01 — pipeline durable final, 15 octobre 2026

**PASS LOCAL, intégration T01/recette T08 en attente.** Branche `codex/sutra-t03-final-durable-20261015`, base confirmée `49c166d4c15412d2a3c1246c216cf0df319f2df0`. Commit de livraison = commit contenant ce handoff ; SHA exact dans `.coord/handoffs/SUTRA-20261012/T03-FINAL-DURABLE-20261015.md` racine coordination.

Produit modifié uniquement :

- `src/lib/video-queue.ts` : résultat lié aux checkpoints/export validé ; annulation SQL/transport expurgée et ACK booléen obligatoire (T08-CANCEL-01).
- `src/lib/pipeline-state.ts` : promotion pending, sérialisation et immutabilité, ACK avant mémoire, storyboard durable séparé ; `assertFinalMedia` inchangé.
- `src/lib/production-pipeline.ts` : intégrité voix/checksum et refus de relance incertaine, étapes optionnelles cohérentes, zéro nouvelle synthèse sur narration vide.
- `scripts/test-t03-orchestration-fixes.mts` : six fixtures terminales corrigées, assertions conservées ; nouveaux tests `scripts/test-t03-final-durable.mts` et `qa/t03-final-durable-20261015/`.
- Append T03 seulement dans BATON/task_plan/ERRORS ; dossier de preuves et ce handoff.

**148 tests PASS /0 FAIL final /0 SKIP** : nouveaux contrats25, régressions concernées69, worker distant simulé16, AUTO/export5, annulation HTTP T08 copiée4, ACK/transport9, PostgreSQL privé20. TypeScript/lint ciblés PASS. Les cinq tests d'annulation supplémentaires rejoués sont déjà inclus dans69. Commandes exactes, preuves rouge/vert, empreintes, transitions et limites : [README QA](qa/t03-final-durable-20261015/README.md). Aucun build global répété.

Proposition SQL **non appliquée** : [proposal-final-durable.sql](qa/t03-final-durable-20261015/proposal-final-durable.sql), quatre RPC remplacés et un helper pur ; finish strict, backoff durable, états génération séparés des états sociaux, validation ready cohérente. Tests PG18 réels privés, proposition appliquée deux fois, cluster arrêté. Aucun changement table/colonne/enum/historique. T01 porte la migration canonique et sa preuve ACL/rollback ; fixtures PG/RLS T01 listées dans README à adapter, non touchées ici.

États jobs : queued → processing → done/failed/queued/reconciliation_required ; cancellation atomique vers cancelled. Lease expiré : nouveau propriétaire, ancien refusé. Inconnu : quota/acquis conservés et réconciliation avant toute soumission. `compositing_failed` incompatible CHECK : rejet explicite, failed canonique conserve les acquis. Les étapes script/storyboard/scènes/images/voix/musique/sous-titres/composition/export sont indépendantes. Publication pending = relais au journal T06 par compte ; partial publié conservé, preuve inchangée réutilisée depuis le candidat testé, sans nouvelle implémentation sociale.

**T01 :** importer uniquement les chemins possédés, porter la proposition SQL, réconcilier les autres lots propriétaires, produire le candidat exact puis transmettre à T08. **T08 :** C04 passe dans sa copie inchangée, mais aucun ACK indépendant final n'est présumé. Pas de cherry-pick aveugle des fichiers d'état partagés.

**BLOQUÉ externe :** migration canonique/intégration T01 et recette T08. **NON TESTÉ :** DB/transport distant, fournisseur/GPU/argent/publication réels, production, disponibilité continue, build du futur candidat. Quotas ≠ facturation fournisseur ; annulation ≠ remboursement/arrêt distant ; legacy voix sans SHA ≠ intégrité historique prouvée. GitNexus CRITICAL annoncé, impacts et changements analysés ; couverture tronquée, exhaustivité UNKNOWN.

Worktree T01 conservé (100/100 empreintes inchangées), T04/T05/T06 intacts. Aucun secret, génération payante, IA Mac, migration distante, publication, push, fusion ou déploiement.
