# T06 → T01 — lot social intégré, correction et rouge SQL

**Livraison locale : deux défauts corrigés avec leurs propriétaires ; recette composite 9/9 PASS. Nouveau SHA intégré T01 encore attendu.** Pas de fusion, push, déploiement, compte réel, consentement automatique ni publication.

- Branche : `codex/sutra-t06-integrated-retest-20261015`.
- Worktree : `/Users/matissdornier/purama-worktrees/sutra-t06-integrated-retest-20261015`.
- Base exacte : `56754679abed9aa1e51323c29aed5bef38bc17d0`, produit candidat T01 `d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2`.
- Commit de livraison : commit contenant ce fichier ; SHA complet transmis dans le miroir `.coord/handoffs/SUTRA-20261012/T06-INTEGRATED-RETEST-20261015.md` après création.
- Intégration du précédent lot `10693a2` : 45/45fichiers non partagés identiques ; trois documents communs consolidés. Aucune omission produit détectée avant le nouveau delta.

## Correction T06-INTEGRATED-01

`src/lib/social-account-revocation.ts` uniquement : après DELETE distant confirmé, relire le timestamp effectivement enregistré par le trigger SQL ; vérifier identité/révision/provenance/pending, puis CAS. Le timestamp JavaScript précédent causait503 et bloquait reconnexion malgré le succès distant. Concurrence avant/après relecture et nettoyage pending testés ; aucune répétition du DELETE.

## Correction SQL T01 reçue et retestée : T06-INTEGRATED-02

Le trigger `migrations/20261015_social_authorization_history.sql` refuse la révocation d'un ancien compte Zernio connecté sans `sutra_oauth_revision` : `SUTRA_SOCIAL_HISTORY_REVOCATION_INVALID`. Route503, ancienne autorisation locale et tokens restent inchangés par rollback. Dernier test de `qa/t06-integrated-retest-20261015/history-routes.test.mts` reproduit ce cas. Aucun hunk de migration modifié par T06. T01 a livré à13:30UTC la correction, SHA256 `d2f6a9cb380a15285759085cdf602701f0d9d785d4a7f76f2061438d38ab9ddc`. Copie exacte uniquement dans le QA, provenance consignée. Les mêmes9cas avec cette correction et le helper T06 passent **9/9**, sans skip. Aucun ancien consentement inventé. T01 peut intégrer les deux deltas puis refaire `history` sur le nouveau SHA exact.

## Tests et preuves

- **PASS** : OAuth76/76 ; publication simulée92/92 ; planning IANA/DST et auto-publication ; PostgreSQL CAS7/7 ; consommateur de révocation1/1 déjà inclus dans les92 ; TypeScript ciblé et lint.
- **PASS composite** : PostgreSQL routes+triggers **9/9**, avec SQL propriétaire T01 reçu. **FAIL historique conservé** : SQL de base8PASS/1FAIL ; avant correction T06 : 4 PASS/2FAIL sur6cas. Aucune réécriture de ces rouges.
- **EN ATTENTE** : intégration T01 et gate exacte ; correction SQL ACK/livrée/testée. T02 sécurité et T07 interface informés par miroir ; leurs fichiers préservés.
- **NON TESTÉ** : fournisseur et consentements réels, rotation/revoke distants, PostgREST/organisation réelle, publication/cron, build global du nouveau delta. Pas de répétition de la CI inchangée.

Commandes exactes, explications et reçus : [QA](qa/t06-integrated-retest-20261015/README.md). Banc privé `NODE24 qa/t06-integrated-retest-20261015/run.mjs history-t01` pour la copie SQL corrigée ; `history` utilise la migration canonique de chaque checkout et reste rouge sur notre base. T01 CI : `SUTRA_TEST_PG_BIN="$(pg_config --bindir)" NODE24 qa/t06-integrated-retest-20261015/run.mjs history` après intégration. Chemin PG explicite testé sur Mac, Linux NON TESTÉ ici. Graphe GitNexus partiel déclaré, impact préalable LOW deux appelants puis UNKNOWN après réindexation ; detect_changes critical avec associations hors SUTRA conservé et diff exact borné avant commit ; diff et scan expurgé consignés dans les preuves.

## Seule intervention personnelle

Après correction/intégration par T01 : Matiss ouvre **https://sutra.purama.dev/settings/social**, choisit ses réseaux, clique **Se connecter / Se reconnecter**, vérifie le compte et les permissions, accepte personnellement, puis vérifie **Connecte** et son identité au retour dans la même session sous10min. [Parcours détaillé et erreurs](qa/t06-integrated-retest-20261015/PARCOURS-MATISS.md). Aucune nouvelle clé demandée ; absence de consentement distincte du défaut logiciel et du test réel non effectué.
