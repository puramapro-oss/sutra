# T05 — validation média finale sur f36013a

**PASS sur le candidat T01 exact `f36013ae8b3bd7d9a702f7aebfdff1ac430c05f5`.** Branche isolée `codex/sutra-t05-final-f360-20261016`. Aucun nouveau défaut produit reproduit, aucun fichier produit modifié. Ce verdict est borné aux contrôles ci-dessous ; il ne certifie ni la production ni l'absence de tout bug.

## Intégration et delta

SHA reçu dans le handoff T01 du 15 octobre à21:25UTC, confirmé T08 à21:30UTC. Le checkout isolé part exactement de ce commit, sans WIP T01.

`integration.json` vérifie les octets auteur/candidat/T05/disque T01 pour **82/82 fichiers T05-FINAL-MEDIA** (`44cbbab40e20f65d0506c18af253218055884c46`). Les **40 fichiers propres de `bb9157597712106c97fa2f85ce7511313c9fe051`** sont intégrés sans changement ; ses deux append BATON/task_plan sont exclus explicitement. Les **37 MP4 historiques sont préservés, sans régénération locale**. Sur28producteurs/fixtures/dépendances suivis, seul `src/lib/shotstack.ts` a changé : T01 a corrigé l'annulation pendant la lecture du corps GET. Le code vidéo de T03 reste en lecture seule ; la régression stock sans fallback intégrée par T01 est couverte par ses gates et les contre-épreuves T08, sans duplication ici.

## Tests exécutés et preuves réutilisées

| Preuve | Résultat | Risque couvert |
|---|---|---|
| Local media |5 PASS,0 FAIL,0 SKIP|Trois vrais exports4K complets, six éléments obligatoires absents, quatre médias invalides/expirés, échec des deux moteurs|
| Local ready |8 PASS,0 FAIL,0 SKIP|Musique indépendante, voix/musique requises absentes, montage/validation/checkpoint en échec, URL brute ancienne refusée|
| Local concurrency |2 PASS,0 FAIL,0 SKIP|Concurrence et libération du slot FFmpeg|
| Local Shotstack |2 PASS,0 FAIL,0 SKIP|GET annulé avant fin du corps refusé ; POST simulé annulé conserve l'ID tardif sans succès ni resoumission|
| Local TypeScript / ESLint |PASS|Harnais et dépendances importées / sources QA locales|
| CI exacte retained-real-exports |49 PASS|Variantes, mesures, native4K synthétique distincte de l'upscale|
| CI exacte composition-delta |12 PASS|64combinaisons présence/required/optional/disabled, pistes Shotstack simulées, sous-titres et formats|
| CI exacte final-media |32 PASS|17exports CPU ; formats/presets, variantes, MIME faux, durées, corruption, pistes requises et ressources|
| CI exacte salad-media / local-engine / compositor |25 /3 /31 PASS|Contrat worker simulé, moteur local, probe et validation|

Les six groupes CI média sont tous à0FAIL/0SKIP et se recouvrent : **ne pas additionner leurs compteurs**. Ils proviennent exclusivement du run **38809803219 sur f36013a**, déjà téléchargé par T01. Hash de chaque log vérifié contre le reçu T01, et17MP4 CI comparés à leur SHA-256 mesuré. `ci-reused.json` conserve commandes, durée, source et provenance ; `ci/media-ci.json` conserve les mesures. Les binaires CI ne sont pas recopiés. Ce lot ne prétend pas que le workflow global navigateur est vert : cette gate reste suivie par T01/T08.

Les assertions locales du montage sont identiques à celles déjà intégrées ; seul le dossier de sortie change, vérifié par `reconcile.py`. Les helpers et fixtures opérationnels sont importés directement. Les tests ready exécutent les vraies fonctions avec ports synthétiques de fournisseur/persistance : ils ne prouvent pas une écriture PostgreSQL de production.

## Mesures des trois nouveaux fichiers

| Format demandé | Dimensions finales mesurées | Orientation | Bitrate conteneur |
|---|---|---|---|
|16:9 4K|3840×2160|paysage|301180bit/s|
|9:16 4K|2160×3840|portrait|289045bit/s|
|1:1 4K|2160×2160|carré|255855bit/s|

Chaque fichier : **1,6s,48images,30FPS,H.264/yuv420p,AAC48kHz stéréo,SAR1:1,rotation0,décodage intégral PASS**. Écarts début et fin audio/vidéo **0ms**. `measurements.csv` détaille les bitrates audio/vidéo, tailles, orientations et SHA-256 ; `measurements.json` conserve les probes et contrôles PCM/pixels.

Deux scènes noir/vert, intro rouge0,2s, outro bleu0,2s, voix440Hz, musique880Hz, logo et sous-titre requis. Les quatre fenêtres temporelles sont contrôlées par pixels ; la présence et le placement des deux tonalités sont mesurés sur PCM. Les trois aperçus ont été affichés et inspectés : court «SUTRA» lisible, sans coupe ni chevauchement du logo synthétique (`visual-review.json`). Sous-titres incrustés, aucune piste texte séparée attendue. Cela ne qualifie pas tous les textes longs/multilingues ou une synchronisation labiale humaine.

Provenance mesurée : **native160×90 → source/améliorée320×180 → rendu demandé4K → dimensions finales ci-dessus : upscale**. Aucune génération IA native4K. Le preset carré4K est2160×2160. La CI exacte couvre720p/1080p/4K dans les trois formats, vidéo seule, musique seule, voix seule, les deux pistes, sous-titres, branding, tout facultatif et facultatif absent. Sa source native4K synthétique est une preuve distincte, pas une attestation de fournisseur IA.

Les six éléments obligatoires absents refusent avant upload. Les médias tronqués/corrompus et URL expirées sont rejetés. Les tests MIME/durée CI sont PASS. Échec des deux moteurs ou validation échouée : pas d'export brut accepté, pas de sauvegarde ready. La CI vérifie aussi qu'un fallback même validé ne peut pas renvoyer l'URL source brute.

## Ressources et limites

CPU libx264 seulement, wrapper refusant les encodeurs GPU ; réseau externe fermé et transport synthétique. Configuration allowlistée et factice, aucun secret/.env lu. Un job FFmpeg à la fois. Budget du runner240s ; groupe média **15,81s réelles,15,63s utilisateur,5,19s système, RSS maximum2903703552octets (~2,70Gio),0swap**. Cette observation n'est pas une limite RAM/CPU dure de production.

Les tests CI exacts couvrent attente dans le budget, annulation du téléchargement bloqué, timeout FFmpeg/probe avec arrêt des enfants, découverte encodeur bornée, budgets/durées invalides, slots libérés et nettoyage après reprise. Aucun temporaire média `sutra-*` restant localement ; caches Node/tsx propres conservés et ignorés. MP4/PNG de preuve conservés. Aucun nettoyage tiers, installation ou build global local.

**FAIL nouveau : aucun. BLOQUÉ dans le périmètre local T05 : aucun. NON TESTÉ : rendus fournisseurs payants, upload distant, production/OVH, parcours réel navigateur→API→base→fournisseur, charge/OOM/plafond dur CPU/RAM, lip-sync humain et génération IA native4K.** Aucune autorisation de déploiement, aucun push/fusion. T01 seul intègre ; T08 reçoit ces preuves pour son verdict distinct.

## Commandes

```sh
node qa/t05-final-f360-20261016/run.mjs media ready concurrency shotstack typecheck lint
python3 qa/t05-final-f360-20261016/reconcile.py
```

Le rapprochement exige les artefacts f36013a déjà téléchargés dans le worktree T01 et échoue sur divergence de source/hash/résultat. Les dépendances existantes sont liées localement, package/lockfile inchangés. Ne pas régénérer les37exports historiques ni relancer les gates globales inchangées.

Contrôle précommit GitNexus, diff et scan expurgé : voir `closing.json` et `gitnexus-*.txt`. Le graphe est partiel ; aucune certification exhaustive n'est déduite d'un nombre de flux nul. Aucun symbole produit n'a été édité.
