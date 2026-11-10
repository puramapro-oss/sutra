# Publication sociale durable — preuve locale du candidat

Le candidat part de `257b1bbeabc995a15cf7ffd85f75e44a16ab201c`, sans réécrire les corrections analytics/CI de cette base. Le contrat et le raccord de déploiement sont décrits dans [la documentation multicomptes](../../docs/SUTRA_MULTI_ACCOUNT_20261110.md#reprise-durable-du-lot--candidat-suivant-la-réconciliation-analytics).

| Contrôle | Résultat local |
| --- | --- |
| Cœur, API, worker et régressions sociales | **PASS : 134 tests, zéro échec, zéro skip**, un passage combiné après les corrections |
| Migration, admission concurrente, baux, droits et redémarrage PostgreSQL 16.15 | **PASS : 66 contrôles, 302 assertions**, zéro échec/skip, cluster privé arrêté |
| Dispatcher local HTTP et refus des destinations/redirections | **PASS : cinq tests Python** |
| Lint des fichiers modifiés | **PASS**, contrôles ciblés par périmètre |
| Typecheck, lint et build globaux locaux | **NON QUALIFIÉS** : processus interrompus par SIGKILL, dont le worker de build Next |
| Parcours Chromium locaux | **PARTIEL** : conserver les passages et les arrêts du navigateur dans `ui/` ; aucun PASS global déduit des groupes précédant un crash |
| Installation standard locale | **PARTIEL** : `npm ci` interrompu ; archives exactes du lock et paquet SMARANA vérifiés, `npm rebuild` PASS |
| Déploiement, migration distante, timer actif, réseaux réels | **NON TESTÉS** |

[RECEIPT.json](./RECEIPT.json) contient les commandes, statuts et empreintes des entrées. [postgres.json](./postgres.json) détaille chaque contrôle natif. [behavior-tests.log](./behavior-tests.log) conserve le passage combiné. Les détails de restauration des dépendances sont dans [runtime.json](./runtime.json).

## Défauts reproduits avant correction

La revue native a démontré que l'ancienne version du nouveau RPC acceptait des preuves d'exécution à l'admission, des formes invalides de résultats et des modifications d'identité d'un succès. Les contre-tests correspondants passent sur la migration finale. Le reçu antérieur est conservé à titre de preuve de reproduction, sans être présenté comme le résultat courant.

Une autre revue a reproduit un réveil perdu après le commit du claim d'une reprise : `retrying` pouvait conserver l'ancien `failed`. Le modèle, le worker et le reçu public conservent désormais l'incertitude et la réconciliation, sans second ordre de reprise. Les tests combinés incluent la perte de réponse après ce commit réel simulé, la visibilité d'un ordre de reprise en file et le blocage d'un ancien journal sans identifiant de post.

Les profils CI existants exécutent les nouveaux tests. La preuve distante doit être consultée sur l'exécution correspondant exactement à la tête de la PR ; un résultat de la base ou d'un autre commit ne qualifie pas ce candidat.

## Correction après la première CI distante

Le premier run de la [PR n° 13](https://github.com/puramapro-oss/sutra/pull/13), [42911370235](https://github.com/puramapro-oss/sutra/actions/runs/42911370235), porte sur `cf0e71c5e95f97600e6d86445d2c88cb0c53ee53`. Il a validé les bases natives et le lint, puis révélé douze diagnostics TypeScript et quatre attentes périmées dans le parcours T08. Ce run reste un échec, sans être confondu avec celui de la correction suivante.

Les assertions du test durable réduisent maintenant réellement l'union des résultats. Le hook relit la visibilité du document après l'attente réseau. Le parcours T08 utilise les vraies routes d'admission, de worker et de lecture ; seuls les RPC de stockage et les fournisseurs sont simulés. Ses contrôles conservent l'absence d'envoi avant admission, la reprise d'une publication partielle et l'absence de doublon lors de douze clics simultanés.

Le passage combiné après correction contient **147 tests réussis, zéro échec et zéro skip**, dont les treize parcours T08. [followup-tests.log](./followup-tests.log) et [FOLLOWUP.json](./FOLLOWUP.json) contiennent cette preuve et les empreintes des quatre fichiers corrigés. Les reçus précédents restent les instantanés des entrées qu'ils identifient. La qualification TypeScript, build et navigateur complète de la nouvelle tête est portée par son propre run GitHub Actions.
