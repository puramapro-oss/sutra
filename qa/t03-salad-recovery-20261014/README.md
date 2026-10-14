# T03 — reprise worker distant, 14 octobre 2026

Mission distincte Matiss 01h40. Tests et preuves uniquement, produit integralement en lecture seule.

- Branche : `codex/sutra-t03-salad-recovery-20261014`.
- Base exacte : `14617333bfb21efe1f2a1c91888d3322dde20f5b`, applicatif `e3b17117256269e281304cd4ab83bc722a6f7894`.
- Handoff coordinateur : `/Users/matissdornier/purama/.coord/handoffs/SUTRA-20261012/T03-SALAD-RECOVERY-20261014.md`.
- Aucun merge, push, deploiement, migration, publication, secret lu/copie, appel reseau ou calcul media/GPU. Aucun test global/build rejoue. T01 conserve config/OVH/Zernio/integration ; T04 conserve le produit Salad.

## Resultats et portee

| Verification nouvelle | Resultat | Ce qui est effectivement exerce |
|---|---|---|
| `scripts/test-t03-salad-recovery.mts` | 16/16 PASS | Vrais `runVideoJob`, pipeline production, moteur synchrone, heartbeat/checkpoint/claim/finish. HTTP et DB simules. |
| `adapter-recovery.test.mts` | 9/9 PASS provisoires sur WIP T04 | Vrais `createSaladClient` ET `createSaladWorker`, charges directement en lecture seule, sans copie/reimplementation. Bridge de calcul et journaux injectes factices. |
| TypeScript cible | PASS | Tests T03 et imports statiques produit, declaration OpenTimestamps canonique incluse. Le chargement dynamique T04 ne remplace pas son propre typecheck. |
| ESLint cible | PASS, 0 avertissement | Deux nouveaux fichiers de tests et garde hors reseau. |

Les 16 cas de base couvrent timeout apres soumission, interruption distante, reponse asynchrone202 incompatible avec le moteur historique, douze reprises par cas sans deuxieme POST, expiration entre heartbeat et intention, perte d accuse APRES ecriture, ancien worker encore en vol, 24 claimants concurrents, recus DB false/null/chaine/503, reprise des checkpoints scene/images/resultat/evenement sans perdre voix/musique/sous-titres/publication et refus d ownership.

Les neuf cas T04 croisent client et worker reels : POST accepte dont la reponse se perd, reconstruction puis douze GET sur le meme ID ; intention non ecrite ou ecrite sans accuse ; accuse CAS perdu ; reservation distante ecrite sans accuse donc aucun calcul ; ancien owner refuse apres expiration ; etat UNKNOWN gardant le slot apres deadline/reconstruction ; 24 clients concurrents ne provoquant qu une soumission et un calcul simule ; changement d entree sur meme operation refuse.

Dans le cas d une **autre** operation bloquee par le slot UNKNOWN, deux POST distincts sont observes mais le second recoit409 et aucun deuxieme calcul ne commence. Aucun scenario ne fait un appel a RunPod/LTX/Shotstack/Suno/Pexels, au stockage distant ou a la publication. Les tests echouent meme si une tentative HTTP inattendue est avalee par le produit.

## Limites precises

1. Le RPC et les journaux sont des **doubles de fautes et de recus**, pas une implementation SQL ni une preuve du verrou global en production. Les preuves PostgreSQL preexistantes ne sont pas rejouees ni etendues artificiellement a Salad.
2. Sur base1461733, le POST personnel est synchrone : une reponse202 avec `job_id` ne conserve pas cet ID. L intention scene empeche toute seconde soumission, mais la reprise se bloque en `SUTRA_RECONCILIATION_REQUIRED`. Ne pas connecter un endpoint asynchrone a ce chemin historique. T04 est l owner du raccord correct ; T03 ne le duplique pas.
3. Le complement T04 a ete execute sur ses fichiers WIP, stables pendant le test mais non committes. `adapter-result.json` fixe chaque empreinte et le HEAD constate. Ce PASS ne vaut pas acceptation d une future livraison differente ni integration. Verifier le delta sur le SHA T04 final et rejouer seulement si les sources testees changent.
4. Les ports durables `submission-intent` / `exclusive-execution`, le fencing reel, le slot partage et leur raccord a la file restent a qualifier par T04/T01. Aucun test ne certifie un worker Salad actif, une qualification GPU, un rendu, un media final ou un `ready` de bout en bout.
5. Aucune ancienne panne OAuth/Suno/RunPod/Shotstack n est reprise comme blocage actuel. Preuves T01 `qa/ovh-final-providers-20261014/README.md` et verification utilisateur01h26 font foi ; aucun probe live duplique.

## Reproduction gratuite

Depuis le worktree T03 :

```sh
python3 qa/t03-salad-recovery-20261014/verify.py recovery
python3 qa/t03-salad-recovery-20261014/verify.py typecheck lint
T03_SALAD_SOURCE=/chemin/vers/worktree-T04 python3 qa/t03-salad-recovery-20261014/verify.py adapter
```

Le runner recree un environnement minimal synthetique et charge `offline.cjs` : lecture `.env*` interdite, tous sockets interdits, tous processus de generation interdits. Seul le service esbuild deja installe est autorise pour transpiler les tests. Les reponses `ffmpeg/ffprobe -version` sont fictives ; aucun binaire media n est lance. Les cles factices ne sont pas des identifiants fournisseurs. Le test adapter utilise un transport injecte reliant directement le vrai client au vrai handler du worker.

Dependances reutilisees par lien vers le `node_modules` existant apres egalite du lockfile, aucune installation. Les journaux `.log` sont expurges et retenus explicitement avec les JSON de resultats. L avertissement Node connu `javascript-opentimestamps` concerne son champ main ; il ne constitue ni echec de test ni validation du fournisseur.

## GitNexus et controle du scope

Impact avant ecriture : `runVideoJob` CRITICAL (5 appelants directs/5 flux) ; `pipelineSteps` CRITICAL (8 directs/5 flux) ; `createLtxClient` LOW. Index `sutra-final-providers-20261013` en retard sur48f2d5e : navigation seulement, non certification exhaustive. Aucun de ces symboles produit n a ete edite. `detect-changes --scope staged` a ete execute avant commit : exit1, nouveau worktree absent du registre GitNexus. Qualification graphe UNKNOWN, jamais PASS. Le resultat expurge est conserve dans `gitnexus.json` ; la verification directe du diff et des 715 fichiers produit est dans `source-integrity.json`.

Le scope final doit rester exclusivement `scripts/test-t03-salad-recovery.mts` et ce dossier QA. Aucun `src/`, migration, configuration applicative, fichier de dependencies, BATON partage ni WIP tiers ne doit apparaitre dans le commit T03.
