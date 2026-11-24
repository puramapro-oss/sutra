# T05 — médias et exports réels, 15 octobre 2026

## Résultat et périmètre

**PASS LOCAL : 34 tests distincts, 0 FAIL final, 0 SKIP ; TypeScript et lint ciblés PASS.**
17 exports MP4 conservés et mesurés (neuf multi-scènes + huit variantes), sans fournisseur ni secret. Cinq défauts produit reproduits puis corrigés dans trois fichiers FFmpeg. Aucun fichier T03, Shotstack, config/CI/OVH ou autre terminal modifié.

Base T01 vérifiée au démarrage puis avant clôture : `49c166d4c15412d2a3c1246c216cf0df319f2df0`, produit candidat `3855665fa79e3cc2171124d864a834214d6ac617`. Branche locale `codex/sutra-t05-final-media-20261015`.

Le lot REAL-EXPORT `2da10b34a1715a6f33b1087f8c53480353727f56` est intégré dans `ca8470b41c3d698f15a43260c03829ae63d35d18` : `integration.json` vérifie 72 fichiers commités identiques, huit logs présents et identiques sur disque T01 mais non commités, et onze empreintes de producteurs avant ce delta. Les preuves historiques restent distinctes des 34 tests frais. Aucun build ou gate globale inchangée rejoué.

## Défauts reproduits → correction → régression

| Défaut | Avant | Correction | Preuve finale |
|---|---|---|---|
| T05-FINAL-01 transfert de slot | actif=2 avec maximum=1 | réservation synchrone avant réveil du demandeur en attente | resource slot-transfer-race PASS |
| T05-FINAL-02 concurrence fractionnaire | configuration0.5 devient zéro slot | borne minimale1 après arrondi | resource fractional PASS |
| T05-FINAL-03 file d'attente hors budget | timeout40ms toujours pendant après120ms | attente annulable, retrait du waiter | resources queue + limits cancelled PASS |
| T05-FINAL-04 téléchargement hors budget total | download bloqué jusqu'à annulation secours250ms | signal de deadline commun à toutes les étapes | stalled-download <180ms ; failures no-fallback PASS |
| T05-FINAL-05 détection encodeur hors budget | délai commence après découverte | deadline avant découverte, kill+close, plafond2s/1Mo de sortie, annulation non cachée | encoder-discovery ~42ms pour budget40ms PASS |

Rouge initial conservé : `resources-2026-10-15T01-03-28-054Z.txt/json` (2 PASS,5 FAIL), puis vert `resources-2026-10-15T01-04-06-249Z.txt/json` (7 PASS). Les erreurs TypeScript intermédiaires concernent le harnais ajouté (type Buffer, propriétés du faux résultat Shotstack, preset hd) ; elles sont corrigées et les quatre cas concernés rejoués. Aucun échec historique supprimé ou compté comme vert.

## Exports réellement produits

`measurements.csv` contient toutes les mesures et SHA-256 ; `verification.json` contient tests, producteurs, mesures, temps et RSS. Les JSON `media-*` et `variants-*` conservent les preuves détaillées native/source/améliorée/finale, mesures PCM et pixels.

| Format | 720p | 1080p | 4K |
|---|---|---|---|
|16:9|1280×720|1920×1080|3840×2160|
|9:16|720×1280|1080×1920|2160×3840|
|1:1|720×720|1080×1080|2160×2160|

Les neuf exports multi-scènes durent1,6s (48 images) : intro rouge0,2s, deux scènes noir/vert de0,6s, outro bleu0,2s ; voix440Hz, musique880Hz, logo et sous-titres obligatoires. H.264/yuv420p,30FPS,SAR1:1,rotation0,AAC48kHz stéréo, décodage intégral PASS. Décalage début/fin audio-vidéo mesuré0s. Bitrate conteneur208225–301180bit/s (aplat synthétique, aucune conclusion de qualité perceptuelle sur contenu réel).

Huit variantes1080p : vidéo seule, musique sans voix, voix sans musique, combinaison, sous-titres seuls, logo+intro+outro, tous facultatifs présents et tous facultatifs absents. Elles passent le vrai composeur et l'upload de test écrit les octets locaux ; seules les URLs renvoyées sont synthétiques. Le conteneur peut conserver une piste AAC silencieuse pour vidéo seule : les échantillons PCM vérifient l'absence de voix/musique audible attendue. La musique sans voix est réellement présente ; la voix démarre après l'intro ; les fréquences et fenêtres temporelles sont testées, pas une synchronisation labiale humaine.

Source native synthétique160×90, source améliorée320×180, puis export aux dimensions du tableau : **upscale**, jamais génération native4K. La provenance inclut les deux sources mesurées pour chaque multi-scène. Le contrôle historique synthétique natif3840×2160 reste réutilisé via ses empreintes ; aucune génération IA native4K testée.

Les images `preview-16-9.png`, `preview-9-16.png`, `preview-1-1.png` ont été affichées : sous-titre « SUTRA » lisible, sans chevauchement du logo ni coupe. Les assertions pixels vérifient apparition/disparition des cues, logo et couleurs des scènes pour les neuf formats/presets. Les sous-titres sont incrustés (zéro piste de sous-titres séparée attendu). Lisibilité de textes longs/multilingues NON TESTÉE.

## Refus et absence de faux succès

PASS : vidéo invalide, tronquée, corruption en fin de flux, URL expirée, MIME text/html ou image/png pour MP4, durée finale incohérente, chacun des six éléments obligatoires absent. MIME application/octet-stream accepté seulement avec une signature média valide. Un vrai fichier rendu puis privé de sa piste audio est refusé si la voix est obligatoire, sans upload ni appel de secours.

PASS : deux moteurs échouent → erreur propagée ; fournisseur simulé renvoyant une URL brute malgré une preuve de rendu → refus ; timeout total → erreur, zéro appel Shotstack et zéro upload. Les exigences sont vérifiées avant montage et avant livraison ; aucun résultat final renvoyé dans ces échecs. La persistance du statut `ready` appartient à T03 et n'est pas éditée/certifiée ici.

## Ressources et nettoyage

CPU uniquement : wrapper FFmpeg refusant VideoToolbox/NVENC/QSV, libx264 ; aucun calcul IA/GPU. Petit contenu, un job à la fois pour les mesures. Groupe neuf exports+invalides :43,24s réelles/30,47s utilisateur/11,27s système, RSS max2 903 638 016octets (~2,70Gio), zéro swap. Huit variantes :16,75s, RSS max705 937 408octets. Ces RSS sont les mesures macOS time-l du groupe/processus, pas une limite mémoire agrégée de production ni une garantie de charge.

PASS : limite de concurrence1 et transfert sans dépassement, budget global, kill réel de sous-processus FFmpeg/probe après40ms, annulation d'un waiter, budgets invalides refusés, durées plafonnées1500/600/180s pour720p/1080p/4K avant téléchargement. Défaut de reprise : répertoire du job conservé intentionnellement après échec ; retry réussi supprime ce répertoire. Aucun dossier temporaire média `sutra-*` restant. Caches Node/tsx conservés et exclus de Git ; aucune suppression de WIP ou cache tiers. Les exports de preuve sont volontairement conservés.

**Limite T01 :** aucune limite dure CPU/RAM trouvée dans `deploy/ovh.py`, `deploy/candidate.py`, `deploy/ovh.Dockerfile`. Limitation mémoire de production, charge concurrente4K/OOM, durée de rétention des checkpoints abandonnés, runtime Linux/OVH et rendu fournisseur réel NON TESTÉS. La limite de concurrence applicative ne remplace pas une limite RAM. Le contrôle d'ingestion historique plafonne64MiB ; ce lot ne réalise pas un test de saturation64MiB. Aucun blocage externe n'empêche la clôture locale ; intégration et qualification du runtime relèvent de T01.

## Commandes exactes

Depuis le worktree, groupes exécutés séparément pour ne pas rejouer les PASS inchangés :

```sh
node qa/t05-final-media-20261015/run-targeted.mjs resources
node qa/t05-final-media-20261015/run-targeted.mjs media
node qa/t05-final-media-20261015/run-targeted.mjs regression
node qa/t05-final-media-20261015/run-targeted.mjs limits
node qa/t05-final-media-20261015/run-targeted.mjs variants
node qa/t05-final-media-20261015/run-targeted.mjs failures typecheck lint
```

Chaque groupe utilise le preload réseau fermé `qa/t08/offline.cjs`, le transport de fixtures intégré, des variables synthétiques allowlistées, TMPDIR propre et time-l. Runner macOS : Python système et `/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg` ; version Node/FFmpeg du dossier environnement. Aucun `.env` ni secret master lu/copié ; aucun fournisseur/contact réseau live, aucune publication, fusion, push ou déploiement. Le test de secours Shotstack est un adaptateur simulé qui ne fait aucun appel.

GitNexus : index initial puis final, impacts préalables LOW pour auxiliaires ; composeVideo UNKNOWN via alias d'injection confirmé par lecture directe (seul appelant produit video-compositor). detect_changes scope all initial :92symboles puis final98symboles/2flux attendus/risque MEDIUM. Comparaison main : historique complet2733fichiers/8073symboles/229flux/CRITICAL, liste plafonnée malgré une seconde lecture avec limite10000 ; graphe d'exécution partiel, aucune certification exhaustive. Logs conservés. Revue manuelle des trois fichiers produit et tests consommateurs. Gitleaks staged expurgé PASS ; diff-check PASS. Policy-check canonique PURAMA PASS ; le lancement initial depuis l'app isolée sans politique monorepo échouait, puis a été exécuté au bon root sans modifier de config.

**Statuts :** PASS local ci-dessus ; FAIL historiques corrigés seulement ; BLOQUÉ intégration/qualification finale tant que T01/T08 n'ont pas accepté le nouveau SHA ; NON TESTÉ production/fournisseurs, charge/OOM, génération IA native4K, lecture humaine de textes arbitraires. Aucun « zéro bug garanti ».

Les logs CLI .txt sont conservés bruts, espaces compris (attribut Git local au dossier de preuves) ; le CSV utilise LF. Le contrôle de whitespace couvre toujours les sources produit/tests/docs.
