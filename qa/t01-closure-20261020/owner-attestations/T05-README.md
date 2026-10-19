# ACK propriétaire T05 — clôture du candidat 79cd

Candidat exact : **79cd95bfdb3e5837e2a78e45efaea444cb8dcf8a**. Branche de preuve : `codex/sutra-t05-closure-79cd-20261020`. ACK limité à la composition et aux médias synthétiques décrits ici ; il ne constitue ni une certification globale, ni une validation de production.

## Décision et fraîcheur

**PASS média borné. Aucun nouveau défaut produit reproduit et aucun fichier produit modifié.** T01 demande personnellement un ACK par rapprochement des producteurs/dépendances et de la CI exacte, sans refaire les exports invariants (`T01-ACK-REQUESTS-20261020.json`, entrée T05). Le candidat T01 et ses fichiers média sont comparés au disque et aux blobs Git ; les changements depuis ab935 concernent les autres propriétaires, notamment Coverr/stock, sécurité et interface sociale. `env.ts` ajoute seulement l'exigence de clé Coverr ; `scripts/run-ci.mjs` ajoute des tests propriétaires sans changer les groupes médias. Aucune modification de moteur, composition, probe, export, orchestration ou dépendance média.

La commande fraîche `python3 qa/t05-closure-79cd-20261020/reconcile.py` vérifie :

- 82/82 fichiers T05-FINAL-MEDIA intégrés ; les lots conservés bb9157 (40 fichiers hors journaux) et 7c6cd5 (41) identiques ; 42 producteurs/fixtures/tests/dépendances invariants.
- 37 MP4 historiques conservés ; manifeste des 45 fichiers de la livraison propriétaire b183606 intact, dont mesures, tests, sorties et deux transitions.
- Octets, tailles et SHA256 des 17 MP4 CPU mesurés sur ab935 et des deux transitions inchangés. Les mesures de décodage/PCM/pixels précédentes restent **réutilisées**, sans les présenter comme un nouveau décodage sur79cd.
- Reçus T01 de la CI **39328438907**, head exact79cd, SUCCESS. Six groupes médias PASS, zéro fail/cancel/skip : real-export49, composition12, final-media32, worker25, local-engine3, compositor31. Les groupes se recouvrent : ne pas les additionner.

Les reçus CI sont copiés avec leur empreinte et leur source dans `reconciliation.json`. Il s'agit des reçus sauvegardés par T01, sans nouvelle interrogation distante. Les commandes exactes, durées et comptes de chaque groupe sont conservés dans `T01-CI-79CD-CONTRACT-MEDIA-20261019.json`. Le groupe final-media exécute les 17 exports CPU du candidat. Les fichiers physiques mesurés et rapprochés ici sont ceux conservés d'ab935, pas des téléchargements des artefacts79cd. Cette distinction est volontaire.

**Zéro nouveau rendu, zéro répétition locale des suites inchangées, zéro build global.** Les tests TypeScript/lint/build du candidat sont ceux de la CI exacte SUCCESS ; le nouveau lot est un script Python de rapprochement et des preuves/documentation. Sa syntaxe est vérifiée par `ast.parse` et son exécution complète doit réussir avant commit.

## Mesures conservées et contrôlées

`measurements-reused.csv` est la copie exacte des 17 lignes mesurées ; `reconciliation.json` inclut les empreintes vérifiées et les sondes réutilisées. Les mesures PCM, pixels et provenance détaillées restent dans le commit propriétaire **b18360607df42fee24c048d554054681199a720d**, dossier `qa/t05-ack-ab935-20261019/` ; aucune duplication des MP4.

| Format | 720p mesuré | 1080p mesuré | Export 4K demandé/mesuré |
|---|---|---|---|
|16:9|1280×720|1920×1080|3840×2160|
|9:16|720×1280|1080×1920|2160×3840|
|1:1|720×720|1080×1080|2160×2160|

H.264/yuv420p,30FPS,SAR1:1,rotation0,AAC48kHz stéréo. Les multi-scènes et branding durent1,6s/48images ; les variantes sans intro/outro1,2s/36images. Débit conteneur mesuré44680–300255bit/s pour ces contenus synthétiques. Décodage intégral17/17 et écarts début/fin audio-vidéo0ms. Aucune conclusion de qualité perceptuelle d'un film réel à ces débits.

**Native synthétique160×90 → source/améliorée320×180 → rendu/fichier final aux dimensions du tableau : UPSCALE. Aucune génération IA native4K démontrée.** La provenance inconnue, la déclaration native fausse et l'attestation native synthétique sont couvertes par les contrats CI.

Vidéo seule, musique seule, voix seule, voix+musique, sous-titres, logo/intro/outro, scènes multiples et facultatifs présents/absents sont couverts. La vidéo seule contient une AAC silencieuse ; silence mesuré. Voix440Hz et musique880Hz vérifiées indépendamment, fenêtres audio calées sur l'intro et la durée. Les cues, couleurs de scènes/intro/outro et logo ont été mesurés en pixels. Les trois images4K avaient été affichées et le texte «SUTRA» jugé lisible dans l'ACK b183606 ; aucune nouvelle validation visuelle revendiquée. Les deux exports de transitions prouvent un fondu au noir0,3s par segment et une coupe en mode none ; les segments≤0,6s restent des coupes, ce n'est pas une transition avec chevauchement.

## Refus, interruptions, reprise et ressources

La CI exacte maintient les refus des six éléments obligatoires absents, fichiers manquants/invalides/tronqués/corrompus, URLs403/410, MIME faux, durée/FPS/SAR/dimensions/audio/synchronisation invalides et preuves falsifiées. Les deux moteurs en échec, une URL brute identique ou les mêmes octets derrière une autre URL ne produisent pas de résultat final validé. Les garde-fous AUTO/EXPORT contre ready anticipé et URL finale invalide sont invariants ; leurs huit assertions locales précédentes PASS sont conservées, en complément des tests de contrats du candidat. Ports fournisseurs et stockage simulés.

Les tests resource/failures de `scripts/test-t05-final-media.mts`, PASS dans le groupe final-media32, couvrent : transfert atomique de slot, attente annulée, budget global pendant queue/téléchargement/découverte encodeur, enfants FFmpeg/probe réellement tués au timeout, budget/durée excessifs refusés avant travail, checkpoint propre conservé après échec puis supprimé après reprise réussie, absence de fallback après annulation/timeout et nettoyage du répertoire possédé. Ces preuves sont inchangées ; aucun média utilisateur ni temporaire appartenant à un autre terminal n'a été supprimé.

Les rendus CPU précédents étaient limités à un job, avec budget240s du runner et30s par transition. RSS local précédent477790208octets, zéro swap, aucun temporaire média restant dans son TMPDIR réservé. **Ce n'est ni un plafond RAM de production, ni une mesure de réencodage4K sous charge.** Le présent rapprochement ne lance aucun FFmpeg et ne crée aucun média temporaire. Pas de qualification d'une purge des checkpoints abandonnés, d'OOM ou de limites du conteneur en production.

Le futur worker WanGP doit réutiliser le contrat d'ingestion existant (octets/base64 canonique ou URL autorisée, provenance mesurée, validation réelle), puis composition→validation finale→export/checkpoint. Le routage local actuel utilise Salad ; WanGP et son adaptateur ne sont pas déjà qualifiés par ce test. Aucun second pipeline ajouté.

## Statuts et livraison

**PASS** : rapprochement propriétaire, intégration des corrections média, CI exacte et preuves synthétiques décrites. **FAIL nouveau produit** : aucun reproduit. **BLOQUÉ hors T05** : R107 reste T03 ; disponibilité OVH, intégration/release restent T01/T08. **NON TESTÉ** : rendus fournisseurs payants/Shotstack live, génération GPU ou IA native4K, WanGP réel, upload distant, production, lipsync humain, textes arbitraires/multilingues, charge/OOM et purge de checkpoints abandonnés.

GitNexus est exécuté dans le worktree isolé avec `analyze --index-only --skip-fts`, sans modifier AGENTS/CLAUDE ni installer de modèle. FTS omis explicitement après l'échec connu du précédent index ; graphe partiel, aucune certification exhaustive. Sorties index/detect_changes et contrôle final dans ce dossier. Aucun symbole produit édité ; pas d'analyse d'impact de modification produit applicable. `detect_changes` est requis et exécuté avant commit.

Index : 25 700 nœuds, 50 487 liens, 494 flux ; 1 369 entrées et 871 callees omis, 41 parcours limités par budget. Le contrôle du lot indique risque **LOW**, 27 symboles et zéro flux affecté signalé ; la liste affichée est abrégée. La comparaison avec `main` indique **CRITICAL**, 5 510 fichiers, 12 415 symboles et 397 flux, avec liste plafonnée : c'est l'historique d'intégration, pas le diff de ce lot. Aucun de ces résultats ne donne une garantie exhaustive. Le diff Git borné et les empreintes complètent le contrôle.

L'ACK vaut **uniquement pour79cd95bfdb3e5837e2a78e45efaea444cb8dcf8a**. Un futur candidat contenant une correction T03/T04 nécessite un rapprochement de son delta ; cet ACK ne l'anticipe pas. Handoff personnel remis à T01 et T08, sans fusion, push ni déploiement.
