# SUTRA — corrections et vérifications du 9 novembre 2026

## Résultat et périmètre

Cette livraison part du commit `299619c397a8ae6aff5f80b9a4ce4aea79c3fe48`
(PR #7). Les corrections et les parcours locaux décrits ci-dessous sont vérifiés.
La validation de la production et des fournisseurs réels reste distincte.
La branche `repair/sutra-security-20261109` désactive son déploiement Vercel
automatique ; aucune migration distante ni publication métier n'est effectuée.

## Corrections

Les mises à jour corrigent les versions concernées de Next.js, Sentry, Zod,
DOMPurify, glob, minimatch, body-parser, proxy-addr et basic-ftp. Les dépendances
de développement de Lighthouse CI sont actualisées. Les tests utilisent les
vrais parseurs, bibliothèques et petits serveurs locaux pour vérifier les
comportements corrigés : limites de tableaux, arrêt d'une recherche glob,
adresses IPv6 mappées, corps gzip invalide ou trop grand, réponse FTP.

L'actualisation des règles React a révélé des initialisations d'état synchrones
dans des effets. Les lectures asynchrones utilisent désormais annulation,
identité de requête et abandon des réponses périmées. Les composants sensibles
à l'identité sont remontés pour le compte ou la vidéo concernés. Aucun délai
artificiel ni désactivation générale des règles ne masque ces erreurs.

Les reçus de création et de production sont gérés par un store local à chaque
utilisateur, abonné avec `useSyncExternalStore`. Le rendu serveur reste verrouillé
jusqu'à la restauration. Un reçu est enregistré avant un envoi ; un résultat
incertain conserve son identité et la reprise ne crée pas implicitement une
nouvelle opération. Le changement de compte interrompt le suivi local sans
prétendre annuler la tâche serveur. Un ancien formulaire n'est plus restauré
après une fin ou une annulation confirmée.

L'administration des utilisateurs invalide les anciennes lignes après l'échec
d'un nouveau filtre. La vraie page rend alors l'erreur et la reprise, et ne
permet plus d'exporter en CSV un résultat ancien présenté comme le nouveau.

Les écrans de santé et de coût distinguent une mesure absente d'un zéro mesuré.
Les statistiques vérifient les erreurs et les comptes exacts : un jeu de lignes
tronqué ne devient pas un total certifié. Le cache change de version pour
écarter d'anciens résultats incomplets. Les concours exposent une indisponibilité
si leurs lectures échouent ; un compteur absent ne devient plus une participation.

Le parcours de financement ne simule plus un PDF réussi, un envoi ou une prise en
charge intégrale. Il conserve la recherche réelle d'aides, la sélection et la
revue, avec les limites explicites. L'administration des concours affiche son
indisponibilité tant que son contrat de données et de paiement n'est pas établi.

## Preuves exécutées

| Contrôle | Résultat |
| --- | --- |
| TypeScript global final | PASS, 0 erreur |
| ESLint global final | PASS, 0 erreur, 96 avertissements conservés |
| Compilation Next.js 16.4.5 / webpack | PASS, compilation, typage, collecte et génération terminés |
| Contrats complets | 1 371 PASS, 7 ignorés, 0 échec ; 1 378 cas découverts |
| Soumission durable complémentaire | 18/18 PASS |
| Scénarios de planification, composition, publication | Trois étapes PASS |
| Navigateur produit de production | 210 contrôles PASS ; Chromium 153.0.8010.0 |
| Largeurs navigateur | 320, 375, 768, 1 280 et 1 440 pixels |
| Accessibilité automatisée | 164 rapports, 0 violation remontée dans le périmètre testé |
| Erreurs JavaScript du navigateur produit | 0 |
| Reprise des vrais hooks, SSR/hydratation, StrictMode | 10/10 PASS |
| Store durable et SSR | 6/6 PASS, inclus dans la suite des contrats |
| Vraie page AdminUsers, erreurs et réponses périmées | 2/2 PASS |
| Nouveau profil CI browser-recovery | 12/12 PASS ; joint les deux suites Chromium |

Le navigateur produit a précédé la dernière invalidation d'une ligne dans
`useAdminUsers`. Cette correction a ensuite passé les deux cas de la vraie page,
puis le typage, le lint et la compilation globaux. Les sources applicatives
sont demeurées fonctionnellement identiques après ces derniers contrôles ; deux
fins de fichiers ont été normalisées avec JavaScript émis strictement identique.
Les ultimes changements
de livraison raccordent les tests au workflow, déclarent directement esbuild
0.28.2 déjà présent et verrouillé, et ajoutent cette documentation. Aucun nœud
ni version du graphe de dépendances n'a changé avec cette déclaration directe.

Les nouveaux tests sont conservés dans `scripts/test-*-20261109.*`,
`scripts/test-development-dependency-security.mjs`,
`scripts/test-durable-request-store.mts`, `scripts/test-durable-hook-recovery.mjs`
et `scripts/test-admin-users-recovery.mjs`. Le profil `browser-recovery` est
appelé après l'installation des navigateurs dans le workflow qualité.

## Dépendances et limites

L'audit npm complet exécuté sur le candidat corrigé retourne sept alertes
résiduelles : cinq modérées et deux faibles, aucune haute ou critique. Elles
concernent la chaîne OpenTimestamps historique. Ce résultat n'établit pas
l'absence de toute vulnérabilité ni la sécurité des services déployés.

Les 96 avertissements de lint ne sont pas transformés en zéro. Les sept cas
ignorés restent comptés comme ignorés. Les tests répétés avant/après, les
contrôles de largeur et les suites contenant les mêmes primitives ne sont pas
additionnés en un total artificiel de fonctionnalités indépendantes.

Les dix observations de chargement local sur données synthétiques vont de
199 à 409 ms ; une tâche longue atteint 184 ms. Ce sont des observations de
ce poste et de cette fixture, pas des mesures de réseau mobile réel, de charge,
de disponibilité ni une garantie de performance de production.

La récupération de toutes les lignes statistiques reste à remplacer par une
agrégation ou pagination serveur qualifiée lorsque les volumes dépassent la
limite PostgREST. Le comportement actuel refuse alors un résultat incomplet.
La génération effective du dossier de financement, l'administration des
concours et leur schéma métier ne sont pas déclarés fonctionnels.

Les tests utilisent des réponses synthétiques, un stockage isolé et des
identifiants factices. Ils ne prouvent ni un envoi réel, ni un paiement, ni une
production vidéo payante, ni une publication sociale. GitHub Actions était
bloqué par un verrou de facturation du compte lors de l'observation précédente ;
les contrôles distants devront réellement s'exécuter après le déblocage.
