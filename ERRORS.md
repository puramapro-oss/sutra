# ERRORS.md — sutra

| DATE | BUG | CAUSE | FIX |
|------|-----|-------|-----|
| 2026-09-18 | AUDIT-SUTRA-bbd8e34 : 18 points — export 720p etiquete 1080p/4k ; UI bloquee apres succes /api/create ; script/voix/engine jetes par le schema ; horloge montage incoherente 16/13/20s ; photos en assets video + scenes stock filtrees ; cap 300s vs docu 20min ; durees LTX hors contrat ; quotas contournables (steps, auto) ; limits fail-open DB ; POST rejoues sans idempotence ; cron doublons + publication anticipee + secret facultatif ; audio jamais monte en auto ; /library/[id] et /api/video/export absents ; tarifs fast faux ; qualite plan non plafonnee ; alias voix bruts ; MP4 en miniature | Contrats client/serveur divergents + degradations silencieuses + fail-open budget | Tailles reelles par qualite (4k=2160x3840) + clamp honnete ; hook lit video.id (route synchrone, polling mort supprime) ; schema voice/engine/script valides + script manuel respecte + moteur WAN honore ; horloge montage (durees par clip, intro decale voix+sous-titres, fade repare, fins bornees) ; kind photo -> asset image ; TOUTES scenes resolues en ordre ; long-form 1200s/60 scenes borne ; snapLtxDuration 6-20s + 1:1 -> 16:9 + crop montage ; checkLimits sur steps video/voice/music/assembly + /api/auto/generate + export ; limits fail-closed (erreur DB = refus) ; POST = 1 tentative sauf idempotencyKey (header Idempotency-Key) ; cron : CRON_SECRET obligatoire + unicite (schedule_id,slot) + publication a l'heure prevue + assemblage avant publication (compositing_failed sinon) ; auto/generate assemble aussi ; /library/[id] -> /editor/[id] + /api/video/export implemente (owner + quota) ; grille officielle LTX (fast 1080p = 0.06 USD/s) ; clampQualityToPlan avant tout appel payant ; resolveVoiceProviderId (jamais d'alias brut) ; miniature = image uniquement ; 45 contrats mockes + E2E durcis (lien obligatoire, webhook = 400, CORS wildcard interdit). RESTES : #17 mode local non implemente ; #14 file durable partielle (maxDuration 300 + status failed) ; revocation INSEE manuelle |
| 2026-09-18 | Audit production: clé INSEE réelle commise en commentaire (insee.ts:8) ; fetchWithRetry écrasait le signal appelant (LTX 180s→30s) ; Shotstack ignorait format (9:16/1:1 assemblés en 16:9) et 4k→HD non signalé ; fallback Pexels retourné engine=wan-classic (provenance mensongère) ; Suno/RunPod/ElevenLabs sans vérif res.ok/schéma ; clés lues au top-level (crash import sans env) ; voice fallback sleep 60s | Secret en dur + dégradations silencieuses + timeouts ignorés | Clé retirée (À RÉVOQUER portail-api.insee.fr) ; signal respecté ; output.size par format + outputQuality honnête (DB stocke 1080p si rendu HD) ; VisualResult source=pexels-stock + meta provenance ; res.ok+schémas partout + timeouts polls ; clés lazy via requireEnv (SUTRA_ENV_MISSING) ; retry voix 5s ; circuit breaker par hôte + jitter ; /api/admin/health sondes gratuites ; lib/env.ts + .env.example + 34 tests contractuels mockés |
| 2026-09-18 | Lint 4 erreurs branche codex/sutra-quality-cost-v1 : 2×max-lines (stripe webhook 613L + stripe-fulfillment 618L dupliqués à ~100%) + 2×setState sync dans effect (create/page engine auto-select, FolderModal reset) | Handlers webhook dupliqués byte-à-byte dans 2 routes ; reset/derive state via useEffect | Extraction src/lib/stripe/webhook-{types,checkout,invoices,connect,subscriptions,dispatch}.ts (bodies verbatim, batch upsert prime_payouts 3→1) + dispatch partagé ; FolderModal reset→handleClose ; create/page→pattern render-phase lastPlan. tsc 0, lint 0 erreur, tests 6/6, build ✓ 4.6s |
| 2026-08-24 | Build cassé après extraction create/page (10 erreurs TS) | Extraction incomplète useVideoGeneration hook + ManualForm : (1) `isOverLimit` utilisé avant déclaration L87 vs L93, (2) setters (`setPipelineSteps`, `setVideoId`, `setError`) non retournés par hook, (3) `topic`/`setTopic` manquants dans destructuration ManualForm props, (4) `VideoEngine` importé depuis `@/types` au lieu de `@/lib/ltx` dans create-utils | (1) Déplacer définition `isOverLimit` (L90-93) AVANT appel hook (L65), (2) Ajouter `resetGeneration()` + setters dans return du hook, (3) Ajouter `topic`, `setTopic` dans destructuration ManualForm L36, (4) Corriger import VideoEngine→`@/lib/ltx`. tsc 0 erreur, build ✓ 4.2s. |
| 2026-08-24 | 17 fichiers >300L | Code non modulaire, gros composants monolithiques | Extraction hooks + composants : template-data 433→18L, templates/page 486→235L, voices/page 511→181L, storyboard/page 571→241L, analytics/page 550→72L, publish/page 532→116L, referral/page 623→133L, production/page 617→265L, batch/page 625→121L, **financer/page 578→195L** ✅ (commit efc094c). 4 fichiers réels >300L restants + 2 exclus. |

## Fichiers >300L restants (12 total, 10 à traiter)

**FAIT** ✅ (8 fichiers <300L confirmés):
- ~~storyboard/page.tsx~~ 571→241L (commit 3a6e647)
- ~~analytics/page.tsx~~ 550→72L (commit 1e4f006)
- ~~publish/page.tsx~~ 532→116L (commit fd19e4a)
- ~~referral/page.tsx~~ 623→133L (commit 94ea58c)
- ~~help/page.tsx~~ (commit 528869c, constants extraits)
- ~~production/page.tsx~~ 617→265L (constants + types + 8 composants + hook)
- ~~batch/page.tsx~~ 625→121L (commit ab290b8, useBatch hook + 7 composants)
- ~~financer/page.tsx~~ 578→195L (commit efc094c, 4 steps → composants Step1-4)

**EXCLUS** (webhook Stripe intacts):
- src/app/api/stripe/webhook/route.ts — 613L (NE PAS TOUCHER)
- src/app/api/internal/stripe-fulfillment/route.ts — 618L (NE PAS TOUCHER)

**RESTANTS** (4 à traiter, ordre croissant):
1. src/app/(dashboard)/settings/page.tsx — 777L (hook useSettingsState créé commit e08c936, reste extraction 7 tabs)
2. src/app/(dashboard)/library/page.tsx — 1017L
3. src/app/(dashboard)/editor/[id]/page.tsx — 1120L
4. src/app/(dashboard)/create/page.tsx — 1280L

## Stratégie confirmée

- Extraction systématique en `hooks/use{Feature}.ts` + `components/{feature}/`
- Re-exports pour 0 breaking change
- tsc + commit après chaque fichier
- Ordre croissant de taille
- Dernière mesure réelle wc -l, jamais d'estimation
