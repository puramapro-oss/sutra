# SUTRA T05 — média et export — 2026-10-12

Statut : **DELTA_LOCAL_VERIFIE / INTEGRATION_PR3_NON_TESTEE / BUILD_BASE_BLOQUE**.
Code livré : `6fd2f8576761887a7a2d8ac8a3214c486aa69dcd`. Base exacte : `6a64fba103a084c71ecbfd1a07af53076af097c6`.
Branche : `codex/sutra-t05-media-export-20261012`.
Worktree : `/Users/matissdornier/purama/sutra/.worktrees/sutra-t05-media-export-20261012`.

## Autorité et intégration

AGENTS/POLITIQUE lus, contrôle démarrage POLICY_OK, LOCKS et propriétaires vérifiés avant création du worktree. Ancien scope compositeur libéré ; réservation SUTRA-T05-20261012:media-export. WIP principal et autres worktrees préservés. Aucun push, déploiement, appel fournisseur réel, génération payante, DB distante, média réel, secret ou fichier .env lu.

T01 impose PR3 `7088a0a3e733de8d2e85f3576bd86627127da369` comme base d'intégration. Le travail T05 avait commencé sur S5 : conserver ce worktree et intégrer **les hunks revus**, jamais remplacer les fichiers PR3 par S5. Les cinq fichiers export-pipeline, shotstack, ffmpeg-compositor, ffmpeg-filters, video-compositor diffèrent entre les bases ; les trois fichiers FFmpeg/video-compositor sont absents de PR3. Aucun merge/rebase/cherry-pick aveugle effectué. Package.json et lockfile inchangés (propriété T01).

## Comportement livré

- Contrat commun : voix, musique, sous-titres, intro, outro et logo `optional|required|disabled`. Défaut compatible `optional`; actif fourni invalide => erreur, jamais omission silencieuse. Les exigences doivent provenir du brief canonique fourni par le caller.
- Horloge à 30 FPS, durées finies normalisées à l'image, sous-titres relatifs au corps puis décalés par l'intro, absence de chevauchements. Voix placée après l'intro ; voix trop longue refusée. Musique courte bouclée ; sources vidéo muettes ; mix/padding/synchronisation contrôlés.
- Intro/outro, logo image ou texte littéral, ordre des calques Shotstack corrigé. Texte FFmpeg via fichier + expansion désactivée (apostrophes, deux-points, pourcentages). Correction SRT à la retenue de seconde. Sources anamorphiques normalisées en conservant leur ratio affiché.
- Le résultat FFmpeg est probé/décodé avant upload. Une erreur d'upload ou annulation ne déclenche pas de rendu Shotstack. Si les deux moteurs échouent, erreur propagée : aucune URL brute retournée. L'export rejette aussi explicitement une URL finale égale à un clip source.
- Shotstack demande des dimensions explicites sans preset contradictoire et valide le fichier retourné ; pas de succès 4K pour un fichier HD. Rendu cloud **SIMULÉ**, aucun service live testé.
- Reprise FFmpeg liée au hash du brief et marqueurs d'étapes terminées. Reprise export sans nouveau rendu payant mais revalidation du fichier, y compris ancien checkpoint `saved`. Brief changé ou preuve incompatible => rejet. Persistance après validation, durée mesurée.

## Mesures et limites de preuve

`MediaValidation` retourne SHA-256/octet, durée, bitrate et pistes de chaque fichier : source réelle de composition, natif et amélioré lorsque leurs URLs sont fournies, demande, fichier final. Natif/amélioré absents restent `null` (aucune mesure inventée).

Contrôle final : dimensions/orientation et rotation, FPS moyen/nominal à 30, H.264/yuv420p, bitrate positif mesuré (pas un seuil esthétique inventé), durée container/video, nombre d'images, décodage complet de toutes les pistes A/V, audio AAC mono/stéréo 44.1/48 kHz, horloges A/V, pixels carrés SAR 1:1, corruption et absence de pistes sous-titres externes inattendues. Tolérances explicites : vidéo 0,1 s, container 0,12 s, ±1 image, début audio 0,08 s, fin audio 0,12 s.

Test concret : source 320×180, natif 160×90, amélioré 320×180, demandé/final 3840×2160 => `upscaled`. Source native synthétique 3840×2160 avec attestation explicite => `native-4k-attested`; sans attestation => `4k-origin-unknown`. Le preset 4K ne prouve jamais une génération IA native 4K. T04 doit fournir la provenance authentique ; les attestations des tests sont **synthétiques**.

Sous-titres brûlés : fenêtres/texte validés par contrat ; présence/absence temporelle réellement vérifiée par pixels dans les tests synthétiques FFmpeg. Le rapport runtime marque `verification: render-contract` : pas d'OCR du fichier final arbitraire ni de preuve linguistique/lip-sync. Les contrôles audio runtime vérifient pistes/horloges, pas l'identité sémantique de la voix ou musique. Tests synthétiques : onde audio, silence intro/outro, boucle musique et fenêtres de sous-titres réellement décodés.

## Preuves reproductibles

[Manifest des fichiers committés et journaux](docs/t05-evidence/manifest.json). Les hashes source proviennent de `git show 6fd2f8576761887a7a2d8ac8a3214c486aa69dcd:<path>`, jamais de WIP. Journaux conservés dans `docs/t05-evidence/`.

Environnement : Node 26.0.0, TypeScript 5.9.3, Next effectif 16.3.5, ffmpeg-static déjà installé via node_modules partagé en lecture seule, ffprobe système 9.0.2. Zéro installation. Ce n'est pas l'environnement PR3/T01 Node24/Next16.3.8.

| Contrôle | Résultat exact |
| --- | --- |
| Gate ciblée finale, 15 fichiers | 118 tests : 117 PASS, 1 FAIL, 0 SKIP ; seule erreur assertion `/HTTP 404/` trop stricte |
| Delta après correction assertion + typage du helper de test | 17/17 PASS, 0 SKIP ; aucun échec test restant, pas de replay de la gate inchangée |
| Médias locaux | FFmpeg/ffprobe réels, fixtures lavfi + HTTP loopback uniquement |
| Export/Shotstack/storage | Doubles de contrats SIMULÉS ; pas de preuve fournisseur/stockage live |
| Lint applicatif | 0 erreur, 144 avertissements hérités ; exclusion du lanceur `.gitnexus/**` généré localement |
| Typecheck final | BLOQUÉ : 5 exports de routes inchangés depuis base S5, aucun diagnostic T05 restant |
| Build webpack | Compilation terminée avec warnings ; build arrêté au typecheck. 3 diagnostics T05 initiaux corrigés puis tsc rejoué ; build entier non rejoué |
| GitNexus staged | 17 fichiers, 105 symboles, 0 processus retourné, low ; graphe PARTIEL, pas certification exhaustive |
| Intégration PR3/provider/déploiement | NON TESTÉ |

Commande gate (TMPDIR propre au lot obligatoire pour isoler les anciens sweep FFmpeg) :

```sh
T05_TMP=$(mktemp -d -t sutra-t05-gate)
TMPDIR="$T05_TMP" node --import tsx --experimental-test-module-mocks --test --test-concurrency=1 \
  src/lib/ffmpeg-compositor.test.ts src/lib/ffmpeg-compositor-formats.test.ts \
  src/lib/ffmpeg-concurrency.test.ts src/lib/ffmpeg-encoder.test.ts src/lib/ffmpeg-filters.test.ts \
  src/lib/ffmpeg-io.test.ts src/lib/shotstack.test.ts src/lib/video-compositor.test.mts \
  src/lib/auto-pipeline.test.mts src/lib/video-cancel-registry.test.ts \
  src/lib/video-generation-export-contract.test.ts src/lib/media-validation.test.ts \
  src/lib/export-media.test.mts scripts/test-shotstack-contracts.mts scripts/test-auto-export-queue.mts
```

Rerun affecté : même préfixe/env, uniquement `src/lib/ffmpeg-compositor.test.ts src/lib/media-validation.test.ts`.
Autres commandes : `npm run lint -- --ignore-pattern '.gitnexus/**'`, `node_modules/.bin/tsc --noEmit`.
Build lancé sans fichier .env chargeable, avec valeurs publiques fictives de test :

```sh
NEXT_PUBLIC_SUPABASE_URL=https://test-ref.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key NEXT_PUBLIC_APP_SCHEMA=sutra NEXT_TELEMETRY_DISABLED=1 node_modules/.bin/next build --webpack
```

Blocage base S5 (fichiers inchangés, `git diff 6a64fba -- <ces chemins>` vide) :

- `src/app/api/ai/chat/route.ts` : export `NAMA_MUSE_SYSTEM_PROMPT`.
- `src/app/api/cron/scheduled-posts/route.ts` : export `publishDuePost`.
- `src/app/api/karma/games/dharma/route.ts` : export `DHARMA_SEGMENTS`.
- `src/app/api/publish/[id]/route.ts` : export `cancelScheduledPostCore`.
- `src/app/api/video/[id]/cancel/route.ts` : export `cancelVideoRenderCore`.

Ne pas résoudre ces exports dans T05 : réconcilier avec PR3 sous T01/T03/T06. Un commit local demandé n'est pas un PASS build/release.

## Impact GitNexus

Analyse upstream avant modifications : assembleFinalVideo 4 callers directs/6 affectés HIGH ; buildTracks 1/7 HIGH ; clipAsset 1/6 HIGH ; pollShotstackRender 1/7 HIGH ; actualQualityFor 5/13 CRITICAL (corps legacy conservé, type/documentation élargis seulement). Autres helpers LOW. composeVideo zéro caller retourné => UNKNOWN, recherche directe complémentaire. Risques annoncés avant édition.

Index final 13 939 nœuds, 29 977 liens, 517 flows ; 982 points d'entrée écartés, 3 091 callees écartés, 8 parcours coupés par budget. Detect-changes exécuté après staging (nouveaux fichiers inclus). Sa liste textuelle est tronquée : utiliser le manifest/Git pour l'inventaire complet, aucune absence de flow interprétée comme absence d'impact.

## Contrats à raccorder par les propriétaires

1. **T01** : revoir les 17 chemins du manifest sur PR3, intégrer uniquement le delta ; dépendance runtime FFmpeg + **ffprobe dans PATH** requise, droits processus/temp et budget worker adaptés. Script optionnel à ajouter sous votre ownership : `node --import tsx --test src/lib/media-validation.test.ts src/lib/export-media.test.mts` avec TMPDIR isolé. Aucun changement package livré.
2. **T03** : propager `requirements`, branding, durées, `clips[].lineage` et signal depuis le brief ; conserver `mediaContractHash` et `mediaValidation` via checkpoint. Les workers/callers ne sont pas modifiés ici. `composeAutoVideo` de S5 perd les nouveaux champs et reconstruit une qualité legacy : adapter ce caller sur la version canonique, ne pas considérer le lot intégré avant cela. `export-pipeline.ts` est le delta T05 de validation ; arbitrer les checkpoints avec T03.
3. **T04** : fournir `nativeUrl`, `enhancedUrl`, `generation.kind/evidence` issus du fournisseur et de ses mesures, sans prétendre qu'un fichier upscalé est une génération native. Conserver required/optional du brief en cas d'échec voix/musique.
4. **T02** : réutiliser votre downloader SSRF et stockage privé canoniques PR3. T05 réutilise `downloadToFile` existant et ne livre aucun second downloader réseau ni changement d'auth. Conciliation URLs signées/expiration/validation à l'intégration.
5. **T06/T07/T08** : publication uniquement après validation finale ; présenter demandé/final/provenance séparément, aucun label natif déduit de 4K. Rejouer les tests touchés sur le commit intégré ; aucun PASS S5 ne certifie PR3.

Prochaine étape externe unique : **intégration revue du delta T05 par T01 avec raccord des contrats propriétaires, puis gate PR3**. Worktree conservé ; aucun nettoyage d'artefacts tiers.
