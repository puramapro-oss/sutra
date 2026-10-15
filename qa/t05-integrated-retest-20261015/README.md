# T05 — preuve après intégration, 15 octobre 2026

**PASS : 82/82 fichiers intégrés, cinq tests frais, trois vrais exports CPU, TypeScript et lint ciblés. Aucun écart produit nouveau.**

Lot auteur `44cbbab40e20f65d0506c18af253218055884c46`, candidat T01 testé `d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2`, reçu documentaire et base de ce worktree `56754679abed9aa1e51323c29aed5bef38bc17d0`. Branche locale `codex/sutra-t05-integrated-retest-20261015`.

`integration.json` établit l'égalité des 82 fichiers par SHA-256, du lot auteur au candidat et au disque. Le commit auteur contient 85 fichiers : BATON.md, task_plan.md et ERRORS.md sont les trois journaux partagés exclus volontairement de cette égalité ; T01 a conservé sa propre consolidation. Les producteurs, dépendances déclarées et fixtures sont inchangés. Les 82 empreintes ont également été contrôlées après le test.

## Contrôles frais et mesures

Commande exacte depuis ce worktree :

```sh
node qa/t05-integrated-retest-20261015/run.mjs media typecheck lint
```

Résultat : média **5 PASS / 0 FAIL / 0 SKIP**, TypeScript exit0, lint exit0. Logs `media.txt`, `typecheck.txt`, `lint.txt`. Le runner ferme le réseau, utilise des valeurs de configuration synthétiques et les dépendances déjà disponibles de T01 ; aucun secret ou fichier .env lu. FFmpeg 9.0.2, Node26.0.0, macOS arm64. Le wrapper CPU existant refuse les encodeurs GPU. Aucun fournisseur n'est appelé.

Les trois tests positifs passent réellement par `composeVideoWithFallback` → FFmpeg → validation intégrale → port d'upload de test qui écrit les octets sur disque. Le port Shotstack simulé reste inutilisé. Chaque montage comporte deux scènes, intro rouge0,2s, noir0,6s, vert0,6s, outro bleu0,2s ; voix440Hz, musique880Hz, sous-titres et logo obligatoires.

| Format | Dimensions finales | Orientation | Durée / images | FPS | Bitrate conteneur |
|---|---|---|---|---|---|
|16:9|3840×2160|paysage|1,6s / 48|30|301180 bit/s|
|9:16|2160×3840|portrait|1,6s / 48|30|289045 bit/s|
|1:1|2160×2160|carré|1,6s / 48|30|255855 bit/s|

H.264/yuv420p, pixels carrés SAR1:1, rotation0, AAC48kHz stéréo sur les trois fichiers. Décodage intégral PASS. Début et fin audio/vidéo : écart mesuré **0s**. Les fenêtres PCM vérifient musique pendant l'intro, voix et musique pendant les scènes, disparition de la voix ensuite. Il ne s'agit pas d'une preuve de synchronisation labiale humaine.

Native synthétique **160×90**, source/améliorée **320×180**, export mesuré aux dimensions ci-dessus : **upscale**, aucune génération native4K. Le preset «4K» carré signifie2160×2160 selon le contrat applicatif, pas3840×3840. Les bitrates faibles correspondent à des aplats synthétiques ; ils ne prouvent pas une qualité perceptuelle sur des contenus réels.

Les PNG `preview-*` ont été affichés et inspectés : «SUTRA» lisible, sans coupe ni chevauchement du logo dans les trois formats. Les pixels vérifient l'apparition puis la disparition du sous-titre, le logo, les deux scènes et l'intro/outro. Sous-titres incrustés ; zéro piste séparée attendu. Texte long/multilingue NON TESTÉ.

Les deux tests négatifs couvrent onze scénarios : six éléments obligatoires absents, média invalide/tronqué/corrompu, URL expirée, deux moteurs en échec. Aucun résultat final ni upload lors de ces erreurs. Les dix entrées invalides sont refusées avant tout secours ; le dernier cas appelle uniquement un faux moteur distant qui échoue. Aucun remplacement silencieux par un média brut. Le statut persistant `ready` relève de T03, non modifié par T05.

`measurements.json` contient les mesures complètes native/source/améliorée/finale, SHA-256, PCM et pixels ; `measurements.csv` en fournit la synthèse. Les trois MP4 sont conservés dans `exports/` (169216 octets au total).

## Preuves intégrées réutilisées, sans nouvel export historique

CI T01 **38677062190**, exécutée sur le candidat exact d21b7b4 : FINAL-MEDIA32PASS, REAL-EXPORT49PASS, composition-delta12PASS, salad-media25PASS, local-engine3PASS, compositor31PASS. Les groupes se recouvrent : ne pas additionner leurs comptes. `ci-reused.json` conserve commandes, résultats et empreintes des reçus T01.

Ces preuves après intégration couvrent notamment vidéo seule, musique sans voix, voix sans musique, combinaison, sous-titres, éléments facultatifs présents/absents, presets720p/1080p/4K, MIME faux, durée incohérente, perte de l'audio obligatoire, concurrence, timeouts et nettoyage. Aucun rejeu global de ces suites inchangées dans cette reprise. `historical-preservation.json` vérifie les **37 exports historiques inchangés** sur ce worktree et sur celui de T01 : aucun des37 n'a été régénéré ou écrasé par T05.

## Ressources, sécurité et limites

Trois exports exécutés séquentiellement :13,61s réelles,15,27s CPU utilisateur,4,96s système ; RSS macOS time-l maximum2903703552octets (~2,70Gio), zéro swap. Le runner plafonne chaque groupe à240s et utilise FFMPEG_MAX_CONCURRENT_JOBS=1. Aucun répertoire média temporaire `sutra-*` restant ; caches Node/tsx propres conservés et ignorés par Git. Cette mesure de groupe ne constitue pas un plafond RAM/CPU de production. Aucun nettoyage de worktree ou artefact tiers.

POLICY_OK au root canonique PURAMA. Gitleaks staged expurgé PASS (zéro fuite détectée), diff-check PASS. GitNexus index local sans embeddings :23440nœuds,43438relations ; analyse initiale du delta QA26symboles puis finale32symboles avec les journaux,0flux signalé,risqueLOW. Le graphe de processus est tronqué, donc zéro flux n'est pas une preuve exhaustive. La comparaison historique `main` couvre3487fichiers/9370symboles/228flux,risqueCRITICAL et liste plafonnée : elle dépasse ce delta. Une seconde lecture avec limite20000 reste plafonnée (3493fichiers après ajout des documents). Aucun symbole produit édité ; revue directe des nouveaux tests et égalité des producteurs. Les limites du graphe ne sont pas présentées comme une certification globale.

**PASS** : périmètre local intégré et preuves ci-dessus. **FAIL nouveau : aucun. BLOQUÉ T05 : aucun. NON TESTÉ** : rendu fournisseur, upload distant réel, production/OVH, charge concurrente4K/OOM, plafond RAM de production, génération IA native4K et lisibilité de sous-titres arbitraires. La recette globale indépendante et la promotion restent chez T01/T08. Aucun push, fusion, déploiement ou publication effectué.
