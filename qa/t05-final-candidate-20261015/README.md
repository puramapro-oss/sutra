# T05 — preuve média du candidat final T01

**PASS local et CI média sur `cb3f893c35599a6c9c50a4d23c82013c10c5f3ae`.**
Branche `codex/sutra-t05-final-candidate-20261015`, parent exact du même SHA. Aucun nouveau défaut produit reproduit, aucun fichier produit modifié. Le verdict concerne les scénarios indiqués, sans garantie d'absence de tout bug.

## Intégration contrôlée

`integration.json` compare les octets auteur, candidat, checkout T05 et disque T01 : **82/82 fichiers FINAL-MEDIA44cbbab identiques**. Les trois journaux partagés BATON/task_plan/ERRORS sont exclus explicitement des85fichiers auteur. Les30fichiers propres du lot précédent `f0bb470` sont également intégrés à l'identique.28producteurs, fixtures et fichiers de dépendances restent inchangés.37exports historiques sont préservés ; T05 ne les a pas régénérés.

Le SHA final a été annoncé par T01 à19:56UTC, confirmé à20:14UTC et accepté comme base par T08. Le checkout contient ce SHA, pas les modifications locales de T01. Les preuves CI proviennent du run **38797929920** sur ce SHA, téléchargées une seule fois par T01. Elles ne proviennent pas de l'ancien bilan `d21b7b4`.

## Tests et frontières de preuve

| Exécution | Résultat | Couverture |
|---|---|---|
| Locale `media` |5 PASS,0 FAIL,0 SKIP|3montages CPU4K complets ; six éléments requis absents, quatre entrées invalides/expirées, deux moteurs en échec|
| Locale `ready` |8 PASS,0 FAIL,0 SKIP|Vraies fonctions AUTO/EXPORT avec ports synthétiques : musique sans voix, voix/musique requises absentes, erreur composition, validation refusée, ancien checkpoint brut, échec de sauvegarde après rendu|
| Locale `concurrency` |2 PASS,0 FAIL,0 SKIP|Concurrence et libération du slot|
| CI retained-real-exports |49 PASS|Variantes et formats, mesures réelles, source native4K synthétique distincte de l'upscale|
| CI composition-delta |12 PASS|64combinaisons required/optional/disabled, contrat Shotstack simulé, trois formats et sous-titres, native/upscale|
| CI final-media |32 PASS|17exports CPU :9formats/presets et8variantes ; budgets, décodage, MIME, durées, corruption, timeout, absence de piste requise|
| CI salad-media / local-engine / compositor |25 /3 /31 PASS|Contrat worker simulé, moteur local et validation fichiers|

Tous les groupes CI média sont à0FAIL/0SKIP. Les groupes se recouvrent : **ne pas additionner leurs nombres comme des tests distincts**. `ci-reused.json` conserve commandes, temps, hashes des logs et reçu source. `ci/media-ci.json` conserve les17mesures CI dont chaque SHA-256 a été rapproché du MP4 téléchargé. Les MP4 CI ne sont pas dupliqués dans ce lot.

Le test local est celui du candidat `qa/t05-integrated-retest-20261015/retest.mts`, avec pour seule adaptation le dossier de sortie ; cette identité est vérifiée par `reconcile.py`. Les helpers opérationnels sont importés directement. TypeScript et ESLint ciblés PASS. Aucun build global ni régénération locale des54exports de la CI exacte.

## Fichiers réellement exportés ici

| Format demandé | Dimensions finales mesurées | Orientation | Bitrate conteneur |
|---|---|---|---|
|16:9 4K|3840×2160|paysage|301180bit/s|
|9:16 4K|2160×3840|portrait|289045bit/s|
|1:1 4K|2160×2160|carré|255855bit/s|

Chaque export :1,6s,48images,30FPS,H.264/yuv420p,AAC48kHz stéréo,SAR1:1,rotation0, décodage intégral PASS. Écart début et fin audio/vidéo mesuré0ms. Les bitrates reflètent des aplats synthétiques, pas une qualification perceptuelle de contenu réel. Détails et hashes dans `measurements.csv`/`measurements.json`.

Deux scènes noir/vert, intro rouge0,2s, outro bleu0,2s, voix440Hz, musique880Hz, sous-titre et logo requis. Pixels vérifiés aux quatre fenêtres temporelles ; PCM vérifié pour la présence et la synchronisation des deux fréquences. Les trois PNG ont été affichés : court sous-titre «SUTRA» lisible, sans coupe ni chevauchement du logo synthétique. Sous-titres incrustés, aucune piste texte séparée attendue.

Provenance : **native160×90 → source/améliorée320×180 → rendu demandé4K → dimensions finales mesurées ci-dessus : upscale**. Aucune génération IA native4K. Le preset carré4K produit2160×2160, pas3840×3840. Les exports720p/1080p et le contrôle natif4K synthétique sont exécutés dans la CI exacte et identifiés dans ses logs.

Les six exigences manquantes refusent avant upload. Échec des deux moteurs : erreur propagée, aucune URL finale brute. Les tests ready vérifient l'absence de checkpoint saved et/ou d'URL finale après erreur, mais utilisent un port de persistance synthétique : ils ne certifient pas une écriture PostgreSQL de production. Orchestration T03 inchangée.

## Ressources, sécurité et limites

CPU libx264 uniquement ; wrapper refuse les encodeurs GPU, réseau fermé par `qa/t08/offline.cjs` et transport de fixtures. Configuration synthétique allowlistée, aucun secret/.env lu. Budget du runner240s ; groupe média14,48s réelles,15,78s utilisateur,5,11s système, RSS max2903670784octets (~2,70Gio), zéro swap. Concurrence applicative1 ; cette mesure ne représente pas un plafond dur de RAM en production.

CI exacte : file d'attente dans le budget global, téléchargement bloqué annulé, découverte encodeur bornée, FFmpeg/probe tués au timeout, budgets/durées excessifs refusés, checkpoint d'échec conservé puis supprimé après reprise réussie. Après les tests locaux, aucun temporaire média `sutra-*` restant ; caches Node/tsx propres conservés et ignorés. Les preuves MP4/PNG sont conservées. Aucune suppression d'artefact tiers.

**FAIL nouveau : aucun. BLOQUÉ T05 local : aucun. NON TESTÉ : rendus fournisseurs payants, upload distant, production/OVH, parcours navigateur→API→base→résultat fournisseur réel, charge/OOM et plafond CPU/RAM dur, synchronisation labiale humaine, textes longs/multilingues et génération IA native4K.** Les limites de production restent à qualifier par T01 ; ce lot ne constitue pas une autorisation de déploiement.

## Reproduction

```sh
node qa/t05-final-candidate-20261015/run.mjs media ready concurrency typecheck lint
python3 qa/t05-final-candidate-20261015/reconcile.py
```

La deuxième commande attend les artefacts CI exacts dans le worktree T01 ; elle échoue si un hash/source/résultat diffère. Ne pas la remplacer par des preuves d'un autre candidat. Le dossier temporaire est propre à ce lot. Les dépendances installées sont réutilisées par lien local, avec package/lockfile inchangés ; aucune installation supplémentaire.

GitNexus et contrôle final sont consignés dans `gitnexus-*.txt` et `closing.json`. Aucun symbole produit édité ; le graphe n'est pas présenté comme une certification exhaustive. Handoff destiné à **T01 et T08**, commit local seulement, aucune fusion/push/publication/production.

Contrôle final : scan gitleaks staged expurgé PASS, diff-check PASS, AST Python PASS. GitNexus delta39fichiers/55symboles/0flux rapporté LOW ; comparaison main4389fichiers/10583symboles/234flux CRITICAL, liste plafonnée malgré limite20000. Index exact mais processus partiels (1305points d’entrée exclus,705appels omis,3parcours bornés) ; zéro flux rapporté ne signifie pas zéro impact possible. Aucun fichier produit modifié.
