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
