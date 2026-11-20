# T06 → T01 — autorité du profil social

Branche : `codex/sutra-t06-social-validation-20261014`. Base T01 : `e09fdaeafbf1ec8554a7b689fe3c44dd696d0140`. SHA de livraison : commit porteur de ce fichier ; SHA complet communiqué dans `.coord/handoffs/SUTRA-20261012/T06-SOCIAL-VALIDATION-20261014.md`. Commit local uniquement.

**Corrigé :** le journal vérifie maintenant le binding Zernio actuel et la provenance du compte avant chaque création/replay/retry, y compris après réservation. Un binding absent/réaffecté, une provenance manquante ou une révocation en attente interdit l'envoi. Historique et rapprochement GET conservés. Reproduction 14 FAIL avant, 18 PASS après.

Fichier produit unique : `src/lib/publication-journal.ts`. Fixtures : `scripts/helpers/social-database.mts`, `scripts/test-social-publication.mts`, `scripts/test-t06-social-autonomy.mts`, `scripts/test-release-regressions.mts` (ACK T01), `qa/t08/integrated/load.test.mts` (ACK T08). Nouveau test : `scripts/test-t06-social-validation.mts`. Preuves et commandes : `qa/t06-social-validation-20261014/README.md`, `verification.json`, `results.json`. Append de suivi dans BATON/task_plan/ERRORS propres.

**PASS : 146 tests distincts**, TypeScript ciblé, lint. IANA/DST/récurrences réutilisés sur empreintes identiques de la dernière CI intégrée. GitNexus impact HIGH annoncé (manuel/auto), analyse finale CRITICAL annoncée, graphe partiel et exhaustivité UNKNOWN ; diff et consommateurs revus directement. Gitleaks et diff-check PASS. Aucun build global répété.

**FAIL fixture encore hors lot :** parcours historique T08, quatre PASS/quatre FAIL sous Node24 : identité `u` incompatible avec le binding UUID. T08 réserve ses deux fichiers de parcours et livre l'adaptation séparément. T01 doit intégrer ensemble T06 et cette fixture T08 puis demander le retest du candidat exact. Le premier FAIL sous Node26 était un défaut de harnais, preuve distincte conservée. Aucun fichier T08 hors load modifié, aucune assertion retirée.

**BLOQUÉ par intervention personnelle :** consentement légal/social. **NON TESTÉ :** publication réelle, refresh/révocation réels chez Zernio, PostgREST réel pour les deux nouveaux tests de sérialisation, build/candidat intégré et ordonnanceur réel. Les tests de sérialisation utilisent le vrai client et un faux transport ; les tests de concurrence utilisent une fausse base.

Frontières : T01 seul bindings/production/configuration/intégration ; T02 informé du delta sécurité, T07 du diagnostic de reconnexion. Aucun secret lu/affiché/copié, appel fournisseur, consentement, achat, génération, GPU, IA Mac, SQL distant, push, fusion ou déploiement.

Matiss : [réglages sociaux](https://sutra.purama.dev/settings/social) → **Se connecter / Se reconnecter** → choisir les comptes/destinations souhaités et consentir personnellement → revenir dans la même session sous dix minutes → vérifier **Connecte**. Parcours détaillé et limites dans le README ; aucune nouvelle clé requise. [Guide officiel Zernio](https://docs.zernio.com/guides/connecting-accounts).
