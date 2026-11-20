# Correction CI : lecture bibliothèque avant reload légal

CI39323751415 sur f9537e5f : contrats et DB PASS, qualité FAIL. Un seul contrôle final WebKit légal a retenu une erreur CORS sur le GET exact de bibliothèque lors du reload. La preuve rouge originale est conservée dans ci-f953-red.json. Les autres étapes qualité situées après le scénario ont été non exécutées par GitHub, pas transformées en skips de tests.

La barrière de lectures existante accepte maintenant, uniquement avec includeLibrary explicite, le GET /rest/v1/videos de l’identité synthétique et sa requête exacte (offset0,limit12). Elle observe le document principal, exige réponse200 et corps complet, et bloque les erreurs, délais, mauvais chemins/identités/queries, anciens documents et frames secondaires. Le garde runtime et ses classifications restent inchangés. Le scénario légal utilise cette barrière avant ses reloads. Le mode --production-legal permet le retest ciblé des deux moteurs ; --final-integrated conserve ses26scénarios et toutes ses assertions.

Preuves locales :46/46tests de barrière,0FAIL0SKIP ;15/15contrôles légaux Chromium et15/15WebKit sur build production,0FAIL ; lint des trois fichiers0erreur0warning. Contrôles négatifs natifs : un vrai refus CORS, une exception et un rejet restent visibles et bloquants. Deux lectures ont été attendues par moteur. Aucune connexion, publication, acceptation juridique personnelle ni génération réelle. Résultats détaillés dans receipt.json, logs et qa/t07-final-ux-perf-20261015/legal-production-chromium/.

GitNexus rafraîchi avant édition : les symboles QA restent ambigus/absents par chemin ; impact global CRITICAL235,141directs,35processus20modules, couverture partielle. Avertissement donné ; revue directe des quatre consommateurs existants, option bibliothèque désactivée par défaut. Aucun PASS exhaustif du graphe revendiqué. detect_changes précommit consigné séparément.

Nouveau SHA et CI exacte seront consignés dans le registre partagé ; tous les ACK doivent viser ce SHA. Produit et dépendances inchangés depuis f953 ; R107 reste réservé à T03. Aucun déploiement autorisé par ce correctif.

Détection précommit :39fichiers,15symboles,213flux annoncés,CRITICAL. Les noms génériques QA userId/state/url sont rapprochés à des flux produit ; aucune modification produit dans le diff. Gitleaks staged0détection. Rapport final avec les reçus ajoutés conservé au registre partagé.
