# Moteur vidéo local — M4 Max 48 Go : installé et mesuré

> État : **INSTALLÉ ET TESTÉ EN VRAI** (mission 9, 2026-09-19). Génération réelle
> inspectée, temps et mémoire mesurés. Aucun achat, aucune API payante, aucune
> installation existante supprimée. Fichiers de preuve : `~/purama/sutra-local-renders/`.

## 0. Ce qui est installé (vérifié sur disque)

| Composant | Version/taille exacte | Source (100 % officielle) |
|---|---|---|
| ComfyUI | master 2026 (io.ComfyNode), venv `python3.11` (brew), PyTorch 2.14.0 MPS | github.com/comfyanonymous/ComfyUI |
| Checkpoint LTXV | `ltxv-13b-0.9.8-distilled-fp8.safetensors` — 15 694 280 140 o | huggingface.co/Lightricks/LTX-Video |
| Encodeur texte | `t5xxl_ltxv_official.safetensors` — 19,05 Go (219 tenseurs, encoder-only, fp32) | 4 shards officiels Lightricks fusionnés localement (`/tmp/merge_t5.py`) |
| Upscaler latent | `ltxv-spatial-upscaler-0.9.8.safetensors` | Lightricks/LTX-Video (`models/latent_upscale_models/`) |
| Adaptateur SUTRA | `scripts/comfyui-engine-server.mjs` (port 7861) | ce repo |

Emplacement : `~/purama/ComfyUI/` (hors repo, aucune install existante touchée).
Disque avant : 209 Go libres ; après ~35 Go téléchargés : 123 Go libres.

## 1. Licences — CORRECTION importante vs version précédente du doc

| Composant | Licence | Commercial |
|---|---|---|
| ComfyUI (code) | GPL-3.0 | OK (processus local séparé, non lié au code SUTRA) |
| **LTX-Video poids ≥ 0.9.6** | **LTXV Open Weights License 0.X** (avril 2025) — PAS Apache-2.0 | OK si CA annuel **< 10 M$** ; sinon licence payante. PURAMA < 10 M$ → OK aujourd'hui, à revoir si dépassement |
| LTX-Video (code repo) | Apache-2.0 | OK |
| Sorties générées | appartiennent à l'utilisateur | OK |
| LTX-2.3 (non installé) | duale, payant ≥ 10 M$ | évité |
| ~~SUPIR~~ | non-commercial | EXCLU (remplacé par l'upscaler latent officiel LTXV) |

> La version mission 8 de ce document annonçait « Apache-2.0 pur » pour les
> poids : c'était la licence du CODE. Les poids 0.9.8 sont sous LTXV Open
> Weights 0.X. Corrigé ici.

## 2. Chaîne de génération (implémentée, pas simulée)

```
SUTRA (src/lib/local-engine.ts, strict, owner-only)
  → POST http://127.0.0.1:7861 {prompt,width,height,num_frames,fps,upscale_4x?}
    → adaptateur node (buildWorkflow, noms vérifiés via /object_info)
      → ComfyUI :7860 : CLIPLoader(ltxv) + CheckpointLoaderSimple(distilled fp8)
        + EmptyLTXVLatentVideo (w/h multiples de 32, frames 8k+1)
        + LTXVScheduler (max_shift 2.05, base_shift 0.95) + SamplerCustom
        (euler, cfg 1.0, steps 8) + LTXVConditioning(frame_rate) + VAEDecode
      → [si upscale_4x] LTXVLatentUpsampler ×2 passes (modèle officiel
        ltxv-spatial-upscaler-0.9.8) AVANT le décodage
    ← {video_url, compute_ms, ...} → mp4 servi via /files
```

Preuve d'isolation : le runner de test instrumente `fetch` et n'autorise QUE
`127.0.0.1` — aucun hôte externe contacté pendant la génération mesurée.

## 3. Mesures réelles (M4 Max 48 Go, macOS, secteur)

### Génération native — 2026-09-19, fichier inspecté

Prompt FR « un phare solitaire balayé par la tempête au coucher du soleil… »,
`quality:'720p' format:'16:9'` → grille WAN 896×512, duration 6 s.

| Mesure | Valeur |
|---|---|
| Fichier | `~/purama/sutra-local-renders/real-local.mp4` — 751 586 o |
| Conteneur (ffprobe) | h264, **896×512**, 16 fps, **89 frames, 5,56 s**, **PAS de piste audio** |
| Temps de calcul (adaptateur) | 283 078 ms ≈ **4 min 43 s** (inclus chargement T5+ckpt à froid) |
| Temps sampling seul | ~190 s (8 steps × ~24 s, 89 frames) |
| Mémoire pic ComfyUI (RSS) | 18 423 872 Ko ≈ **18,4 Go** / 48 Go (pic au chargement T5 fp32 ; sampling ~6,2 Go) |
| Hôtes réseau contactés | `127.0.0.1:7861` uniquement (garde fetch) |

Smoke test antérieur : 768×448, 25 frames, 6 steps → 295,63 s (dominé par le
premier chargement des poids).

### Vérification visuelle (frames 1/45/89 extraites)

- Scène **cohérente début→fin** : plage au coucher du soleil, soleil sur
  l'horizon, vagues déferlantes, reflets dorés. Aucune zone noire, aucun objet
  qui apparaît/disparaît, pas de dérive de lumière.
- **MAIS fidélité prompt imparfaite** : le « phare » est rendu comme une forme
  organique effilée (type rocher/tronc), et la « tempête » n'est pas visible
  (mer agitée mais ciel dégagé). Comportement connu du distilled à 8 steps /
  cfg 1.0 sur prompts courts. Le rendu est réel (IA générée, pas un fichier de
  test) mais le prompt engineering reste à travailler (prompts EN, plus
  descriptifs, ou steps 10-14).

## 4. Agrandissement 4K — testé, distinction honnête

## 4ter. Export UHD EXACT 3840×2160 (run du 2026-09-19 17:24)

Le 3584×2048 (grille WAN 896×512, ratio 1,75) ne fait PAS du UHD 16:9.
Chaîne à 3 étapes distinctes, ratio 16:9 préservé de bout en bout
(1024/576 = 4096/2304 = 3840/2160 = 1,7778 — scale pur, **zéro étirement**,
zéro crop, zéro letterbox) :

| Étape | Résolution | Temps mesuré | Moyen |
|---|---|---|---|
| 1. Native (grille LTXV 16:9, multiple de 32) | **1024×576** | 291 695 ms | ltxv-13b distilled fp8, 8 steps |
| 2. Agrandissement IA ×2 passes | **4096×2304** | 150 247 ms | ltxv-spatial-upscaler (latent) + VAEDecodeTiled |
| 3. Adaptation finale (downscale 0,9375) | **3840×2160** | 2 853 ms | ffmpeg lanczos, h264 crf17, +faststart |
| **Total e2e** (`upscale_4x` + `target_width/height`) | | **444 803 ms = 7 min 25 s** | |

Fichier : **`~/purama/sutra-local-renders/sutra-final-3840x2160.mp4`**
(10 378 229 o, ~14,9 Mbps, yuv420p). Intermdédiaires dans
`~/purama/ComfyUI/output/sutra/`.

ffprobe + lecture visuelle (frames 1/16/32/45/61/76/89 + crop centre) :
- **3840×2160 exact**, 89 frames, 5,5625 s, 16 fps constant (cadence LTXV
  native — fluidité limitée par le générateur, pas par l'export).
- Soleil circulaire sur toute la timeline → aucune déformation.
- Scène cohérente, vagues progressives, aucune seam de tuiles, aucun
  scintillement, aucune zone noire, aucun blocage au crop centre.
- **Pas de piste audio — ATTENDU** : LTXV 0.9.8 ne génère pas de son
  (§5.1) ; SUTRA mux voix/musique en aval via ffmpeg.

API adaptateur : `POST /` accepte `target_width`/`target_height` (étape 3
auto, garde anti-étirement : refuse un ratio cible ≠ ratio source > 1 %) ;
`POST /upscale` accepte `target_width`/`target_height` pareillement.

- Chemin : **génération native 896×512** (étape 1) → prompt séparé
  `LTXVLatentUpsampler` (modèle officiel spatial-upscaler 0.9.8) **×2 passes
  en espace latent** + `VAEDecodeTiled` (étape 2). Paramètre adaptateur :
  `upscale_4x: true` (enchaîne les 2 étapes) ou `POST /upscale` (étape 2
  seule). Monoprompt interdit : OOM (cf §4bis).
- **Native : 896×512 → Finale : 3584×2048** (2× par passe, multiples de 32).
- C'est un **AGRANDISSEMENT**, PAS une génération 4K native : les détails fins
  ne dépassent pas la résolution source. Le vrai 4K natif local n'est pas
  atteignable avec LTXV 13B en 48 Go (et LTX-2 local écarté, cf licences).

Résultats mesurés : voir §4bis (à compléter après le run — fichier
`/tmp/upscale4k.json`).

## 4bis. Mesures 4K (run du 2026-09-19)

### Premier essai — monoprompt : ÉCHEC (OOM)

Chaîne `gén + 2×LTXVLatentUpsampler + VAEDecode` dans UN seul prompt :
sampling 8/8 OK (3 min 07 s) puis **kill silencieux du process pendant le
1er passage upscaler** (pas de traceback = SIGKILL jetsam macOS). Cause :
résidents cumulés T5 18 Go + ckpt 24,9 Go + VideoVAE 2,4 Go + tenseurs
vidéo ≈ 46+ Go / 48 Go utiles.

### Correctif : pipeline en 2 étapes (implémenté dans l'adaptateur)

1. Étape 1 = génération native (T5 + ckpt chargés, puis libérés).
2. Étape 2 = prompt séparé : `LoadVideo → GetVideoComponents → VAEEncode →
   LTXVLatentUpsampler ×2 → VAEDecodeTiled(512/64/64/8) → SaveVideo`.
   Résidents étape 2 : VAE 2,4 Go + upscaler 0,24 Go seulement.
   `POST /upscale {input_file, passes}` expose l'étape 2 seule ; `upscale_4x:true`
   du POST / enchaîne automatiquement les 2 étapes.

VAE standalone requis (le ckpt ne peut pas servir) : Lightricks ne publie que
le format diffusers (`vae/diffusion_pytorch_model.safetensors` → KeyError
`post_quant_conv.weight` dans ComfyUI). **Extrait localement depuis le ckpt
fp8** : 229 tenseurs `vae.*` → `models/vae/ltxv_vae-0.9.8.safetensors`
(2 493 857 212 o, script jetable venv).

### Résultat mesuré — upscale seul (2026-09-19, fichier inspecté)

Entrée : `sutra-native.mp4` = le rendu natif 896×512 du §3 (89 frames).

| Mesure | Valeur |
|---|---|
| Fichier | `~/purama/sutra-local-renders/upscale4k.mp4` — 4 289 617 o |
| Conteneur (ffprobe) | h264, **3584×2048**, 16 fps, **89 frames, 5,5625 s**, pas de piste audio |
| Temps compute (adaptateur) | **120 169 ms = 2 min 00 s** (cold : VAE+upscaler chargés pendant le run) |
| Mémoire | Étape 2 : ~5 Go de modèles résidents ; **aucun OOM** (vs kill monoprompt) |

### Vérification visuelle (frames 1/45/89 + crop zoom ×2 vs natif)

- Scène **cohérente début→fin**, identique au natif : plage au coucher du
  soleil, soleil sur l'horizon, vagues, reflets dorés. Aucune dérive.
- **Aucun artefact de tuiles** (VAEDecodeTiled 512/64 : aucune seam visible,
  ni pleine image ni zoom ×2), aucun scintillement, aucune zone noire.
- Crop comparé au même plan du natif (×2 chacun) : le 4K est **visiblement
  plus lisse** (vagues continues, bords propres) vs natif pixellisé —
  agrandissement réel, mais **aucun détail inventé** (cf §4 : pas du 4K natif).
- Défauts hérités du natif inchangés : « phare » = forme organique, pas de
  tempête visible (prompt engineering, cf §3).

### E2E complet `POST / {upscale_4x:true}` (chemin production local-engine)

Run final 2026-09-19 16:05, adaptateur corrigé (sortie ciblée sur le nœud
`save` — cf ERRORS.md) :

| Mesure | Valeur |
|---|---|
| Fichier | `~/purama/sutra-local-renders/e2e4k.mp4` — 4 001 972 o |
| Conteneur (ffprobe) | h264, **3584×2048**, 16 fps, **89 frames, 5,5625 s**, pas d'audio |
| Temps compute total (étape 1+2, adaptateur) | **429 486 ms = 7 min 09 s** (rechargement T5+ckpt inclus) |
| Mémoire pic ComfyUI (échantillonnée 5 s) | **17,5 Go / 48 Go** — aucun OOM |
| Sortie JSON | `video_url` → fichier étape 2 (`type=output`) ✓, `generator` = ckpt + upscaler 2 passes 2-stage |

Frame 45 inspectée : même scène cohérente, aucun artefact (seed aléatoire →
disposition des vagues différente du run précédent, normal).

## 5. Limites restantes (honnête)

1. **Pas d'audio** : LTXV 0.9.8 ne génère aucune piste son. SUTRA doit garder
   sa chaîne voix/musique existante et muxer après coup (ffmpeg déjà prévu).
2. **Résolution native max ~896×512** (grille WAN). Le « 720p » local est donc
   en dessous du 720p externe ; l'upscalé 4K agrandit sans inventer de détail.
3. **T5 fp32 19 Go** : pic mémoire dominant. Optimisation possible = conversion
   fp16 (~9,5 Go) non faite (risque de régression qualité non mesuré).
4. **Cold start ~4-5 min** (chargement 35 Go de poids) ; ComfyUI doit rester
   up pour un usage fluide. Pas de 4K « natif », pas de batch parallèle testé.
5. **Fidélité prompt** : cf §3 — prompts courts FR → scène plausible mais pas
   toujours le sujet demandé.
6. **Vercel DEPLOYMENT_DISABLED** (flotte) : blocage déploiement inchangé,
   indépendant du moteur local. Migration v10 NON appliquée en production.

## 6. Reproduire

```bash
# 1. ComfyUI (déjà installé ~/purama/ComfyUI)
cd ~/purama/ComfyUI && source venv/bin/activate
python main.py --port 7860 --listen 127.0.0.1   # pid -> /tmp/comfyui.pid

# 2. Adaptateur (repo sutra, worktree qualité)
node scripts/comfyui-engine-server.mjs 7861 127.0.0.1:7860   # /tmp/adapter.pid

# 3. Côté SUTRA (owner uniquement)
LOCAL_ENGINE_ENABLED=true LOCAL_VIDEO_API_URL=http://127.0.0.1:7861 \
LOCAL_ENGINE_MODE=strict

# 4. Test direct de l'adaptateur
curl -s localhost:7861/health
curl -s -X POST localhost:7861 -d '{"prompt":"...","width":896,"height":512,
  "num_frames":25,"fps":16,"steps":8,"upscale_4x":false}'

# 5. Upscale seul d'une vidéo existante (input dir ComfyUI)
cp ma_video.mp4 ~/purama/ComfyUI/input/
curl -s -X POST localhost:7861/upscale -d '{"input_file":"ma_video.mp4","passes":2}'

# 6. Export UHD exact en un appel (3 étapes auto, cf §4ter)
curl -s -X POST localhost:7861 -d '{"prompt":"...","width":1024,"height":576,
  "num_frames":89,"fps":16,"steps":8,"upscale_4x":true,
  "target_width":3840,"target_height":2160}'
```

Checklist benchmark mission 8 : items 1-2 réalisés (e2e + clip mesuré) ;
item 3 (upscale) = **RÉALISÉ** (§4bis : upscale seul 2 min 00 s, e2e 7 min 09 s,
3584×2048 inspecté) ; item 4 (comparaison coût) : local ≈ 0 €/clip
(électricité seule) vs LTX API fast 720p 0,03 $/s → 5,56 s ≈ 0,17 $/clip.
