> État intégré courant : [matrice T01](../release-20261012/MATRIX.md). Les résultats ci-dessous décrivent la livraison T08 sur sa base ; les nouvelles exécutions T01 sont conservées séparément.

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
node qa/t08/run.mjs browser-redteam
node qa/t08/run.mjs legacy-offline
python3 -m unittest discover -s deploy -p 'test_ovh.py'
```

Intégration T01 finale : Space Grotesk est embarquée avec sa licence et sa provenance dans `src/app/fonts`, via `next/font/local`. Toutes les gates construisent hors réseau sans cache de police ni variable `T08_FONT_CACHE`. Les rapports T08 antérieurs restent historiques et leur échec Google Fonts n'est pas réécrit. FFmpeg doit fournir les filtres `subtitles` et `drawtext` ; le binaire Homebrew minimal de cette machine ne les fournit pas.

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
