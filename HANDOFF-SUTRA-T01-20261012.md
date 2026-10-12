# SUTRA T01 CHEF — intégration finale, 2026-10-12

Branche unique `codex/sutra-t01-integration-20261012`, worktree `/Users/matissdornier/purama-worktrees/sutra-t01-integration-20261012`. Le commit contenant ce handoff est la livraison intégrée ; `qa/integration-20261012/verification.json` lie les fichiers exécutables à leurs SHA-256. Les preuves T01 antérieures (`19ea35f`, `21363e0`) restent historiques.

**INTEGRATION_LOCALE — RELEASE_NON_CERTIFIEE.** Commit et push de cette seule branche autorisés par le dernier mandat utilisateur. Aucun déploiement, migration distante, paiement, publication réelle ou appel fournisseur payant effectué. `vercel.json` désactive explicitement le déploiement Git de cette seule branche T01 pour éviter un preview involontaire au push ([contrat Vercel](https://vercel.com/docs/project-configuration/git-configuration)). Les workflows locaux ne déploient pas cette branche ; mobile se limite à main.

## Préservation et collecte

AGENTS, politique canonique (`POLICY_OK`), les deux LOCKS, handoffs, branches/worktrees, processus visibles et modifications locales inspectés avant écriture. Réservation `SUTRA-T01-20261012:FINAL-INTEGRATION` dans les deux LOCKS. Livraison des huit propriétaires recensée dans [MATRIX.md](qa/integration-20261012/MATRIX.md), avec SHA exacts, conflits, décisions et disposition des 46 cas T08 historiques.

48 worktrees présents inspectés, dont T01 ; les 47 worktrees étrangers conservent HEAD, état Git et hashes du WIP suivi (`preservation-final.json`). Une entrée worktree prunable `/private/tmp/r2_sutra_claude_fix` est absente du disque, donc non inspectable, et a été conservée. Aucun reset/stash/clean, suppression de worktree ou écrasement de fichiers étrangers. Les six fichiers suivis modifiés du checkout canonique `renfort/r4-sutra-smart-split-double-effects@8ff4fd26` sont inchangés. Les fichiers non suivis étrangers n'ont pas été récupérés.

Références conservées dans l'ascendance :

| Référence | SHA |
| --- | --- |
| main demandé | `35c137fc0bc0bd5ff6e54c3ef44ef8b6e46b2fc5` |
| PR1 | `a322e53d046b02005b3e05b91f42083a5ca20b1e` |
| PR2 | `e1bdd1b5489721aef7b7b8a42e946e2dee1202e8` |
| correctif média | `05d164daafff3502ab764d852742f5e1bf17a8ca` |
| PR3 | `7088a0a3e733de8d2e85f3576bd86627127da369` |

Le nom de branche local `main` pointait déjà sur `a6568e81c108d911ff827756c9b0ab20c9ae1c97` et n'a pas été déplacé. Les branches propriétaires restent intactes. Le cluster PostgreSQL T01 (PID57391, port51269) a été arrêté proprement après les preuves ; aucun processus étranger arrêté. Aucun merge/cherry-pick global de S5.

## Résultat intégré

- CI et dépendances T01 : Node24, ESLint embarqué avec provenance, SMARANA au commit verrouillé, gates isolées, garde SQL loopback, réseau fournisseur bloqué. Audit production : 0 haute/critique, 5 modérées et 2 faibles résiduelles dans la chaîne OpenTimestamps.
- T02/T03 : auth/OAuth/admin, stockage/downloader sécurisés, quota atomique, jobs/claims/checkpoints, statut privé et persistance fail-closed. Les tests PostgreSQL démontrent la concurrence et les transactions ; les doubles de DB sont identifiés séparément.
- T04 : adaptateurs LTX V2 réconciliés avec la persistance PR3. Intention ambiguë sans ID = réconciliation, aucune nouvelle dépense automatique ; ancien fingerprint uniquement pour reprendre un ID existant. JSON fournisseur borné et validation DNS/URL.
- T05 : contrat FFmpeg/Shotstack complet, probe T05 renommé `media-inspection.ts`, correctif `05d164d` conservé dans `media-probe.ts`. Contrat et octets hashés, durée mesurée et provenance vérifiée avant stockage, y compris après reprise ; volume vocal dans les deux moteurs.
- T06 : journal par destination, retry partiel, révocation honnête et CAS des tâches dues ; calendrier PR2 timezone/DST conservé. Les default grants réalistes ont révélé DELETE/TRUNCATE hérités sur le journal : révocation explicite puis droits SELECT/INSERT/UPDATE seulement.
- T07 et raccords : création/production attendent le résultat d'un job 202 ; export de l'éditeur récupère les sources réelles, normalise les volumes et refuse les sources absentes. Boucle de chargement évitée ; libellés, contraste et petits écrans de l'éditeur vérifiés.
- T08 : sources/rapports S5 archivés sans modification ; runner courant pointe vers les gates intégrées. Les 25 PASS/21 FAIL historiques ne sont jamais additionnés aux preuves PR3.

## Tests exacts et preuves

macOS arm64, Node `24.21.0`, npm `11.12.1`, PostgreSQL local `18.4`. La CI prévoit PostgreSQL16 ; cette différence n'est pas présentée comme un test distant. Journaux et résultats dans `qa/integration-20261012/evidence/` ; seuls les espaces de fin de ligne des copies texte sont normalisés. Les rapports sources dans test-results restent intacts.

| Commande exacte (depuis le worktree) | Résultat |
| --- | --- |
| `npm exec --yes --package=node@24 -- node scripts/run-ci.mjs contracts` | 427 PASS, 7 SKIP, 0 FAIL sur 434 ; schedule/composition/publication PASS |
| `PATH="$PWD/test-results/media-bin:$PATH" npm exec --yes --package=node@24 -- node scripts/run-ci.mjs media` | 33 PASS (3 moteur local + 30 composition/décodage/audio/sous-titres), 0 FAIL |
| `npm exec --yes --package=node@24 -- node scripts/run-ci.mjs quality` | typecheck PASS, lint 0 erreur/111 avertissements, build webpack 197 pages PASS |
| `npm exec --yes --package=node@24 -- node scripts/run-ci.mjs browser` | Dernière suite complète : 202 PASS, puis 1 erreur du parseur URL du test serveur ; 155 audits axe sans violation |
| `npm exec --yes --package=node@24 -- node scripts/run-ci.mjs browser-profiles` | 5 PASS après correction URL relative ; agrégat 203 contrôles PASS, aucun échec restant (pas une seconde suite complète) |
| `npm exec --yes --package=node@24 -- node scripts/run-ci.mjs legacy` | Exécution complète : 1013 PASS, 9 FAIL, 25 SKIP sur 1047 ; attentes historiques corrigées ensuite |
| `npm exec --yes --package=node@24 -- node scripts/run-ci.mjs legacy-regressions` | 9 PASS, 0 FAIL après corrections ; agrégat 1022 PASS/25 SKIP, aucun échec restant, pas une seconde exécution complète |
| `SUTRA_DISPOSABLE_DB=1 DATABASE_URL_LOCAL=postgres://matissdornier@127.0.0.1:51269/sutra_ci_t01 npm exec --yes --package=node@24 -- node scripts/test-migration-local.mjs` | 13 contrôles PASS sur cluster local jetable |
| `SUTRA_DISPOSABLE_DB=1 PGHOST=127.0.0.1 PGPORT=51269 npm exec --yes --package=node@24 -- node --import tsx --test scripts/test-pipeline-postgres.mts` | 9 PASS, concurrence réelle multi-sessions |
| `npm exec --yes --package=node@24 -- node scripts/test-security-rls.mjs` | 49 assertions PASS, cluster privé local, droits réels et rejeu migrations |
| `python3 -m unittest discover -s deploy -p 'test_*.py'` | 9 PASS sans SSH/Docker |
| `actionlint .github/workflows/web-ci.yml` et `shellcheck tooling/git-askpass.sh` | PASS |
| `npm audit --omit=dev --audit-level=high` | PASS seuil high ; 5 modérées/2 faibles conservées |
| `./node_modules/.bin/eslint scripts/test-ui-isolated.mjs scripts/run-ci.mjs` | PASS après séparation des pannes serveur/client du test profil, seuls deltas JS après la gate qualité |

Le binaire média utilisé est un lien local en lecture vers `/Users/matissdornier/purama/sutra/.worktrees/sutra-t05-media-export-20261012/node_modules/ffmpeg-static/ffmpeg` ; aucune dépendance étrangère modifiée. La CI Linux installe FFmpeg et DejaVu. Les images editor-a11y-320 et editor-export-1280 ont été affichées pour contrôle visuel ; le média factice ne prouve pas une lecture fournisseur réelle.

Les trois corrections des attentes legacy : accent de « Rester connecté », cron sans secret refuse 401/503 (ne doit plus attendre un 200), redirection SQL malformée inspectée sans la suivre hors du serveur isolé. Les 25 exclusions restent nommées dans la matrice.

Deux exécutions navigateur ont passé 201 contrôles et 155 audits axe sans violation, puis échoué sur le scénario de profil. Porter le délai de 5s à 20s n'a pas résolu la cause : la fixture mettait en panne la vérification de droits serveur T02 et redirigeait vers login avant l'écran T07. Le harnais distingue maintenant la lecture complète du profil client (erreur visible, rechargement fonctionnel) de la vérification serveur (redirection 307 vers login avec retour settings). Aucun assouplissement du code produit. Les deux échecs diagnostiques restent archivés `browser-before-deadline.*` et `browser-before-profile-split.*`. La suite suivante passe 202 contrôles et 155 audits axe, puis le nouveau contrôle serveur échoue uniquement car `Location` est relatif. Après correction `new URL(location, base)`, la reprise ciblée `browser-profiles` passe ses 5 contrôles (dont refus serveur et récupération client). Union des cas : 203 PASS, 0 erreur navigateur, 0 violation axe ; preuve `evidence/browser-aggregate.json`. Le troisième échec et les commandes restent archivés, sans faux PASS de suite complète.

## GitNexus

Impacts exécutés avant modifications (213 cibles initiales, dont 41 HIGH/27 CRITICAL signalées, puis impacts ciblés des raccords). `check` du harnais navigateur : 4 dépendants directs, LOW connu. Graphe limité : risque UNKNOWN lorsque symboles non résolus ; ce n'est pas une absence de risque.

Index final propre T01 : 12701 nœuds, 24670 relations, 266 clusters, 369 flux. **TRUNCATED** : 929 candidats d'entrée, 519 callees, 4 walks coupés ; pas de certification exhaustive. `detect-changes --scope staged --repo sutra-t01-20261012 --limit 3000` exécuté avant commit : 281 fichiers préparés, 1770 symboles, 123 flux, risque CRITICAL. La sortie CLI reste limitée à 15 symboles/10 flux malgré la limite demandée, donc ne constitue pas un inventaire exhaustif. Résultat archivé. Revue directe des chemins et tests complètent le graphe.

## Limites réelles et prochaine étape

- Approbation budgétaire hybride, gestion/restauration de versions et logger de S5 ne sont pas présents dans la base PR3 retenue ; ils ne sont pas déclarés livrés. Le bouton de restauration indique honnêtement son indisponibilité. Modifier le script de l'éditeur ne régénère pas la voix.
- Les 7 SKIP contrats : 4 INSEE live, 2 DB distante, 1 OTS réseau. `test-connect.mjs` et `test-storage-video-proofs.mjs` exigent des secrets et mutent des services réels, donc non exécutés. Les wrappers T06 déjà inclus ne sont pas comptés deux fois.
- Docker absent localement : image Linux, santé OVH et rollback réel non exécutés. Aucun appel GPU/Stripe/social/stockage de production. Schéma distant et compatibilité de ses données inconnus, migrations non appliquées.
- La CI distante nécessite `SMARANA_READ_TOKEN`, absent de la liste des secrets du dépôt au contrôle final (noms seuls consultés) ; aucune valeur de secret lue. Son résultat doit être suivi après push ; les preuves locales ne garantissent pas son passage.

Recette exacte et rollback : [deploy/README.md](deploy/README.md). Utiliser le SHA40 final poussé ; `--schema-ready` confirme une revue et une vérification séparées du schéma distant. Snapshot Compose/runtime protégé contre l'écrasement, restauration suivie d'une attente healthy ; aucune annulation SQL automatique. **Ne pas déployer dans cette session.**

## Contrôle après premier push

Commit intégré initial `0e7575ed6aca39c930671d5e56fc0b0654c5b82b` poussé et SHA distant confirmé. [CI 38289108161](https://github.com/puramapro-oss/sutra/actions/runs/38289108161) : contrats/qualité arrêtés dans setup sur `SMARANA_READ_TOKEN` manquant ; aucun test distant exécuté. Le conteneur PostgreSQL échoue séparément avec `unknown shorthand flag: U` : les apostrophes du healthcheck sont traitées comme arguments littéraux par le runner. Correction de configuration : guillemets doubles autour de la commande `pg_isready`, puis `actionlint` PASS. Aucune source produit modifiée, preuves locales conservées ; SHA-256 du workflow actualisé. Le commit contenant ce complément est le commit final ; son nouveau run doit encore confirmer le démarrage du conteneur, puis restera bloqué par le credential privé absent.
