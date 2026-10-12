# SUTRA T08 — recette intégrée du 2026-10-12

Base exacte : `589732cb49959c1a576a3ba381b310cd594600ac`.
Branche : `codex/sutra-t08-qa-integrated-20261012`.
Le handoff courant et `integrated/MATRIX.md` distinguent PASS, FAIL, BLOQUE et NON TESTE.
Les fichiers `*.s5-source*` et `evidence/` sont historiques S5 ; leurs résultats ne sont jamais additionnés à cette recette.

## Reproduction gratuite

Utiliser Node 24, les dépendances du lockfile intégré et un Chromium déjà installé.
Le checkout doit être isolé et sans fichier d'environnement. Aucune installation automatique.

```sh
node qa/t08/run.mjs redteam
node qa/t08/run.mjs contracts
PATH="/chemin/vers/ffmpeg-complet:$PATH" node qa/t08/run.mjs media
node qa/t08/run.mjs quality
T08_FONT_CACHE=/chemin/vers/build-existant/.next/static node qa/t08/run.mjs browser-redteam
T08_FONT_CACHE=/chemin/vers/build-existant/.next/static node qa/t08/run.mjs legacy-offline
python3 -m unittest discover -s deploy -p 'test_ovh.py'
```

La gate `quality` canonique tente de télécharger Space Grotesk si son cache est absent et échoue sous la garde réseau. `browser-redteam` et `legacy-offline` exécutent chacun un build webpack avec les vrais octets WOFF2 d'un cache local, via le hook de test Next. `build-offline` permet cette seule vérification si nécessaire. Le chemin du cache, les hashes des trois polices et les versions sont consignés dans les preuves ; cela ne certifie pas un build distant sans cache. FFmpeg doit fournir les filtres `subtitles` et `drawtext` ; le binaire Homebrew minimal de cette machine ne les fournit pas.

Le runner refuse les arguments supplémentaires pour éviter tout filtre silencieusement ignoré. Un test rouge retourne un code non nul ; aucune attente de régression n'est inversée pour obtenir du vert.

## Frontières

- Environnement fils sur liste autorisée, identifiants synthétiques, blocage réseau Node hors loopback. Le navigateur bloque les origines externes et remplace les mutations API par des fixtures. La garde n'est pas une sandbox OS générale ; les exécutables sont les outils locaux inspectés.
- `offline.test.mjs` exécute la vraie garde dans une VM avec I/O inertes : y compris URLs de fichiers encodées. Aucun fichier secret réel n'est ouvert.
- `load.test.mts` exécute les vraies fonctions de checkpoints/publication avec persistance en mémoire : 8 workers, 32 séquences/288 étapes, 32 journaux/64 destinations. Ni charge SQL ni débit fournisseur.
- `browser-extension.mjs` réutilise le harnais T01/T07 sans modifier le produit : XSS, export 503, retry 202, timeout, double clic dans la même frame, axe à 320px. Auth et DB simulées ; les contrats backend sont une preuve distincte. Ce n'est pas un parcours continu sur DB réelle.
- Médias : décodage/FFmpeg locaux réels sur fixtures synthétiques, fournisseurs simulés. Aucun achat, publication sociale, migration ou déploiement.
- Les preuves SQL T01 réutilisées portent sur des sources hashées inchangées, sans rejouer les migrations. Schéma distant et RLS en production non qualifiés.
- Axe et mesures Chromium locales ne valent ni audit WCAG complet, ni lecteur d'écran, ni Core Web Vitals de production.

Les rapports bruts courants restent dans `test-results/`. Leurs copies texte/JSON livrées sont dans `integrated/evidence/`, avec les échecs diagnostiques conservés. Les preuves de la base T01 restent sous `qa/integration-20261012/`.
