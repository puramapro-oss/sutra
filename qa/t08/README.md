> **Intégration T01 (2026-10-12)** : le document ci-dessous et `evidence/` décrivent exclusivement la source S5 du propriétaire. Le runner original est conservé dans `run.mjs.s5-source`. Le nouveau `run.mjs` lance les gates PR3 réconciliées (`contracts`, `media`, `quality`, `browser`, `legacy`). Les anciennes commandes `auth`, `server`, `lint`, `typecheck` ci-dessous ne s’appliquent pas au nouveau runner. La correspondance des cas et les limites sont dans `qa/integration-20261012/MATRIX.md`. **25 PASS/21 FAIL historiques ne sont pas des résultats du HEAD intégré.**

# SUTRA T08 — QA locale, base S5 uniquement

Base produit : `6a64fba103a084c71ecbfd1a07af53076af097c6`. Ces tests nouveaux exposent des défauts : **un exit 1 est attendu sur cette base, ce n'est pas un PASS**. Ils ne qualifient ni PR3 `7088a0a`, ni les WIP T02–T07, ni une release déployée.

## Exécution

Depuis ce worktree, avec ses dépendances disponibles :

```sh
node qa/t08/run.mjs contracts
node qa/t08/run.mjs contracts --test-name-pattern=T08-16
node qa/t08/run.mjs lint
node qa/t08/run.mjs typecheck
```

Navigateur : vérifier que les ports 19834 et 19835 sont libres, puis dans deux terminaux dédiés :

```sh
node qa/t08/run.mjs auth
node qa/t08/run.mjs server
```

Puis `node qa/t08/run.mjs browser`. Le runner utilise uniquement `127.0.0.1:19835`, jamais le `playwright.config.ts` racine. Pour réutiliser un Chromium déjà installé, fournir son exécutable via `T08_CHROMIUM=/chemin/absolu node qa/t08/run.mjs browser`. Aucun téléchargement de navigateur n'est nécessaire pour les preuves jointes. Arrêter uniquement les deux processus locaux créés pour ce test.

L'exécution consignée utilise Node 26, Next 16.3.5, React 19.2.4, TypeScript 5.9.3, tsx 4.23.13, Playwright 1.58.2, axe-core 4.11.1 et Chromium headless cache 1217. Le navigateur 1208 attendu par défaut n'était pas installé : première tentative BLOQUE, puis exécution réelle avec 1217. Ce couple n'est pas la matrice officielle Playwright/Chromium et ne prouve pas la compatibilité des navigateurs de production.

## Frontières de preuve

- `run.mjs` transmet une liste explicite de variables synthétiques. Aucune variable fournisseur héritée. `offline.cjs` interdit les connexions Node hors loopback et toute lecture `.env*` par les APIs de fichiers instrumentées. Le navigateur bloque ses requêtes distantes et remplace toutes ses mutations `/api/*` par des fixtures.
- `contracts.test.mts` importe les vrais handlers create/export/validation/config/publication, le vrai pipeline et les fonctions d'approbation. Seuls auth, DB, queue/quota et fournisseurs sont simulés. `infrastructure.test.mts` importe réellement cron-auth, observabilité, calendrier et downloader.
- `FakeDb` modélise PostgREST et deux RPC ; il n'exécute aucun SQL, contrainte unique, RLS, verrou PostgreSQL ou migration. Une course du modèle montre l'absence de protection applicative ; elle ne mesure pas les effets d'une contrainte de DB non testée.
- La charge est bornée à 8 workers, 32 vidéos, 64 publications synthétiques, en mémoire. Elle ne mesure pas le débit de la DB, d'un réseau social ou d'un provider.
- Le parcours est segmenté : création/export standard d'une part, validation/planification/publication `sutra_auto_videos` d'autre part. Aucun raccord durable entre ces deux modèles n'est certifié. L'E2E navigateur vérifie les interactions de l'UI avec des API simulées ; les contrats backend sont une preuve distincte.
- B02 injecte `withinBudget=false` puis `true` pour tester l'état de la gate, avec un plan local synthétique à coût zéro. Aucune tarification ni calcul financier réel n'est certifié.
- T08-39 vérifie le handler authentifié avec `Origin` étranger et JSON sous `text/plain`. Il ne prouve pas qu'un navigateur hostile reçoit les cookies : SameSite, CORS et domaines réels restent NON TESTE.
- T08-40 utilise un watchdog de 50 ms pour montrer que le logger attend une promesse DB sans échéance locale. Ce délai n'est pas un SLA de production.
- Médias et exports sont des fixtures : aucun décodage/FFmpeg, qualité audio/vidéo, licence, objet de stockage réel ou provider n'est certifié.
- Axe couvre trois vues mobiles ; pas de certification WCAG complète. Next est en développement, police Google indisponible sous la garde réseau et police de secours utilisée. Les mesures DOM ne constituent pas des Core Web Vitals de production.

## Preuves

`evidence/contracts-final.tap` conserve les assertions réelles. `evidence/results.json` contient les résultats navigateur, sélecteurs axe, mesures locales et commandes. `evidence/manifest.json` lie les sources produit/test et dépendances utilisées par SHA-256. Les logs détaillés et traces restent dans le worktree sous `evidence/`, ignorés pour éviter un paquet volumineux. Les quatre chiffres PASS/FAIL/BLOQUE/NON TESTE du handoff restent l'autorité de lecture ; aucune assertion connue en échec n'a été transformée en succès attendu.

## Intégration T01

Ne pas cherry-pick aveuglément. Les ajouts sont sous `qa/t08/**`, plus le handoff, BATON et l'append au plan. Revoir les imports et les doublures de contrat sur PR3, puis rejouer les tests touchés sur le HEAD intégré et les dépendances figées de T01. Aucun remplacement de fichier produit S5 dans PR3.
