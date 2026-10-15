# Livraison T05 FINAL MEDIA — 2026-10-15T01:14:44.539841+00:00

**FIN_ECRITURE / PASS LOCAL — à intégrer par T01, non intégré à ce stade.**

- Branche : `codex/sutra-t05-final-media-20261015`
- SHA : `44cbbab40e20f65d0506c18af253218055884c46`
- Base : `49c166d4c15412d2a3c1246c216cf0df319f2df0` (candidat applicatif3855665)
- Worktree propre : `/Users/matissdornier/purama-worktrees/sutra-t05-final-media-20261015`
- Handoff : `HANDOFF-SUTRA-T05-FINAL-MEDIA-20261015.md`
- Mesures/commandes : `qa/t05-final-media-20261015/README.md`, `verification.json`, `measurements.csv`, `SHA256SUMS` (76preuves vérifiées après commit).

REAL-EXPORT2da10b3 intégré vérifié. Cinq défauts reproduits corrigés : transfert concurrence2/1, minimum fractionnaire zéro, timeout absent en attente/téléchargement/découverte encodeur. Trois fichiers produit réservés seulement, interfaces existantes préservées. Deadline totale expirée => annulation, aucun fallback payant. Aucun orchestrateur T03 modifié.

34tests distincts PASS/0FAIL/0SKIP (resources7,media11,variants8,limits2,failures4,legacy-concurrency2), TS/lint ciblésPASS, Gitleaks stagedPASS, diff-checkPASS.17MP4réels CPU : neuf multi-scènes 16:9/9:16/1:1 ×720p/1080p/4K +huit variantes1080p. H.264/30FPS/SAR1:1/fullDecode, synchronisation mesurée0s ; voix/musique/cues/logo/intro/outro/scènes vérifiés. Trois aperçus affichés, sous-titre lisible. Refus des corrompus/tronqués/MIMEfaux/URLexpirée/durée incorrecte/audio requis absent/deux moteurs échoués/retour URLbrute.

Source native160×90, améliorée320×180, finale jusqu'à3840×2160 ou2160×3840 : upscale, aucune IA native4K prouvée. RSS max observé~2,70Gio ; aucun quota dur RAM/CPU de production trouvé dans deploy/ovh.py,candidate.py,ovh.Dockerfile. T01 seul décide/qualifie runtime ; charge/OOM, Linux/OVH,fournisseurs live et IA native4K NON TESTÉS. Aucun dossier temporaire média restant ; caches Node/tsx ignorés conservés. Intégration/recette candidate T01/T08 en attente (pas un blocage de travail local). Aucun secret lu, appel payant, GPU/IA Mac,push,fusion,publication ou déploiement.

GitNexus impacts exécutés avant edit ; final98symboles/2flux/MEDIUM, main historiqueCRITICAL toujours tronqué malgré limite10000. Diff produit revu manuellement ; aucune exhaustivité globale revendiquée. Ne pas rejouer les PASS inchangés.

## Fichiers du commit (85)

- `BATON.md`
- `ERRORS.md`
- `HANDOFF-SUTRA-T05-FINAL-MEDIA-20261015.md`
- `qa/t05-final-media-20261015/.gitattributes`
- `qa/t05-final-media-20261015/.gitignore`
- `qa/t05-final-media-20261015/README.md`
- `qa/t05-final-media-20261015/SHA256SUMS`
- `qa/t05-final-media-20261015/audio-required-before.mp4`
- `qa/t05-final-media-20261015/audio-required-missing.mp4`
- `qa/t05-final-media-20261015/callers.txt`
- `qa/t05-final-media-20261015/cpu-bin/ffmpeg`
- `qa/t05-final-media-20261015/detect-changes-final.txt`
- `qa/t05-final-media-20261015/detect-changes-main-full.txt`
- `qa/t05-final-media-20261015/detect-changes-main.json`
- `qa/t05-final-media-20261015/detect-changes.json`
- `qa/t05-final-media-20261015/environment.json`
- `qa/t05-final-media-20261015/exports/1-1-1080p-multi.mp4`
- `qa/t05-final-media-20261015/exports/1-1-4k-multi.mp4`
- `qa/t05-final-media-20261015/exports/1-1-720p-multi.mp4`
- `qa/t05-final-media-20261015/exports/1080p-all-optional.mp4`
- `qa/t05-final-media-20261015/exports/1080p-brand.mp4`
- `qa/t05-final-media-20261015/exports/1080p-music-only.mp4`
- `qa/t05-final-media-20261015/exports/1080p-optional-absent.mp4`
- `qa/t05-final-media-20261015/exports/1080p-subtitles.mp4`
- `qa/t05-final-media-20261015/exports/1080p-video-only.mp4`
- `qa/t05-final-media-20261015/exports/1080p-voice-music.mp4`
- `qa/t05-final-media-20261015/exports/1080p-voice-only.mp4`
- `qa/t05-final-media-20261015/exports/16-9-1080p-multi.mp4`
- `qa/t05-final-media-20261015/exports/16-9-4k-multi.mp4`
- `qa/t05-final-media-20261015/exports/16-9-720p-multi.mp4`
- `qa/t05-final-media-20261015/exports/9-16-1080p-multi.mp4`
- `qa/t05-final-media-20261015/exports/9-16-4k-multi.mp4`
- `qa/t05-final-media-20261015/exports/9-16-720p-multi.mp4`
- `qa/t05-final-media-20261015/failures-2026-10-15T01-08-31-495Z.json`
- `qa/t05-final-media-20261015/failures-2026-10-15T01-08-31-495Z.txt`
- `qa/t05-final-media-20261015/failures-2026-10-15T01-09-05-841Z.json`
- `qa/t05-final-media-20261015/failures-2026-10-15T01-09-05-841Z.txt`
- `qa/t05-final-media-20261015/failures-2026-10-15T01-09-46-332Z.json`
- `qa/t05-final-media-20261015/failures-2026-10-15T01-09-46-332Z.txt`
- `qa/t05-final-media-20261015/gitleaks-final.txt`
- `qa/t05-final-media-20261015/gitleaks.txt`
- `qa/t05-final-media-20261015/gitnexus-final-index.txt`
- `qa/t05-final-media-20261015/gitnexus-index.txt`
- `qa/t05-final-media-20261015/helpers.mts`
- `qa/t05-final-media-20261015/impact-compose.json`
- `qa/t05-final-media-20261015/impact-concurrency.json`
- `qa/t05-final-media-20261015/impact-encoder.json`
- `qa/t05-final-media-20261015/impact-list-encoders.json`
- `qa/t05-final-media-20261015/impact-max.json`
- `qa/t05-final-media-20261015/integration.json`
- `qa/t05-final-media-20261015/limits-2026-10-15T01-05-16-719Z.json`
- `qa/t05-final-media-20261015/limits-2026-10-15T01-05-16-719Z.txt`
- `qa/t05-final-media-20261015/lint-2026-10-15T01-05-18-066Z.txt`
- `qa/t05-final-media-20261015/lint-2026-10-15T01-09-51-194Z.txt`
- `qa/t05-final-media-20261015/measurements.csv`
- `qa/t05-final-media-20261015/media-2026-10-15T01-04-14-226Z.json`
- `qa/t05-final-media-20261015/media-2026-10-15T01-04-14-226Z.txt`
- `qa/t05-final-media-20261015/preview-1-1.png`
- `qa/t05-final-media-20261015/preview-16-9.png`
- `qa/t05-final-media-20261015/preview-9-16.png`
- `qa/t05-final-media-20261015/regression-2026-10-15T01-04-15-337Z.txt`
- `qa/t05-final-media-20261015/resources-2026-10-15T01-02-26-893Z.json`
- `qa/t05-final-media-20261015/resources-2026-10-15T01-02-26-893Z.txt`
- `qa/t05-final-media-20261015/resources-2026-10-15T01-03-28-054Z.json`
- `qa/t05-final-media-20261015/resources-2026-10-15T01-03-28-054Z.txt`
- `qa/t05-final-media-20261015/resources-2026-10-15T01-04-06-249Z.json`
- `qa/t05-final-media-20261015/resources-2026-10-15T01-04-06-249Z.txt`
- `qa/t05-final-media-20261015/run-targeted.mjs`
- `qa/t05-final-media-20261015/scene-two-enhanced.mp4`
- `qa/t05-final-media-20261015/scene-two-native.mp4`
- `qa/t05-final-media-20261015/tsconfig.json`
- `qa/t05-final-media-20261015/typecheck-2026-10-15T01-04-15-625Z.txt`
- `qa/t05-final-media-20261015/typecheck-2026-10-15T01-05-17-097Z.txt`
- `qa/t05-final-media-20261015/typecheck-2026-10-15T01-08-35-700Z.txt`
- `qa/t05-final-media-20261015/typecheck-2026-10-15T01-09-09-881Z.txt`
- `qa/t05-final-media-20261015/typecheck-2026-10-15T01-09-50-294Z.txt`
- `qa/t05-final-media-20261015/variants-2026-10-15T01-05-49-754Z.json`
- `qa/t05-final-media-20261015/variants-2026-10-15T01-05-49-754Z.txt`
- `qa/t05-final-media-20261015/verification.json`
- `qa/t05-final-media-20261015/wrong-duration.mp4`
- `scripts/test-t05-final-media.mts`
- `src/lib/ffmpeg-compositor.ts`
- `src/lib/ffmpeg-concurrency.ts`
- `src/lib/ffmpeg-encoder.ts`
- `task_plan.md`
