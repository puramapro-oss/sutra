# Défauts ouverts sur d21b7b4

Candidat exact `d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2`. Aucun fichier produit ou fichier QA propriétaire modifié par T08. T01 a accusé réception des quatre défauts à13:22UTC et suspendu la promotion. Les verts WIP propriétaires ne sont pas des retests intégrés.

| Défaut / propriétaire | Reproduction minimale | Attendu | Observé / preuve |
|---|---|---|---|
| T08-HARNESS-01 / T01 | Node24 --test qa/t08-acceptance-d21b7b4-20261015/harness-boundaries.test.mjs ; navigation WebKit explicite, preuve native GET, événement same-origin POST/PATCH/DELETE/méthode absente | Erreur unexpected1, qualified0 | unexpected0, qualified1 ;2PASS4FAIL0SKIP ; harness-boundaries.log. Cause : méthode absente de la borne same-origin. |
| T02-RPC-02 / T02 | Fixture auteur scripts/test-t02-rpc-security-production.mts ; POST /api/production autorisé, puis claim RPC/profil/worker lance un diagnostic privé synthétique | Code public exact dans HTTP et last_error, aucun diagnostic interne | Marqueur privé exposé ; receipts/t02-production-red.log12PASS7FAIL. Source route56754679 identique d21 ; green19 auteur WIP ne ferme pas R49. |
| T06-INTEGRATED-01 / T06 | NODE24 qa/t06-integrated-retest-20261015/run.mjs history ; route réelle+PG18 privé, connexion puis DELETE fournisseur simulé200 | Réponse200, révocation confirmée, replay sans DELETE et reconnexion permise | Réponse503/pending : trigger updated_at remplace timestamp JS, CAS confirme avec ancienne valeur ; receipts/t06-postgres-before-fix.log, test1. R64/R67 réouverts. |
| T06-INTEGRATED-02 / T01 SQL | Même runner, compte connected avec credential_owner=zernio/profil valide sans sutra_oauth_revision, DELETE | Fence local révoqué, anciens tokens purgés, historique de provenance fidèle |503/SUTRA_SOCIAL_HISTORY_REVOCATION_INVALID, compte reste connected ; même log test6. R65 réouvert. |

Les deux dernières reproductions couvrent la frontière route/SQL réelle absente des mocks précédents. Le log original6tests4PASS2FAIL est conservé même si l'auteur ajoute des contre-tests de concurrence ensuite. Tests auteurs réutilisés ; aucune copie ou réécriture de leurs assertions dans le produit.

Après intégration T01 : capturer SHA exact, diff/hash du code et des fixtures ; retester les quatre défauts avec ces mêmes assertions puis la chaîne indépendante13scénarios. Conserver chaque rouge et chaque nouveau résultat dans un dossier distinct. Aucun skip ajouté, aucun ancien reçu écrasé.
