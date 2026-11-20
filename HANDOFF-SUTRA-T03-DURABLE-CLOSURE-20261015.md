# T03 → T01 — clôture durable après intégration

**PASS LOCAL, zéro défaut produit démontré restant sur les parcours contrôlés.** Branche `codex/sutra-t03-durable-closure-20261015`, base T01 `56754679abed9aa1e51323c29aed5bef38bc17d0` / produit `d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2`. SHA de livraison = commit contenant ce handoff, publié dans le miroir `.coord/handoffs/SUTRA-20261012/T03-FINAL-DURABLE-20261015.md` de la racine coordination. Commit local seulement.

Les trois corrections produit du lot `ee3f7017da762c72163440706064ad08df84f761` sont intégrées à l'identique. T01 a déjà porté le SQL et corrigé les fixtures. Aucun nouveau patch produit ni doublon de migration dans cette livraison. Fichiers nouveaux : `qa/t03-durable-closure-20261015/**`, ce handoff ; append T03 seulement dans BATON/task_plan. T04/T05/T06 et WIP T01 préservés.

**Tests : 29 distincts PASS / 0 FAIL restant / 0 SKIP** : 10 nouveaux tests SQL/reprise et 19 retests des fixtures T01 effectivement intégrées. Rouge initial conservé (27/29, deux assertions du nouveau banc corrigées), rejeu des seuls 10 affectés PASS. TypeScript/lint ciblés PASS. Deux clusters arrêtés, quatre bases privées à `reserved=0`, aucune réservation synthétique ouverte. Ni fournisseur ni réseau externe.

**Migration à retenir :** `migrations/20261015_final_durable_integrity.sql` (déjà intégrée), SHA-256 `e8befa9e9fa602d80c483245bc71d07831fe56aad9ee05ed83dc2261a1d7805c`. Six fonctions ; preuve de passage direct v11 et double rejeu, comparaison au chemin historique, aucun changement de données. Pas de nouvelle migration à appliquer, pas d'application de production T03.

Commandes reproductibles après delta pertinent :

```sh
node qa/t03-durable-closure-20261015/run.mjs all
./node_modules/.bin/tsc -p qa/t03-durable-closure-20261015/tsconfig.json
./node_modules/.bin/eslint qa/t03-durable-closure-20261015/postgres.test.mts qa/t03-durable-closure-20261015/run.mjs qa/t03-durable-closure-20261015/settle.mjs --max-warnings 0
```

Les commandes réellement exécutées, preuves, transitions finales et risques figurent dans [README](qa/t03-durable-closure-20261015/README.md). `run.mjs new` limite au nouveau banc, `integrated` aux 19 tests existants. Les retests post-intégration des corrections produit sont déjà réalisés sur la base T01 confirmée ; ce nouveau commit est seulement QA/docs. Ne pas rejouer des gates globales inchangées ni importer aveuglément BATON/task_plan.

`queued → processing → done/failed/queued/reconciliation_required`, annulation atomique vers `cancelled`. Lease expiré : nouveau propriétaire unique. Incertain : conserver acquis/budget, réconcilier avant soumission. Aucun `ready` sans reçus de média/pistes valides. `compositing_failed` refusé, `failed` canonique conserve les acquis. Publication par compte reste T06.

**FAIL : aucun restant démontré. BLOQUÉ T03 local : aucun. NON TESTÉ :** DB/stockage/fournisseurs réels, GPU, publication, production ; validation physique média T05. ACK T08/release et adoption de ces nouvelles preuves restent à T01, sans accord inventé. Aucune garantie « zéro bug ». GitNexus couverture tronquée/exhaustivité UNKNOWN ; lot borné par diff QA/docs. Claims T03 à clôturer après commit dans les deux LOCKS, aucune interruption d'autre terminal.
