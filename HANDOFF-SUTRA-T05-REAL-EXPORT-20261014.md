# T05 vers T01 — montage et fichiers exportes reels

Branche : `codex/sutra-t05-real-export-20261014`.
Worktree : `/Users/matissdornier/purama-worktrees/sutra-t05-real-export-20261014`.
Base actuelle T01 verifiee : `e09fdaeafbf1ec8554a7b689fe3c44dd696d0140`.
Le SHA de livraison est fourni dans le miroir de ce handoff sous `.coord/handoffs/SUTRA-20261012/T05-REAL-EXPORT-20261014.md` apres creation du commit local.

**PASS local** : corrections precedentes `942d9e5` integrees (blobs identiques), 37 vrais exports MP4 conserves, trois orientations, 25 controles de rejet. Aucun nouveau defaut produit demontre, aucun changement dans `src/`, aucun fichier T03 modifie. Pas de secret/fournisseur/paiement/IA/GPU/push/fusion/deploiement.

Fichiers livres : nouveau `scripts/test-t05-real-export.mts`, dossier `qa/t05-real-export-20261014/` (helpers, runner, configuration TS, 37 MP4, fixtures synthetiques positives/negatives, mesures JSON/CSV, apercus, journaux et preuves GitNexus/securite), ce handoff, append BATON/task_plan du seul worktree.

Tests exacts :

```sh
node qa/t05-real-export-20261014/run-targeted.mjs exports
node qa/t05-real-export-20261014/run-targeted.mjs followup typecheck lint
```

Premier passage : 48 PASS / 1 FAIL d'attente de test (HTTP 403 deja rejete avant secours). Retest borne : 4 PASS / 0 FAIL, dont le cas corrige et trois regressions du harnais. Bilan : 49 scenarios distincts couverts, 37 exports PASS. Typecheck/lint cibles PASS. Aucun replay de build/gate globale inchangee.

Gitleaks staged expurge : PASS, aucune fuite ; diff whitespace PASS. GitNexus delta T05 LOW (80 fichiers/104 symboles, 0 processus identifie). Comparaison globale a `main` CRITICAL (2314 fichiers/4945 symboles/231 processus), hors certification de ce lot : concerne l'integration T01 entiere, graphe tronque et liste plafonnee. Avertissement transmis, pas de modification produit.

Mesures : H.264/yuv420p 30 FPS SAR 1:1 ; AAC stereo 48 kHz ; decodage integral ; corps 1,2 s, avec intro+outro 1,6 s/48 images. 16:9=1280x720, 9:16=720x1280, 1:1=720x720. Audio attendu mesure par frequences PCM ; voix apres intro ; pixels texte/logo et horloges cues verifies. 4K conserve : 3840x2160, 2160x3840, 2160x2160, 0,2 s/6 images. Native 160x90 -> source amelioree 320x180 -> final : upscale explicite. Un temoin lavfi 3840x2160 exerce la provenance native synthetique ; il ne prouve aucune generation IA 4K.

Rejets PASS : corrompu/tronque/URL expiree, audio absent, assets obligatoires absents/desactives fournis, double echec moteur, retour de source brute, panne stockage, suppression/decalage reel de l'audio final. Aucun succes brut et aucun appel fournisseur.

Details et liens des fichiers : [qa/t05-real-export-20261014/README.md](qa/t05-real-export-20261014/README.md). Les MP4 representent 663 908 octets au total. `verified-manifest.json` et `measurements.csv` donnent tailles, bitrates, dimensions, horloges et SHA-256 individuels.

**BLOQUE externe : aucun** dans ce perimetre local. **NON TESTE** : Shotstack live, stockage distant/routes authentifiees/navigateur, runtime OVH, generation IA native 4K. GitNexus avertit de chemins tronques : aucune certification exhaustive du graphe. Le stockage utilise l'adaptateur de test local, sans pretendre prouver Supabase.

T01 : lot pret a examiner ; aucun changement produit a integrer, seulement tests et preuves. Le WIP du candidat (AGENTS et dossiers skills) a ete preserve. Ne pas remplacer les limites locales par une certification de production.
