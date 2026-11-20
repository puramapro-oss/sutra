# Analytics, apprentissage et compilation — 10 novembre 2026

## Composition

Cette correction se superpose au commit `3e15b4dd407b9cad3f1899cb33bdac1ec8568ba1` de la PR #9. Sa continuation de qualification a été récupérée pendant l'audit et conservée intégralement : 20 chemins de documentation, fixtures et outillage, sans chevauchement avec nos 11 fichiers initiaux. La correction analytique reprend les trois fichiers produit et les trois bancs de la PR #11 (`265103459e5bd13d0754959ada1e8162dfc57279`) ; les contrôles CI plus récents du parent sont conservés.

## Défauts reproduits et corrigés

- Les filtres d'analytics utilisent le contrat Zernio `accountId`, `postId` et `profileId`. La lecture exige le compte, la plateforme, la publication et la synchronisation attendus. Une réponse indisponible, partielle ou contradictoire ne produit plus de mesures à zéro.
- L'apprentissage vérifie les comptes exacts avant et après les lectures distantes, refuse les doublons et débordements, compare la révision de la vidéo lors de l'écriture, puis utilise uniquement les mesures réellement confirmées. Les données antérieures sont conservées si une destination échoue.
- L'écriture de mémoire retourne une confirmation explicite. Les deux appelants, apprentissage et tendances, ne comptent que les écritures confirmées. Un échec de tendance donne un résultat partiel et ne bloque pas les écritures suivantes.
- Le plugin next-intl ajoute une configuration Webpack personnalisée, ce qui désactive l'activation automatique du worker de compilation. Le worker et les optimisations mémoire de Next sont maintenant explicites. Les deux workers de génération de pages et le contrôle TypeScript restent actifs.

## Vérification locale

| Contrôle | Résultat |
| --- | --- |
| Contre-épreuve analytics sur le parent | 3 PASS, 46 FAIL sur 49 |
| Analytics après correction | 49/49 PASS |
| Contre-épreuve mémoire des tendances | 2 PASS, 3 FAIL sur 5 |
| Mémoire des tendances corrigée | 5/5 PASS |
| Contrats généraux | 1 531 PASS, 0 FAIL, 7 cas connectés ignorés sur 1 538 ; les 54 cas ci-dessus sont inclus |
| Soumission durable | 18/18 PASS |
| Promotion | 162/162 PASS |
| Contrôles horaires, composition, publication | PASS |
| Profil qualité | TypeScript, ESLint (0 erreur, 96 avertissements conservés) et compilation Next complète PASS ; 199 pages générées |
| PostgreSQL natif 18.6 | 9 groupes multicomptes, 13 contrôles quotas et 16 cas pipeline PASS |

Le profil qualité a été exécuté avec `SUTRA_CI_HEAP_MB=1280`. Avant le réglage du worker, les tentatives à 2 048 et 1 280 Mio ont reçu SIGKILL ; à 768 Mio, la compilation passait mais TypeScript épuisait son tas. Ces échecs sont conservés dans les preuves. Le réglage ne supprime aucun contrôle de qualité. Le temps de compilation observé dépend du cache et ne constitue pas une mesure de latence en production.

La base native jetable utilisait TCP sur `127.0.0.1`, une authentification SCRAM et aucun socket Unix. Les bases de test ont été retirées, le cluster arrêté et le mot de passe éphémère supprimé. Les services de production et fournisseurs n'ont pas été sollicités.

## Dépendances et limites

`npm ci --offline --ignore-scripts --no-audit --no-fund` n'a pas abouti : une dépendance Git privée n'était pas dans le cache. Le runtime a été restauré aux versions exactes du lockfile, avec vérification des archives publiques et des blobs du commit privé autorisé. **Ce n'est pas une installation standard réussie.** Le manifeste et le lockfile applicatifs ne changent pas ; aucun code privé n'est ajouté à cette proposition.

Les résultats de la continuation native et navigateur du parent restent identifiés dans `qa/native-qualification-20261110`. Ils ne sont pas additionnés aux scénarios fraîchement exécutés ici. Aucune nouvelle qualification navigateur complète de SUTRA n'est revendiquée dans ce lot, qui ne modifie pas ses composants d'interface.

La CI distante, les fournisseurs réels, OAuth, les publications, les paiements, les durées sous charge et la mise en service publique restent à qualifier. La route de tendances conserve également ses limites antérieures de recherche fournisseur ; ce lot corrige seulement la confirmation des écritures de mémoire. Les avertissements de dépréciation Next sur middleware/Edge restent visibles.

Le déploiement automatique est désactivé pour la branche d'audit. Cette proposition est un candidat de revue, sans fusion, déploiement ni migration de production.

## Références techniques

- [Contrat analytics Zernio](https://docs.zernio.com/core/analytics)
- [Évolutions et états de synchronisation Zernio](https://docs.zernio.com/changelog)
- [Optimisation mémoire Next.js](https://nextjs.org/docs/app/guides/memory-usage), confrontée à la documentation livrée dans Next 16.4.5.

Les commandes, versions et empreintes de cette qualification figurent dans `results.json` et dans le dossier de preuves remis avec l'audit PURAMA.
