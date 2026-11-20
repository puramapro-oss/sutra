# T05 — preuve locale de montage et export reel

Base T01 verifiee : `e09fdaeafbf1ec8554a7b689fe3c44dd696d0140`.
Branche : `codex/sutra-t05-real-export-20261014`.

**PASS local** : 37 MP4 effectivement encodes, enregistres et conserves (663 908 octets au total), 49 scenarios distincts couverts, 25 controles de rejet. Aucun changement produit dans ce lot. Les corrections du commit precedent `942d9e557945c7ad12405775aaa25a4ba94ae2d9` sont deja integrees : les quatre blobs compares sont identiques sur le candidat T01, voir `integration-check.json`.

## Fichiers consultables

- [16:9, toutes pistes](exports/16-9-all-required.mp4)
- [9:16, toutes pistes](exports/9-16-all-required.mp4)
- [1:1, toutes pistes](exports/1-1-all-required.mp4)
- [4K agrandie 16:9](exports/16-9-4k-upscale.mp4), [9:16](exports/9-16-4k-upscale.mp4), [1:1](exports/1-1-4k-upscale.mp4)
- [Temoin natif 4K synthetique](exports/16-9-4k-native-synthetic.mp4)
- [Mesures et SHA-256 de chaque fichier](measurements.csv), [preuves detaillees consolidees](verified-manifest.json).

Les 11 cas suivants sont reellement rendus dans chacun des trois formats : video seule, musique sans voix, voix sans musique, voix+musique, sous-titres, logo, intro seule, outro seule, intro+outro, toutes pistes obligatoires, toutes pistes facultatives fournies. Les options absentes sont explicitement desactivees dans les autres cas. La matrice contractuelle des 64 combinaisons et l'absence facultative restent couvertes par le lot precedent, integre sans changement ; elle n'a pas ete rejouee.

## Mesures

Tous les exports : decodage integral de toutes les pistes, H.264/yuv420p, 30 FPS, rotation 0, SAR 1:1, une piste AAC stereo 48 kHz. Video seule : piste silencieuse, controle PCM effectif. Durees mesurees : 1,2 s (corps), 1,4 s (intro ou outro), 1,6 s (les deux), 0,2 s (temoins 4K).

| Toutes pistes | Dimensions finales | Images | Duree video/audio | Bitrate total mesure | Bitrate video mesure |
|---|---:|---:|---:|---:|---:|
| 16:9 | 1280x720 | 48 | 1,6 / 1,6 s | 211565 bit/s | 21300 bit/s |
| 9:16 | 720x1280 | 48 | 1,6 / 1,6 s | 212450 bit/s | 22185 bit/s |
| 1:1 | 720x720 | 48 | 1,6 / 1,6 s | 206885 bit/s | 16625 bit/s |

Ces bitrates bas correspondent aux mires fixes et ne qualifient pas la fidelite d'une video de production. Les horloges audio/video commencent a 0 ; les deux frequences synthetiques sont identifiees dans les octets PCM (440 Hz voix, 880 Hz musique). La voix attend la fin de l'intro et cesse apres sa duree propre ; l'absence de voix/musique est egalement verifiee. Les pixels du logo et des sous-titres, l'absence de texte hors cue, le rouge de l'intro et le bleu de l'outro sont controles. Les trois apercus `preview-*.png` ont ete affiches : texte SUTRA et carre blanc du logo visibles. Il s'agit de controles synthetiques bornes, pas d'OCR general ni de qualification perceptuelle de la parole.

| Provenance | Source native mesuree | Source/amelioree mesuree | Rendu demande = final mesure | Conclusion |
|---|---:|---:|---|---|
| Sorties 720p | 160x90 | 320x180, reellement agrandie depuis la native | 1280x720 / 720x1280 / 720x720 | upscale |
| Sorties 4K | 160x90 | 320x180 | 3840x2160 / 2160x3840 / 2160x2160 | upscale 4K, jamais generation native 4K |
| Temoin natif synthetique | 3840x2160 | 3840x2160, pas d'etape d'amelioration | 3840x2160 | natif lavfi seulement ; sans attestation, `4k-origin-unknown` |

Une dimension finale 4K ne prouve pas une generation IA native 4K. Le temoin natif est une mire CPU lavfi dont la provenance est connue, pas un appel de modele.

## Rejets observes

PASS : contenu invalide, fin du dernier paquet corrompue avec en-tete conserve, troncature, URL expiree HTTP 403 simulee, source voix/musique sans audio, six assets obligatoires absents et six assets desactives fournis. Aucun upload ni moteur de secours pour ces entrees invalides.

PASS : panne des deux moteurs injectee, secours retourne l'URL brute malgre une preuve valide, panne de stockage apres rendu valide. Aucune reponse de succes avec la source brute ; une panne de stockage ne relance pas le rendu. Le moteur de secours est uniquement un stub qui echoue ou retourne une source a refuser, jamais Shotstack live.

PASS : vrais fichiers finaux modifies pour supprimer l'audio ou le decaler (debut AAC 0,228667 s), puis controles par `probeMedia`/`assertFinalMedia`. Le fichier decalable reste decodable, mais est rejete pour desynchronisation. Exports finaux tronques/invalides egalement refuses. Les fixtures negatives sont conservees dans `fixtures/`.

## Commandes et resultats exacts

```sh
node qa/t05-real-export-20261014/run-targeted.mjs exports
node qa/t05-real-export-20261014/run-targeted.mjs followup typecheck lint
```

- `exports.log` : **48 PASS / 1 FAIL** initial. L'unique FAIL etait une assertion du nouveau test qui attendait a tort un appel de secours apres un HTTP 403 ; le produit rejette correctement avant cet appel.
- `followup.log` : **4 PASS / 0 FAIL**, incluant ce cas corrige et trois regressions ciblees des adaptateurs de test (verification Buffer et resultat Shotstack conforme au type). Les 37 exports etaient deja PASS au premier passage. Aucun nouveau defaut produit reproduit.
- Bilan des 49 scenarios distincts apres retest cible : **PASS**, sans presenter les deux executions comme une execution unique 49/49. `measurements.json` et `followup-measurements.json` restent les preuves originales ; `verified-manifest.json` les consolide par nom. Les 37 hashes des fichiers conserves ont ete compares aux preuves.
- TypeScript cible (`tsc --noEmit -p qa/t05-real-export-20261014/tsconfig.json`) et ESLint du nouveau test/helpers/runner : **PASS**. Corrections initiales du harnais de test : deux incompatibilites TS, ensuite corrigees et recontrolees.
- `gitleaks protect --staged --redact=100 --no-banner --no-color --report-format json --report-path qa/t05-real-export-20261014/gitleaks.json` : **PASS**, aucune fuite. `git diff --check` : **PASS**.
- GitNexus `detect-changes --scope staged` : **LOW**, 80 fichiers/104 symboles, 0 processus affecte identifie. Comparaison prescrite `--scope compare --base-ref main` : **CRITICAL**, 2314 fichiers/4945 symboles/231 processus pour l'ensemble de l'integration T01 par rapport a `main`. Avertissement transmis, aucun fichier produit modifie par T05. Ce resultat global, avec liste plafonnee et graphe tronque, n'est pas converti en PASS. Journaux `gitnexus-detect-*.txt`.
- Build/gates globales : **NON REJOUES**, aucun code produit/dependance/configuration modifie, preuves T01 existantes preservees.

Le runner autorise seulement les variables systeme necessaires et les valeurs Supabase synthetiques explicites. Aucun fichier de secrets lu ou copie. Reseau bloque ; seul le transport HTTPS des fixtures `media.invalid` est injecte. Le moteur et les validateurs sont reels ; l'adaptateur de stockage ecrit les octets sur disque et renvoie une URL `.invalid`. Le wrapper d'encodeur refuse VideoToolbox/NVENC/QSV, autorise libx264 CPU ; aucun calcul IA.

## Limites de la preuve

- **BLOQUE externe : aucun** pour cette preuve locale gratuite.
- **NON TESTE** : rendu Shotstack reel, stockage distant, telechargement via navigateur/API authentifiee, generation IA native 4K, qualite perceptuelle d'une parole/video reelle, runtime VPS. Pas de depense, publication, push, fusion ou deploiement.
- L'orchestrateur T03 n'a pas ete modifie. La preuve porte sur `composeVideoWithFallback`, son moteur FFmpeg reel, les validateurs et les fichiers conserves, pas sur la persistance du statut en base d'une route applicative.
- GitNexus a ete indexe localement sans embeddings. Son graphe signale des chemins tronques ; il ne certifie pas l'exhaustivite des processus. Les changements de ce lot concernent seulement tests/preuves/documents.
