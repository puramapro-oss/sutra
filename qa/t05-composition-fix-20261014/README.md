# T05 — composition et validation, delta du 14 octobre 2026

Base integree T01 : `b7cf848d07fca2734db36a2e30d045ca312a3162` ; code `d8691d8ac6cf885f8e5522f361f45ebe229ec20d`.
Branche : `codex/sutra-t05-composition-fix-20261014`.
Propriete reservee dans les deux LOCKS avant edition. WIP T01 preserve ; aucune integration, aucun push ni deploiement.

## Defauts reproduits puis corriges

| Defaut | Avant (before.tap, 4 PASS / 3 FAIL) | Cause et correction | Apres |
|---|---|---|---|
| Sous-titres disproportionnes en 4K | Glyphes SUTRA : 45 px a 720p, 398 px a 4K | `original_size` ne definit pas le canevas ASS. PlayResX/Y explicites ; police, contour et marge proportionnels | 17 px puis 53 px ; marge 65 puis 194 px ; vrais pixels FFmpeg |
| Cue invisible acceptee | Intervalle 0.001–0.002 s accepte meme obligatoire, entre les images 0 et 1/30 s | Refus des durees inferieures a une image 30 FPS ; tolerance flottante 1e-9 s | Cue refusee ; duree exacte 1/30 s acceptee ; zero compose/fallback/upload sur brief invalide |
| Exigence inconnue acceptee | Cles JSON `toString`, `constructor`, `__proto__` acceptees | `in` consultait le prototype ; verification des seules proprietes propres | Toutes refusees avant montage |

Sources techniques primaires consultees : [FFmpeg subtitles](https://ffmpeg.org/ffmpeg-filters.html#subtitles-1), [libass, traitement des overrides PlayRes](https://github.com/libass/libass/blob/master/libass/ass.c). La mesure locale est la preuve du comportement du binaire utilise.

Deux fichiers produit changes seulement : `src/lib/composition-contract.ts`, `src/lib/ffmpeg-filters.ts`. Le contrat commun est reutilise par Shotstack, FFmpeg et la validation finale. Aucun adaptateur fournisseur duplique. `shotstack-timeline.ts`, media-probe et le correctif anti-video-brute T01 restent inchanges.

## Commandes exactes et resultats

Depuis la racine du worktree, sans fichier .env :

```sh
node qa/t05-composition-fix-20261014/run-targeted.mjs delta contracts media worker auto typecheck lint
```

Le lanceur utilise une configuration fictive explicite, le preload reseau `qa/t08/offline.cjs`, les fixtures existantes et un wrapper FFmpeg qui impose libx264 CPU et refuse les encodeurs materiels. Aucun secret reel lu ; aucune variable copiee depuis le master. Sur un autre hote, fournir `T05_FFMPEG_BINARY` vers un FFmpeg avec libass ; ffprobe doit etre dans PATH.

| Groupe | Resultat | Risque couvert |
|---|---|---|
| delta | PASS 12/12, aucun SKIP | 64 combinaisons de presence voix/musique/sous-titres/logo/intro/outro ; obligatoire absent, facultatif fourni/absent, desactive fourni/absent ; pistes Shotstack et horloge ; trois corrections ; vrais exports 720p et 4K |
| contracts | PASS 33/33 | Shotstack, editeur/export, persistence export, file auto-export, fallback composeVideoWithFallback |
| media | PASS 8/8 | Pixels de sous-titre dans/hors fenetre, logo pendant intro/corps/outro, voix decalee et silence intro/outro, boucle musique, SAR, metadonnees invalides, provenance |
| worker | PASS 25/25 | Sortie worker, URL 403/410 expiree, corruption/troncature, audio obligatoire, desynchronisation, raw URL/alias SHA refuses, aucun ready apres echec du montage |
| auto | PASS | Publication brute bloquee quand composition requise |
| typecheck | PASS | Nouveau test et fermeture de ses dependances TS, `tsc --noEmit -p qa/t05-composition-fix-20261014/tsconfig.json` |
| lint | PASS | Deux fichiers produit, nouveau test et lanceur |
| gitleaks | PASS, aucune fuite | `gitleaks protect --staged --redact=100 --no-banner --no-color --report-format json --report-path qa/t05-composition-fix-20261014/gitleaks.json` |

Total : **78 tests Node PASS, 0 FAIL, 0 SKIP**, plus le controle auto. Les groupes inchanges ne sont pas rejoues. Le premier lancement de typecheck avait signale un type de `transitions` trop large dans le nouveau test ; corrige par le literal `none`, puis typecheck/lint et delta rejoues. Les premieres tentatives de harnais (import Supabase avant valeurs fictives, type MIME de fixture PNG) ont ete corrigees avant capture du vrai avant/apres. `before.tap` conserve uniquement les trois defauts produit reproduits ; `after.tap` est la verification initiale 7/7, `delta.log` la version complete 12/12.

## Fichiers mesures

Toutes les sorties : H.264/yuv420p, pixels 1:1, 30 FPS, rotation 0, decodage complet reussi ; AAC valide quand present. Les bitrates ci-dessous sont ceux des petits aplats synthetiques, pas une garantie de qualite perceptuelle.

| Sortie | Dimensions finales | Duree / images | Bitrate conteneur bit/s | Provenance |
|---|---|---|---|---|
| 720p 16:9 | 1280x720 | 0.8 s / 24 | 237810 | upscale source 320x180 |
| 720p 9:16 | 720x1280 | 0.8 s / 24 | 238350 | upscale source 320x180 |
| 720p 1:1 | 720x720 | 0.8 s / 24 | 231000 | upscale source 320x180 |
| 4K 16:9 | 3840x2160 | 0.2 s / 6 | 287600 | native 160x90, amelioree/source 320x180, upscale |
| 4K 9:16 | 2160x3840 | 0.2 s / 6 | 339880 | meme provenance synthetique, upscale |
| 4K 1:1 | 2160x2160 | 0.2 s / 6 | 235000 | meme provenance synthetique, upscale |
| 4K source synthetique native | 3840x2160 | 0.2 s / 6 | 287600 | native/source 3840x2160, attestation lavfi uniquement |

`after-measurements.json` conserve source, native, amelioree, rendu demande, fichier final, SHA-256, dimensions, orientation, FPS, codecs, bitrates, durees, horloges, pistes audio et cues. Sans attestation, les dimensions 4K seules donnent `4k-origin-unknown`, jamais une preuve de generation native IA. Les fichiers binaires temporaires sont generes localement puis supprimes par le teardown du test ; aucune fixture lourde commitee.

## GitNexus et limites

Index local b7cf848, analyse index-only sans embeddings. `compositionPlan` : CRITICAL, 13 appelants directs, 31 impacts, 6 processus ; avertissement emis avant edition. `buildSubtitlesFilter` : LOW, appelant direct composeVideo. Impacts et detection stockes dans ce dossier. `detect-changes` retrouve uniquement ces deux symboles produit ; le graphe des flux est tronque (1095 entrees et 597 callees omises), donc aucune certification exhaustive du graphe. Regressions choisies aussi d'apres les appelants directs.

- PASS : delta local et tests synthetiques ci-dessus ; `git diff --check` ; hashes sources/dependances dans `verification.json`.
- FAIL restant : aucun dans les controles executes.
- BLOQUE : aucun blocage externe pour livrer ce lot local.
- NON TESTE : rendu Shotstack live, worker GPU distant, voix/musique fournisseur, generation IA native 4K, qualite perceptuelle sur contenu reel et verification OCR de tous les rendus utilisateurs. Le controle de cues du produit est un contrat de rendu, pas un OCR.
- Build et suites globales non rejoues : la campagne precedente T01 est documentee dans `qa/salad-integration-20261014/README.md` ; T01 execute une seule campagne sur le candidat final integre. Ce delta n'est pas encore integre/deploye.

T01 : integrer ce commit local apres revue, reprendre les deux fichiers produit et le nouveau test ; le lanceur detaille les dependances et commandes. Aucune action utilisateur/fournisseur n'est necessaire pour ces correctifs locaux.
