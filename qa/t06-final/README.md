# T06 — preuves de reprise sur 589732c

Toutes les sources testées appartiennent au seul worktree T06 `sutra-t06-social-autonomy-20261012`, branche `codex/sutra-t06-social-final-20261012`. La base est `589732cb49959c1a576a3ba381b310cd594600ac`. `verification.json` lie les commandes, résultats, fichiers et dépendances au commit de code.

## Exécution gratuite et isolée

Node24 déjà installé : `/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node` (v24.21.0). Next16.3.8 et TypeScript5.9.3 réutilisés en lecture seule depuis les dépendances T01. Aucune installation. `scripts/run-ci.mjs` construit un environnement neuf à partir de PATH/HOME/TMP seulement, ajoute des identifiants de fixtures et charge `qa/t08/offline.cjs` : lecture des `.env*` et réseau non-loopback refusés. Les navigateurs emploient un faux service Supabase local et un proxy bloquant les destinations externes. Les médias sont synthétiques.

Commandes exécutées avec ce Node24 :

```text
node scripts/run-ci.mjs contracts
node scripts/run-ci.mjs quality
node scripts/run-ci.mjs media
node scripts/run-ci.mjs browser
node scripts/run-ci.mjs legacy
python3 -m unittest discover -s deploy -p 'test_*.py'
```

Le premier profil média échoue sur 6 des 30 tests du compositeur : `/opt/homebrew/bin/ffmpeg` ne dispose pas de `drawtext`. Le moteur local avait passé ses 3 tests. Seul le compositeur a été repris, avec les mêmes fixtures et préchargement offline, en préfixant PATH par `/Users/matissdornier/purama/sutra/.worktrees/sutra-t05-media-export-20261012/node_modules/ffmpeg-static`. Aucun fichier T05 modifié. Arguments exacts et binaire : `evidence/media-compositor-static-results.json`. Cette reprise passe 30/30 ; ne pas lire `media-initial-results.json` comme une suite entièrement verte.

`red-autonomy.log` démontre 30 anciens tests PASS et 21 nouveaux FAIL sur le code intégré avant correction. La première reprise corrigée passait 49/51, les deux échecs restants étant une attente du test (`AUTHORIZED`) différente du code canonique de refus `SUTRA_DESTINATION_REVOKED`. L'assertion a été corrigée, sans changer le produit pour satisfaire le test. La gate complète finale passe les 51 tests T06, inclus dans les 448 PASS contrats ; ces nombres ne s'additionnent pas.

`browser-checks.json` contient la suite complète actuelle : 203 contrôles et 155 audits axe, aucune violation ni erreur navigateur. Les captures générées restent sous test-results et n'ont pas été utilisées pour revendiquer une validation visuelle humaine. Les preuves browser/legacy ne démontrent aucun fournisseur réel.

Les copies texte des journaux normalisent uniquement les espaces finaux. Les originaux restent dans `test-results/ci/` ; l'échec initial média et le RED sont conservés séparément. La suite legacy possède sa propre commande et son propre résultat, sans agrégation avec des preuves historiques.

## GitNexus

Avant édition, les impacts upstream de `runPublicationJournal` (HIGH, 7 éléments, 2 appelants directs `publishAutoVideoRecord`/`publishVideoRecord`, flux cron/publication/autopilot) et `socialDatabase` (LOW, 6 éléments, 4 appelants directs de tests) ont été exécutés avec le runner racine sur le dépôt indexé `sutra-t01-20261012`. Le risque HIGH a été annoncé avant édition.

Avant commit : `detect_changes({repo: "sutra-t01-20261012", scope: "staged", worktree: "/Users/matissdornier/purama-worktrees/sutra-t06-social-autonomy-20261012"})` appelé via `LocalBackend.callTool`. L'argument worktree est validé par le backend contre le dépôt commun ; aucun diff du worktree T01 n'est substitué au diff T06. Résultat : 4 fichiers, 14 symboles, 11 flux, HIGH, sur les consommateurs attendus. Sortie complète : `evidence/gitnexus-detect.json`.

L'index T01 reste TRUNCATED (929 candidats d'entrée, 519 callees, 4 walks coupés), deux commits de retard signalés au moment de l'analyse. Aucune reconstruction partagée et aucune certification exhaustive déduite. Revue directe du diff et contrats servent de preuves locales complémentaires.

## Preuves conservées sans rejeu

Les migrations, scripts SQL, verrou de dépendances et workflows n'ont pas changé. Les preuves PostgreSQL13+9+49, audit dépendances et actionlint de T01 restent consultables sous `qa/integration-20261012/` ; elles ne sont pas comptées comme de nouvelles exécutions T06. Aucun SQL distant, secret, `test-connect.mjs` ou `test-storage-video-proofs.mjs` exécuté. Les 7 SKIP contrats sont 4 INSEE live, 2 DB distante, 1 OTS réseau.
