# ACK T05 — candidat exact ab935 — 19 octobre 2026

**PASS média local/CI sur `ab935e59ca4e39776630f05b2ba6c0422c74ec62`.** Aucun nouveau défaut produit reproduit, aucune modification produit. Cet ACK ne vaut ni acceptation globale T08, ni qualification d'un autre SHA, ni preuve de fonctionnement d'un fournisseur ou de production.

Branche isolée `codex/sutra-t05-ack-ab935-20261019`. Claim `SUTRA-T05-20261019:ACK-AB935` inscrit avant écriture dans les deux LOCKS canoniques. AGENTS, politique, CLAUDE, handoffs et candidat T01 lus ; policy-check canonique POLICY_OK. WIP T01/T03 et autres terminaux préservés. Aucune installation, lecture de secret, copie de `.env`, publication, fusion, push ou déploiement.

## Intégration et choix des contrôles

`integration.json` compare les blobs auteur/candidat/disque : **82/82 fichiers T05-FINAL-MEDIA** de `44cbbab40e20f65d0506c18af253218055884c46`, **40 fichiers** du lot `bb9157597712106c97fa2f85ce7511313c9fe051`, **41 fichiers hors journaux** de `7c6cd5524778e2441d801c9fc78655f2e4081de3`. **37 exports historiques préservés**, zéro rerendu. Les 42 producteurs, fixtures, tests et manifestes de dépendances contrôlés sont identiques au précédent candidat `f36013ae8b3bd7d9a702f7aebfdff1ac430c05f5`.

Le reçu CI sauvegardé `ci/receipt.json` atteste le run [38827288351](https://github.com/puramapro-oss/sutra/actions/runs/38827288351), terminé success au SHA exact ; source locale et SHA256 du reçu dans `ci-reused.json`. Les six groupes médias sont PASS, sans skip : real-export49, composition12, final-media32, worker25, local-engine3, compositor31. Ils se recouvrent : ne pas les additionner. Il s'agit de preuves CI conservées et vérifiées, sans interrogation distante fraîche.

Les **17 exports CPU CI** ont leurs octets/tailles/empreintes rapprochés, puis ont été redécodés intégralement par le `probeMedia` du candidat. Les mesures fraîches concordent exactement avec celles de la CI. Leurs producteurs inchangés ne justifient pas un nouveau rendu des mêmes 17 fichiers. Les assertions PCM/pixels ont en revanche été rejouées sur ces MP4. Un angle non couvert par les anciens tests — effet visuel du fondu — justifie deux petits rendus supplémentaires `exports/fade.mp4` et `exports/none.mp4`, sans remplacer ni modifier les preuves anciennes.

## Résultats mesurés

`measurements.csv` contient les 17 mesures et empreintes ; `measurements.json` les sondes, fréquences PCM, pixels et transitions. `verification.json` rassemble les comptes, ressources et limites.

| Format | 720p | 1080p | 4K demandé et mesuré |
|---|---|---|---|
|16:9|1280×720|1920×1080|3840×2160|
|9:16|720×1280|1080×1920|2160×3840|
|1:1|720×720|1080×1080|2160×2160|

Les neuf multi-scènes durent1,6s/48images ; les variantes sans intro/outro1,2s/36images. H.264/yuv420p,30FPS,SAR1:1,rotation0,AAC48kHz stéréo. Bitrate conteneur réel44680–300255bit/s selon le contenu synthétique ; aucune conclusion de qualité perceptuelle d'une vidéo réelle à ce débit. Décodage complet et métadonnées PASS17/17 ; écart début/fin audio-vidéo **0ms**.

Native synthétique160×90 → source/améliorée320×180 → dimensions finales ci-dessus : **upscale**. Les trois fichiers «4K» sont des exports aux dimensions demandées, pas une génération native4K. Les tests CI conservent les cas origine inconnue, attestation native synthétique et déclaration native contredite par la mesure. Aucune génération IA native4K testée.

Vidéo seule, musique seule, voix seule, voix+musique, sous-titres seuls, logo+intro+outro, tous facultatifs présents/absents : mesures PCM et pixels fraîches PASS. La vidéo seule contient une piste AAC silencieuse ; absence de contenu audible vérifiée, indépendamment de la présence de cette piste. La voix440Hz attend la fin de l'intro et s'arrête après sa durée ; musique880Hz vérifiée indépendamment. La synchronisation démontrée est celle des horloges/fenêtres synthétiques, pas une synchronisation labiale humaine.

Intro rouge, scènes noir/vert, outro bleu et logo sont observés aux instants attendus. Sous-titres incrustés : zéro piste externe attendu ; apparition/disparition dans les cues vérifiée. Les trois PNG4K extraits ont été affichés : «SUTRA» lisible, ni coupé ni superposé au logo. Textes longs/multilingues non qualifiés.

Transitions : deux scènes rouge/bleu de0,8s, export720p de1,6s/48images. `fade` produit noir aux débuts, intensité intermédiaire pendant les fondus et pleine couleur au centre ; `none` conserve la pleine couleur jusqu'à la coupe. Mesures RGB exactes enregistrées. Le comportement implémenté est un fondu au noir de0,3s par segment, pas un fondu enchaîné avec chevauchement. Les segments courts≤0,6s gardent volontairement une coupe. Deux uploads vers fichiers locaux, zéro secours fournisseur, aucun octet brut livré.

## Refus, reprise et ressources

Preuves CI exactes réutilisées : six éléments obligatoires manquants, fichiers invalides/tronqués/corrompus en fin de flux, URL403/410, MIME faux, durée finale fausse, SAR/FPS/dimensions incorrects, audio requis absent, timestamps décalés, preuve hasAudio falsifiée. Chaque cas refuse la livraison ; deux moteurs en échec, même URL brute ou mêmes octets derrière une autre URL ne deviennent pas un export validé. Détails `ci/salad-media.log`, `ci/final-media.log` et `ci/media-ci.json`.

Huit contrôles AUTO/EXPORT frais PASS sur la logique intégrée : voix/musique obligatoires absentes bloquent ready, échec de montage propagé, résultat cloud non vérifié refusé, URL finale supprimée après validation échouée, ancien checkpoint brut à réconcilier, reçu distant conservé après échec de checkpoint. Ports fournisseurs/persistance simulés ; aucun fichier orchestrateur T03 modifié.

Preuves CI des interruptions : slot transféré sans dépassement, waiter annulé, deadline de téléchargement/queue/découverte encodeur, sous-processus réellement tués au timeout, budgets/durées refusés avant travail, checkpoint conservé après échec puis nettoyé après retry réussi, aucun secours après annulation/timeout. Aucun nouveau passage de ces suites inchangées.

Exécution fraîche CPU/libx264, un job à la fois, runner240s, signal30s pour chaque petit export de transition. Groupe média15,58s ; RSS macOS maximal477790208octets, zéro swap. **Ce RSS n'est pas une limite dure mémoire de production ni une mesure de réencodage4K.** Aucun temporaire média `sutra-*` restant dans le TMPDIR réservé. Exports et preuves conservés ; caches Node exclus, aucun nettoyage tiers. Charge/OOM, limites du conteneur de production et purge de checkpoints abandonnés non qualifiées.

## WanGP : réutilisation conditionnelle du contrat existant

`src/lib/local-engine.ts::generateLocalVideo` accepte un POST JSON `{prompt,width,height,num_frames,fps}` et une réponse contenant exactement un `video_base64` canonique ou un `video_url` de même origine, sans redirection ; limite64MiB et deadlines existantes. Les octets passent `verifyVideoBytes` : taille, durée, FPS, pixels carrés, orientation et décodage réel. Ce résultat est une **source**, jamais un reçu ready. Le routage personnel actuel passe par `generateSaladVideo` ; ce contrôle ne prétend pas que WanGP est déjà branché ni que son API native expose ce contrat.

Tout futur worker WanGP doit fournir/adapter ce contrat côté propriétaire T04/T01, transporter la provenance native/améliorée sans l'inventer et fournir une durée/URL utilisable. Ensuite `composeVideoWithFallback` → `mediaValidation` → export/checkpoint existants portent composition, audio, branding et validation, sans second pipeline. Les25tests worker du SHA exact démontrent ce contrat avec des octets synthétiques, dont URL expirée/corruption/absence d'audio et faux résultat brut. **WanGP réel et adaptateur réel NON TESTÉS** ; leur qualification par T04/T01 reste nécessaire avant activation. Aucun code WanGP dupliqué ou GPU lancé.

## Commandes et statuts

```sh
python3 qa/t05-ack-ab935-20261019/reconcile.py
node qa/t05-ack-ab935-20261019/run.mjs typecheck lint media ready
```

Le runner applique l'environnement synthétique allowlisté, le preload réseau fermé et le wrapper CPU existants. Python syntaxe PASS ; TypeScript/lint ciblés PASS ; **18 tests médias +8 tests ready =26 PASS,0 FAIL,0 SKIP**. Deux tentatives TypeScript initiales du nouveau harnais sont conservées (`typecheck-initial.txt`, `typecheck-second.txt`) : types Buffer/clip/job corrigés avant les tests, aucun défaut produit. Pas de build global inchangé relancé.

GitNexus : index du candidat puis du dossier QA, requêtes/contexte et detect_changes avant commit. Le graphe est partiel (496 flux, 1365 entrées et 872 callees omis) : absence de flux ne vaut pas absence de chemin. `detect-changes --scope all --repo . --limit 20000` retourne CRITICAL : les flux applicatifs cités sont attribués au nouveau helper Python `digest`, sans import produit vers ce dossier QA. Cela suggère une association par homonymie ; la sortie ne permet pas une certification exhaustive. La comparaison avec `main` couvre 5120 fichiers historiques et reste tronquée, elle ne représente pas ce lot.

L'indexation finale du graphe termine mais l'index FTS `Property.property_fts` échoue sur «Invalid UTF-8» ; une tentative `--repair-fts` échoue aussi. Recherche textuelle GitNexus dégradée, sans nouvelle boucle de reconstruction. **Limite outillage BLOQUÉE**, explicitement séparée des tests média PASS. Aucun symbole produit édité ; le diff borné aux nouveaux tests/preuves et aux ajouts de journaux, l'absence d'import produit et le rapprochement des blobs sont vérifiés directement. Reçus complets dans les fichiers `gitnexus-*` et `closing.json`.

**PASS** : périmètre média synthétique décrit. **FAIL produit nouveau** : aucun reproduit. **BLOQUÉ** : aucune dépendance pour clôturer ce lot T05 ; l'acceptation globale et les défauts signalés par les autres terminaux restent du ressort T01/T08. **NON TESTÉ** : rendus Shotstack/autres fournisseurs payants, WanGP réel, upload distant, runtime/production E2E, IA native4K, charge/OOM, sous-titres arbitraires et lipsync humain. Cet ACK ne contourne aucun NACK d'un autre propriétaire.
