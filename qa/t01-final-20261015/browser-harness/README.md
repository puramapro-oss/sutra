# T01 — raccord campagne navigateur finale, 2026-10-15

Scope exclusif `SUTRA-T01:FINAL-BROWSER-HARNESS`, apres reception T07 `c72188a221588402498f10248f181cffe32bee1e` sur worktree integration `sutra-final-providers-20261013`, HEAD `49c166d4c15412d2a3c1246c216cf0df319f2df0` avec integration en cours. Aucun fichier produit, secret, configuration OVH, commit ou build complet modifie/execute par cet auxiliaire.

## Commande de campagne a executer par T01/CI

```sh
node qa/t07-final-ux-perf-20261015/run.mjs --final-integrated
```

Un seul appel a `startProductionServer` construit l'application avant les deux moteurs. Dix scenarios par moteur : final, social, planning, legal, journey, private-download, extra, editor, visual, navigation. Etat fixture restaure et contexte navigateur neuf a chaque scenario. La campagne attend vingt entrees de resultat ; erreur de scenario conservee et code de sortie non nul. Sortie distincte `qa/t01-final-20261015/browser-final`, creation exclusive : si ce dossier existe, la commande refuse de l'ecraser. Aucun resultat historique T07 remplace.

La configuration reste synthetique et explicite : service/anon fixture, URLs loopback, identite fixture, hook offline serveur et route navigateur fermant les autres origines. Aucun master, credential ou fichier env lu par cet auxiliaire. Un `.env.local` existe dans le worktree et n'a pas ete ouvert ; la campagne cible est la CI sans ce fichier, et aucun build local n'a ete lance. Les controles rapides ci-dessous n'utilisent ni Next ni dotenv.

## Qualification des diagnostics moteur

`runtime-guard.mjs` conserve toutes les `pageerror` brutes, erreurs DOM/rejections et erreurs d'hydratation. Il observe les vrais `fetch` sans modifier leur resultat, ainsi que le cycle de vie du document. Un diagnostic peut etre qualifie uniquement si :

- le moteur est WebKit et son controle HTML natif courant a reproduit exactement le diagnostic d'un fetch intercepte par `.catch()` pendant `pagehide` ;
- la premiere ligne de stack correspond exactement au diagnostic `Fetch API cannot load ... due to access control checks.` ;
- un `page.goto` ou `page.reload` explicite est en cours ou vient de terminer (borne 1 s) ;
- le document sortant a effectivement commence ce meme fetch pendant son dechargement ; origine source/cible/navigation identique, sans fragment ; seule la query Next `_rsc` unique, alphanumerique/underscore/tiret (1–128 caracteres), est observee avec sa valeur fixture pour une correspondance exacte. Toute autre query reste bloquante ;
- aucune vraie erreur DOM non interceptee n'a ete observee dans cette fenetre.

Toutes les autres erreurs restent bloquantes. `TypeError: Load failed`, CORS externe, navigation cliente, absence de trace, autre moteur, hydratation ou vraie exception ne sont pas exclus. Chaque scenario produit `runtime-errors.json`, plus les listes brutes/inattendues/qualifiees dans `results.json`. Les erreurs attendues des contre-tests restent dans le recu HTML natif et ne sont jamais melangees a la recette produit.

Le clavier est calibre sur HTML minimal avec le meme moteur : `Tab` s'il atteint le bouton, sinon `Alt+Tab`. Un contre-test avec `tabIndex=-1` doit le rendre inaccessible. Sur ce Mac : Chromium Tab ; WebKit Alt+Tab. Aucune assimilation a Safari natif/iOS, aucun OS ou resultat clavier fige pour Linux CI.

## Controles rapides executes — sans build

```sh
node --test qa/t01-final-20261015/browser-harness/guard.test.mjs
node node_modules/eslint/bin/eslint.js qa/t07-final-ux-perf-20261015/run.mjs qa/t07-final-ux-perf-20261015/checks.mjs qa/t07-final-ux-perf-20261015/navigation-checks.mjs qa/t01-final-20261015/browser-harness/*.mjs
node --check qa/t07-final-ux-perf-20261015/run.mjs
node --check qa/t07-final-ux-perf-20261015/checks.mjs
node --check qa/t07-final-ux-perf-20261015/navigation-checks.mjs
```

13 tests PASS / 0 FAIL / 0 SKIP ; lint et syntaxe PASS. Un cas positif strict, dix cas negatifs du classificateur, et controles HTML reels Chromium/WebKit (clavier, fetch pagehide, vraie exception, vraie promesse rejetee). Preuves `targeted-tests.txt`, `results/native-chromium.json`, `results/native-webkit.json`. Premiere execution lint avait signale `console.debug` interdit ; emetteur diagnostique passe a `console.warn`, puis lint et tests rejoues PASS. Aucun contournement de lint.

POLICY_OK depuis racine canonique ; le script lance depuis ce worktree autonome ne trouvait pas les fichiers canoniques, sans modification hors scope. Skill GitNexus impact applique : index du worktree exact `e09fdae`, `runScenario`, `finalChecks`, `navigationChecks` UNKNOWN/absents ; imports et appelants directs confirmes dans `run.mjs`, pas de chemin produit. Detect-changes `--scope all --repo . --limit 10000`, puis `100000` : 36 fichiers/48 symboles/4 flux MEDIUM sur WIP integre tiers. CLI affiche seulement 15 symboles malgre limite ; harnais nouvellement ajoute hors index et non stage. Ces sorties ne certifient ni l'exhaustivite ni les modifications des autres lots. T01 doit analyser le diff stage final avant commit. Aucun index regenere.

## Limite restante

La campagne application complete n'a deliberement pas ete lancee ici. La CI doit valider les vingt scenarios avec le candidat integre. Si un diagnostic ne satisfait pas toutes les conditions, il doit rester rouge et etre examine ; aucune extension automatique du filtre. Safari natif et appareil iOS restent NON TESTES.

## Correction CI48eb91a — rechargements et cache Next

CI38669067659 : vingt groupes fonctionnels executes, cinq gardes WebKit FAIL (social/planning/legal/journey/extra), Chromium PASS. Traces brutes conservees dans ci-48eb91a-quality-artifacts. Deux lacunes prouvees : reload attribue au dernier goto et requetes cache Next _rsc non observees. Aucun fichier produit corrige pour ces diagnostics.

Le harnais observe maintenant les deux operations explicites et leur vrai document sortant. Le fetch original et son resultat/promise restent inchanges : aucun catch ajoute au produit, erreur DOM/rejection toujours bloquante. URL exacte requise, fenetre 1s inchangee ; methode inconnue, query differente, privee ou dupliquee toujours refusee. Metadata query permise uniquement pour le jeton cache synthetique `_rsc`, sans master/header/body.

Contre-preuve HTML sans Next : quatre combinaisons goto/reload x requete simple/_rsc, fetch attrape pendant beforeunload et pagehide ; vraies exceptions/rejections toujours detectees. Nouvelle commande `node --test qa/t01-final-20261015/browser-harness/guard.test.mjs` :22PASS/0FAIL/0SKIP sur Mac. Les recus historiques ne sont pas ecrases ; chaque rejeu cree un dossier distinct. Recette applicative Linux du nouveau SHA encore requise, aucun FAIL historique converti retroactivement en PASS.

Le premier essai natif beforeunload seul ne reproduisait aucun diagnostic sur Mac : qualification des erreurs applicatives aurait donc reste fermee. Le controle conserve maintenant aussi pagehide, comme la preuve initiale. Les deux recus sont gardes ; seuls les nouveaux controles effectivement reproduits autorisent une qualification.

## Correction ciblee CI ed12d9c — fixture cross-origin

CI38671657736 conserve son verdict FAIL : un seul garde social WebKit rouge, dix-neuf groupes verts ; la trace concerne la fixture HTTPS loopback affirmations. Trois reproductions sociales Mac passent sans reproduire le rouge Linux : elles ne prouvent pas sa cause. La reproduction HTML independante a deux ports (`cross-origin-reproduction.mjs`, recus `cross-origin-results-H0aOg2`) reproduit le diagnostic WebKit pour une promesse attrapee pendant teardown.

Le controle natif courant ajoute maintenant une lecture ordinaire reussie et un vrai refus CORS sur exactement la meme URL. Seul un diagnostic effectivement reproduit autorise une qualification cross-origin : origine fixture HTTPS127.0.0.1 explicite avec port, GET, chemin affirmations et query canonique limitee aux trois categories synthetiques, requete exacte observee pendant unload, navigation goto/reload entre pages de la meme origine applicative, fenetre1s et aucune erreur DOM. Autre origine, query, methode, absence de trace ou erreur DOM restent FAIL. Aucun en-tete, corps, master ou credential n'est observe. Aucun catch n'est ajoute aux fetch du produit. Les erreurs brutes sont conservees.

Commande `node --test qa/t01-final-20261015/browser-harness/guard.test.mjs` :45PASS/0FAIL/0SKIP (Mac), preuves `cross-origin-guard-tests.txt` et `cross-origin-guard-results-U1eleM`. Chromium/WebKit detectent le vrai refus CORS ; WebKit reproduit3diagnostics de teardown qualifiables. Lint cible PASS. Le prochain run Linux doit encore valider le candidat ; aucune requalification retroactive de la trace CIed12 et aucune declaration de cause applicative certaine.

GitNexus impact observeRuntimeErrors/classifyRuntimeErrors/nativeRuntimeControls/runScenario : UNKNOWN, symboles absents de l'index ancien. Revue directe : appelants QA uniquement, aucun chemin produit modifie. Detect-changes obligatoire avant commit ; les limites du graphe restent explicites.
