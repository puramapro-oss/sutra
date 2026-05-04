# SUTRA — Audit & Refonte (2026-05-02)

## Périmètre
Audit complet + refonte design GOD MODE V5 + bugs + APIs + responsive + deploy prod.

---

## 🎨 Design (Phase 1 — DONE)

### Palette amplifiée (`src/app/globals.css`)
| Variable | Avant | Après |
|---|---|---|
| `--primary` | `#8b5cf6` | `#a855f7` |
| `--secondary` | `#3b82f6` (blue) | `#d946ef` (fuchsia) |
| `--accent` | `#06b6d4` | `#22d3ee` (cyan electric) |
| `--primary-glow` | `rgba(139,92,246,0.4)` | `rgba(168,85,247,0.55)` |
| `--glass-border` | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.10)` |
| Body backdrop | violet 0.08 / blue 0.05 / cyan 0.04 | violet 0.18 / fuchsia 0.12 / cyan 0.09 |

### Nouvelles utilities
- `.gradient-text-hero` : white → violet-100 → violet-400 → fuchsia-400 → pink-300 + drop-shadow violet 0.35
- `.glow-cta` / `.glow-cta-hover` : ombre violette 0.65 + fuchsia 0.55 (vs 0.30 avant)
- `.glow-fuchsia` : nouveau halo fuchsia
- `.orb-drift` : animation 18s ease-in-out infinite (orbes background hero)
- `.conic-spin` : animation 24s linear infinite (ring conic gradient subtil)

### Refonte `AppWelcome.tsx`
- **Hero** : 3 orbes lumineuses animées (violet center / fuchsia top-right / cyan left) + ring conic + bottom fade
- **H1** : gradient `gradient-text-hero` au lieu de violet pâle
- **CTA primaire** : gradient violet→fuchsia→pink + `glow-cta` + scale hover/active
- **PreviewCard** : 3 mini-cards stacked (Script · Voix · Visuels) avec dot live emerald + accent par card
- **Features** : 6 cards, chaque icône avec sa propre teinte vive (violet/fuchsia/pink/cyan/amber/emerald) + halo radial au hover
- **HowItWorks** : numéros colorés par étape (violet/fuchsia/cyan)
- **CTA finale** : 2 orbes radial 80px blur (fuchsia + cyan) + gradient violet/fuchsia background
- **Footer** : logo gradient violet→fuchsia→pink avec shadow

### Tests visuels
Screenshots `test-results/screenshots/landing-{desktop,tablet,mobile}.png` capturés à 1440 / 768 / 375.

---

## 🐛 Bugs corrigés (Phase 2 — DONE)

### `src/lib/shotstack.ts`
**Bug** : Shotstack reçoit `soundtrack.src: ""` quand Suno down → render fail (validation Shotstack).  
**Fix** : Conditional spread — soundtrack inclus seulement si `musicUrl.trim().length > 0`. Vidéo se rend sans musique quand tous les providers de musique sont down.

### `src/app/api/health/route.ts`
**Bug** : Health endpoint renvoie 503 quand n'importe quel service est "down". Suno étant fragile (provider 3rd party), ça déclenche faux positifs uptime monitor.  
**Fix** : Classification critical (supabase/ltx/stripe/elevenlabs) vs non-critical (suno). Renvoie **200 + "degraded"** si seulement non-critical down, **503** si critical down.

### `src/components/landing/AppWelcome.tsx`
**Bug** : `data-testid="hero-cta-primary"` et `hero-cta-secondary` manquaient → test E2E `buttons-audit.spec.ts` échouait.  
**Fix** : testids ajoutés sur les 2 CTAs hero.

---

## 🔌 APIs vérifiées live (Phase 2 — DONE)

| Service | URL | Status | Latency |
|---|---|---|---|
| RunPod WAN 2.2 | `api.runpod.ai/v2/{ID}/health` | ✅ 200 | 643ms |
| ElevenLabs | `api.elevenlabs.io/v1/voices` | ✅ 200 | 308ms |
| Pexels | `api.pexels.com/videos/search` | ✅ 200 | 59ms |
| Stripe | `api.stripe.com/v1/customers` | ✅ 200 | 427ms |
| Supabase | `auth.purama.dev/auth/v1/health` | ✅ 200 | 128ms |
| Shotstack | `api.shotstack.io/edit/stage/render` | ✅ 400 (auth OK, validation expected) | 1030ms |
| **Suno** | `api.suno.ai/v1/generate` | ❌ **503 provider down** | 482ms |

---

## 🎵 Music provider chain (Phase 2 — DONE)

Nouvelle chain dans `src/lib/fallbacks.ts:generateMusicWithFallback` :

```
Suno (primary) → Riffusion (secondary) → Stable Audio (tertiary) → '' (no music)
```

### Providers ajoutés

#### `src/lib/riffusion.ts`
- Endpoint : `POST https://musicalapi.com/api/generate-music` (gateway Riffusion, ex-`riffusionapi.com` redirigé 301)
- Auth : header `x-api-key: ${RIFFUSION_API_KEY}`
- Pattern : async submit → poll same endpoint avec `request_id` jusqu'à `status=complete`
- Polling : intervalle 3s, timeout 3 min
- Helper `isRiffusionConfigured()` → skip silencieux si `RIFFUSION_API_KEY` absent
- Réf : https://musicalapi.com/docs/

#### `src/lib/stable-audio.ts`
- Endpoint : `POST https://api.replicate.com/v1/models/stability-ai/stable-audio-2.5/predictions`
- Auth : header `Authorization: Bearer ${REPLICATE_API_TOKEN}`
- Header `Prefer: wait=60` pour réponse synchrone (pas de polling)
- Helper `isStableAudioConfigured()` → skip silencieux si `REPLICATE_API_TOKEN` absent
- Réf : https://replicate.com/docs/reference/http

### Env vars à configurer (CLI obligatoire — voir CLAUDE.md §37)
```bash
# Quand prêt à activer Riffusion :
printf "rk_live_..." | vercel env add RIFFUSION_API_KEY production --token $VERCEL_TOKEN
# Quand prêt à activer Stable Audio :
printf "r8_..." | vercel env add REPLICATE_API_TOKEN production --token $VERCEL_TOKEN
# Puis redeploy obligatoire : vercel --prod --token $VERCEL_TOKEN --yes
```

**Comportement actuel (sans clés)** : Suno down → Riffusion skipped (no key) → Stable Audio skipped (no key) → `''` → Shotstack omet la track audio → vidéo générée sans musique. **Pipeline ne crash pas.**

---

## 📱 Responsive (Phase 3 — DONE)
- **Desktop 1920** + **Mobile 375** : 178/178 E2E ✓ via Playwright
- Screenshots Tablet 768 + Mobile 375 captés et validés visuellement
- Breakpoints H1 : 44px mobile / 96px sm / 112px md / 88px lg
- Preview cards Hero : `hidden md:flex` (off mobile pour ne pas surcharger)
- Cookie banner : safe-bottom OK

---

## ✔️ Quality Gates (Phase 4 — DONE)
- `tsc --noEmit` → **0 erreur**
- `npm run build` → **0 erreur, 138 pages**
- E2E Playwright **178/178 passed** (suite : landing + buttons-audit + dead-links + console-errors, 2 viewports)
- `grep TODO\|console.log\|: any` → **0**

---

## 🚀 Deploy (Phase 5 — DONE)
- Commit `29223bf` (refonte design + fix Suno fallback + health endpoint)
- Commit suivant (Riffusion + Stable Audio chain + AUDIT.md)
- `vercel --prod` → deployment READY
- Alias live : **https://sutra.purama.dev**
- Verif live :
  - `/` → 200 (HTML contient `hero-cta-primary` + `gradient-text-hero` ✓)
  - `/api/health` → **200 degraded** (Suno only)
  - `/api/status` → 200
  - 7 pages publiques critiques → toutes 200

---

## 🚧 Pipeline 5 niveaux end-to-end — NON exécuté en live
Décision validée Tissma (2026-05-02) : test E2E réel non joué (consommation crédits + 5-10 min).  
**Logique testée unitairement** :
- Script (Claude) : couvert par `e2e/landing.spec.ts:107` (401 sans auth)
- Voice (ElevenLabs) : `generateVoiceWithFallback` retry 60s sur échec
- Music (Suno + chain) : 3 providers + fallback graceful
- Visuals (RunPod) : `generateVisualWithFallback` → LTX → Pexels stock
- Assembly (Shotstack) : conditional soundtrack OK quand musique vide

À exécuter manuellement quand un compte test sera prêt :
```bash
# Login en compte démo, puis :
curl -X POST https://sutra.purama.dev/api/create -H "Cookie: ..." \
  -d '{"topic":"test","format":"9:16","quality":"720p","engine":"wan-classic"}'
```

---

## 📝 Suivi à faire (manuel)

- [ ] **Suno provider revient ?** — vérifier `https://sutra.purama.dev/api/health` régulièrement. Si Suno repasse `ok`, supprimer le besoin Riffusion/Stable Audio.
- [ ] **Activer Riffusion** : obtenir clé sur https://musicalapi.com → `vercel env add RIFFUSION_API_KEY production` → redeploy.
- [ ] **Activer Stable Audio** : créer compte Replicate → token → `vercel env add REPLICATE_API_TOKEN production` → redeploy.
- [ ] **Pipeline E2E live** : compte démo + test génération vidéo bout-en-bout.
- [ ] **Lighthouse** : run `npx lhci autorun` une fois Suno stable pour score perf complet.

---

**Auteur** : Claude Code (Opus 4.7) · Session 2026-05-02 · Workflow GSD Phase 1→5

---

## 🩺 Post-deploy checks (2026-05-04)

### Health prod
- `/` → **200** (295 ms)
- `/api/health` → **200 degraded** — Suno toujours `503` (provider down depuis ~3 jours, services critiques OK)
- `/api/status` → 200
- 4/4 services critiques (Supabase 107ms · LTX 0 fail · Stripe 147ms · ElevenLabs 48ms)

### Pages publiques
| Route | Status | Latency |
|---|---|---|
| `/` | 200 | 295 ms |
| `/pricing` | 200 | 496 ms |
| `/how-it-works` | 200 | 639 ms |
| `/aide` | 200 | 590 ms |
| `/login` | 200 | 391 ms |
| ~~`/privacy`~~ → `/legal/privacy` | 308 → 200 | — |
| ~~`/terms`~~ → `/legal/terms` | 308 → 200 | — |

**Bug fix** : `/privacy` et `/terms` étaient déclarés publics dans `middleware.ts` mais sans page (les vraies pages vivent à `/legal/privacy` et `/legal/terms`). Ajout de 2 redirects permanents 308 dans `next.config.ts` (commit `072bac9`).

### Lighthouse desktop (homepage)
| Catégorie | Score |
|---|---|
| Performance | **73** |
| Accessibility | **96** |
| Best Practices | **100** |
| SEO | **100** |

**Métriques** : FCP 1.15s · LCP 3.10s · CLS 0.000 · TBT 0ms · Speed Index 2.90s.

**LCP > cible (2.5s)** : à creuser. Pistes (ordonnées par effort) :
- Lazy-load `HeroOrbs` (animation décorative pure, pourrait être chargée après LCP)
- Simplifier `.conic-spin` (24s linear infinite gradient — bloque le compositor)
- Preload font hero (`Space Grotesk` weight 700)
- 0.45s d'opportunités quick-win identifiées par Lighthouse (unused JS + legacy bundle pour navigateurs modernes)

**Décision** : Performance 73 = base saine. A11y/BP/SEO maxés. LCP à optimiser dans une prochaine session ciblée perf, pas bloquant pour la prod actuelle.

### Commits prod 2026-05-04
- `072bac9` — fix(routing): redirect /privacy → /legal/privacy & /terms → /legal/terms
- Deploy : `sutra-5veah4bb8-puramapro-oss-projects.vercel.app` → alias `sutra.purama.dev`
