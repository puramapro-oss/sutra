# T08 → T01 — recette indépendante du parcours intégré

Branche : `codex/sutra-t08-integration-journey-20261014`.
Worktree : `/Users/matissdornier/purama-worktrees/sutra-t08-integration-journey-20261014`.
Base exacte : `b7cf848d07fca2734db36a2e30d045ca312a3162` ; produit `d8691d8ac6cf885f8e5522f361f45ebe229ec20d`.
SHA de livraison : communiqué après commit local dans le miroir `.coord/handoffs/SUTRA-20261012/T08-INTEGRATION-JOURNEY-20261014.md` du dépôt coordinateur.

Livré : `scripts/test-t08-integration-journey.mts`, `qa/t08-integration-journey-20261014/**`, ce handoff et append BATON/task_plan du seul worktree. Aucun produit/API/config/SQL modifié, aucun changement des tests unitaires propriétaires. Scope réservé dans les deux LOCKS avant édition.

Résultat : **13/13 nouveaux scénarios PASS, 0 FAIL/SKIP ; TypeScript ciblé et ESLint ciblé PASS, zéro warning lint.** Commande exacte :

```sh
/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node qa/t08-integration-journey-20261014/run.mjs
```

Parcours réel des modules create → quota/queue/worker → génération simulée → reprise/checkpoints → montage/contrat → validation simulée → export → calendrier → publication simulée. Polling client/status réel. Ports session/DB/médias/transport externes remplacés ; aucune revendication E2E navigateur ou PostgreSQL pour ce harnais. Double clic création/publication : douze requêtes chacun, une seule intention. Échec quota/DB/upload/validation, résultat perdu, média modifié et publication partielle couverts. Sessions étrangères et mode propriétaire désactivé refusés avant effets.

Défaut corrigé T08 : sérialisation JSON manquante dans la nouvelle fixture RPC ; cause/reproduction/correction dans README. Aucun nouveau défaut produit démontré par ces scénarios.

Matrice finale **47 exigences : 31 PASS, 4 FAIL, 3 BLOQUÉ, 9 NON TESTÉ** dans `qa/t08-integration-journey-20261014/MATRIX.md` et `matrix.json`. Les quatre FAIL sont des signalements propriétaires récents sur b7cf848 : sécurité stockage/preuve T02, reprise Suno T03/T04, révocation concurrente OAuth T06, pagination/contraste UI T07. Ils ne sont pas effacés par les PASS anciens ou le harnais T08. Sources figées dans `owner-observations.json`. Corrections WIP non intégrées ; retest final dépend du candidat T01.

`provenance.json` : aucun delta source/config/package entre produit et base ; 873 hashes du manifeste T01 identiques ; 802 fichiers figés dans `tested-source.json`. CI d8691d8 réutilisée sans relance, première erreur média/timeout navigateur conservés par T01. GitNexus index propre, impact fixture LOW/un appelant/zéro processus après indexation ; première analyse avant index UNKNOWN signalée. Analyse staged avant commit et scan secrets expurgé conservés dans le dossier QA.

GitNexus staged : HIGH/dix flux sur `rpc`/`ok`/`failure` des nouvelles fixtures, avertissement communiqué. Contexte borné/tronqué (trois récepteurs non résolus) et associations de noms avec des routes non modifiées ; inspection directe confirme zéro import produit de la fixture et zéro fichier produit modifié. Risque graphe conservé, pas d'exhaustivité revendiquée. Gitleaks staged expurgé PASS.

T01 : plan exact de recette du **prochain SHA intégré** dans `SMOKE-T01.md`. Ajouter la commande à votre campagne si nécessaire ; `run-ci.mjs` demeure votre propriété. La nouvelle reprise Suno doit être qualifiée sur ses ports réels T03/T04 avant toute conclusion de reprise complète. Ne pas relancer maintenant une gate globale de la base inchangée.

Limites : aucun login/consentement OAuth réel, génération/rendu vidéo/export vidéo réel, GPU, publication réelle, charge distante, alertes bout en bout. T01 constate absence cron/worker autonomes ; planification autonome non prouvée/non activée. Aucun secret réel lu/copié, aucun réseau fournisseur, calcul IA Mac, achat, push, merge, migration, déploiement ou changement de production. T01 conserve intégration et production autorisée ; worktrees/WIP tiers préservés.
