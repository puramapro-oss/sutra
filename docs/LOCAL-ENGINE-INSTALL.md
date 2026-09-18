# Moteur vidéo local — M4 Max 48 Go : plan d'installation vérifié

> État : **PRÉPARÉ, rien d'installé** (aucun achat, aucun appel payant, aucun
> téléchargement lancé). Document de décision + procédure. Date des vérifications :
> septembre 2026. Contrat d'intégration SUTRA déjà implémenté et testé
> (`src/lib/local-engine.ts`, stub + e2e 3/3).

## 0. Décision recommandée (résumé)

| Besoin | Choix | Pourquoi |
|---|---|---|
| Génération **native** (≤720p, 5–10 s) | **ComfyUI + LTX-Video 13B distilled** | Apache-2.0 pur (usage commercial OK), fonctionne sur Apple Silicon via PyTorch MPS, cohérent avec l'API LTX externe déjà intégrée (mêmes sémantiques qualité/durée) |
| **Agrandissement 4K** | **Real-ESRGAN 4x** (BSD-3) | Licence commerciale OK, léger sur Mac ; SUPIR EXCLU (licence non-commerciale) |
| Alternative légère (zéro Python) | Draw Things (App Store, gratuit) | Natif Swift/Metal+CoreML, serveur gRPC headless disponible ; vidéo confirmée (Hunyuan), **Wan non confirmé** → second choix |

**Pourquoi pas Wan 2.2 en primaire** : le workflow ComfyUI « Wan 2.2 14B Text to
Video » est documenté cassé sur Apple Silicon (issue comfyanonymous/ComfyUI
#9255, août 2025) ; contournements = quants GGUF instables. LTX-Video est le
chemin le plus court et le plus sûr sur M4 Max.

**Pourquoi pas LTX-2/LTX-2.5 local en primaire** : natif 4K@50fps séduisant,
MAIS (1) erreurs récurrentes du workflow LTX-2 dans ComfyUI Desktop sur Apple
Silicon (issue #386, janv. 2026) et (2) licence duale des poids LTX-2.3 :
entités ≥ 10 M$ de CA annuel → licence commerciale payante (Hugging Face, mars
2026). LTX-Video (2B/13B) reste Apache-2.0 sans clause de CA.

## 1. Compatibilité vérifiée

- **ComfyUI** : support macOS Apple Silicon **natif via PyTorch MPS** (docs
  officielles système ; PyTorch ≥ 2.7, builds stables incluent MPS — nightly
  inutile). Limites béta connues vs CUDA (forum ComfyUI 2026) : perf réduite,
  certains nodes CUDA-only indisponibles. Workaround MPS récent documenté
  (avril 2026, patch 2 composants) si besoin.
- **LTX-Video** (Lightricks) : dépôt officiel Apache-2.0, variantes **2B et
  13B** ; workflows ComfyUI tournent sur MacBook Pro M4 (retours HF nov. 2024 →
  2026, qualité première passée de bruitée à correcte avec les versions
  distilled).
- **Real-ESRGAN** : BSD-3-Clause (usage commercial explicite OK), modèle 4x
  ~65 Mo, GAN léger — le seul upscaler qualité raisonnable sur mémoire unifiée
  Mac (SUPIR = SDXL-diffusion, non-commercial + très lourd → exclu pour un
  produit commercial).
- **M4 Max 48 Go** : 13B fp8 + encodeur T5 offlogeable en mémoire unifiée
  (budget ~30–40 Go). Ordre de grandeur attendu : quelques minutes par clip de
  5 s en 768×512 (à BENCHMARKER, aucune promesse de perf).

## 2. Licences (produit commercial PURAMA — synthèse)

| Composant | Licence | Commercial |
|---|---|---|
| ComfyUI | GPL-3.0 | OK (processus local séparé, non lié au code SUTRA) |
| LTX-Video 13B distilled (poids) | Apache-2.0 | OK sans condition de CA |
| LTX-2.3 (poids récents) | Duale : Apache-like SI CA < 10 M$, sinon payant | ⚠️ à éviter tant que non clarifié |
| Real-ESRGAN | BSD-3-Clause | OK (attribution à la redistribution) |
| SUPIR | Non-commercial uniquement | ❌ EXCLU |
| Draw Things (app) | Gratuite, code non entièrement ouvert (binaires gRPC publiés) | OK usage ; vérifier avant redistribution |

## 3. Espace disque et téléchargements (à lancer toi-même — rien n'est lancé)

**Prérequis disque : ~35 Go libres** (recommandé 45 Go de marge).

| Élément | Taille approx. | Source |
|---|---|---|
| ComfyUI + venv Python 3.11 + PyTorch 2.7+ (MPS) | ~6 Go | `git clone` + `pip install torch torchvision` (downloads.pytorch.org) |
| LTX-Video 13B **distilled** (diffusion fp8) | ~9–14 Go | HF `Lightricks/LTX-Video` → fichier `ltx-video-13b-distilled-…safetensors` dans `ComfyUI/models/checkpoints/` |
| Encodeur texte T5-XXL (fp8) | ~5–7 Go | HF `Comfy-Org/LTX-Video` pack (text encoder + workflow officiel) |
| VAE LTX | ~0,4 Go | inclus dans le pack Comfy-Org |
| Real-ESRGAN 4x | ~65 Mo | HF `ai-forever/Real-ESRGAN` → `models/upscale_models/` |
| Workflow JSON LTX t2v | < 1 Mo | templates ComfyUI intégrés |

## 4. Procédure (résumé exécutable)

```bash
# 1. Base
xcode-select --install 2>/dev/null || true
brew install python@3.11

# 2. ComfyUI (natif MPS)
git clone https://github.com/comfyanonymous/ComfyUI.git ~/ComfyUI
cd ~/ComfyUI && python3.11 -m venv venv && source venv/bin/activate
pip install torch torchvision torchaudio   # wheels MPS inclus

# 3. Poids (à télécharger manuellement / hf CLI — ~25 Go au total)
#    - LTX-Video 13B distilled  -> models/checkpoints/
#    - T5-XXL fp8 + VAE + workflow -> pack Comfy-Org/LTX-Video
#    - Real-ESRGAN 4x           -> models/upscale_models/

# 4. Serveur HTTP local sur le contrat SUTRA
python3.11 main.py --port 7860 --listen 127.0.0.1
```

**Pont SUTRA** : le contrat local (`src/lib/local-engine.ts`) attend un serveur
`POST {prompt,width,height,num_frames,fps}` → `{video_url|video_base64}`.
ComfyUI expose son API workflows (`/prompt` + `/history`) : il faut un **adaptateur
HTTP fin (~100 lignes, à écrire)** qui soumet le workflow LTX paramétré puis sert
le mp4. Alternatif : Draw Things et son serveur gRPC (binaire public) si l'app
est installée — adaptateur gRPC→HTTP à écrire aussi.

**Variables SUTRA** (déjà testées en strict/auto) :
```
LOCAL_ENGINE_ENABLED=true
LOCAL_VIDEO_API_URL=http://127.0.0.1:7860
LOCAL_ENGINE_MODE=strict
```
+ `SUPER_ADMIN_EMAIL` routé propriétaire uniquement (clients jamais locaux).

## 5. Génération NATIVE vs agrandissement 4K — distinction honnête

- **Natif LTX-Video 13B distilled** : sorties ~768×512 à 1216×704, 24 fps,
  5–10 s par clip. C'est la qualité native locale MAXIMALE réaliste sur 48 Go.
- **4K « local »** = **2 passes** : génération native (ex. 1216×704) →
  **upscale Real-ESRGAN 4x** (4864×2816) → crop/pad vers 3840×2160 via ffmpeg
  (déjà installé). Ce n'est PAS de la génération 4K native : les détails fins
  ne dépassent pas la résolution source.
- **Statut actuel du code SUTRA** : la grille locale calque wan-classic
  (896×512 en « 720p ») ; un futur `quality: '4k'` local devra router vers la
  passe upscale (pipeline à ajouter APRÈS benchmark). Aucune promesse 4K locale
  tant que le rendu réel n'est pas inspecté (règle maison : jamais de 4K
  déclaré sans fichier mesuré).

## 6. Benchmarks à produire à l'installation (checklist)

1. `npm run test:local-engine-e2e` contre le VRAI moteur (remplace le stub) :
   résolution/durée/A-V mesurés ffprobe + temps de calcul réel.
2. Clip 5 s 768×512, 3 prompts : temps moyen + mémoire (`memory_pressure`).
3. Passe upscale Real-ESRGAN 4x sur ce clip : temps + inspection.
4. Comparaison coût : LTX API fast 720p = 0,03 $/s vs local (électricité).

## 7. Blocages connus (avant installation)

- Aucun moteur présent sur la machine (audit mission 7) → chaque étape §4 reste
  à exécuter manuellement ; ~25 Go de téléchargements gratuits.
- Adaptateur HTTP ComfyUI→contrat SUTRA : à écrire (aucun code n'existe).
- Vercel `DEPLOYMENT_DISABLED` (flotte) — indépendant, à régler côté facturation.
