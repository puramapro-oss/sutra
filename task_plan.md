## Goal
SUTRA V2 — LTX 2.3 + Production Wizard + Partenariat + Multi-langue + Resilience

## Phases
- [x] Phase 1: LTX-2.3 video engine (src/lib/ltx.ts) — text-to-video, image-to-video, retake, extend, circuit breaker, WAN 2.2 fallback
- [x] Phase 2: Update /create page — engine selector UI (Rapide/Cinema/Classique), portrait 9:16, 4K gating
- [x] Phase 3: /api/health endpoint — checks all services (Supabase, LTX, Stripe, ElevenLabs, Suno)
- [x] Phase 4: /dashboard/production wizard — 7-step pipeline, 5 templates (YouTube/TikTok/Reel/Docu/Tuto), POST /api/production
- [x] Phase 5: Partnership module complet — SQL schema, 7 API routes, 6 pages (public + dashboard + admin)
- [x] Phase 6: Multi-langue next-intl 16 langues — fr.json + en.json complets, 14 stubs, cookie-based locale
- [x] Phase 7: Build 0 erreur, tsc 0 erreur

## Decisions
- LTX API is synchronous (returns MP4 directly) — no polling needed unlike RunPod
- Circuit breaker pattern: 3 failures → 60s cooldown → auto-fallback to WAN 2.2
- next-intl without routing (no [locale] segment) — locale via cookie sutra_locale
- Partnership uses 7 SQL tables with RLS, anti-fraud (IP limit, 14j delay)
- Production wizard supports both step-by-step and "generate all" modes

## Errors
(none)

## Files Created/Modified
### New files:
- src/lib/ltx.ts — LTX 2.3 video engine
- src/app/api/health/route.ts — Health check endpoint
- src/app/api/production/route.ts — Production pipeline API
- src/app/(dashboard)/production/page.tsx — Production wizard UI
- src/app/api/partner/register/route.ts — Partner registration
- src/app/api/partner/scan/[code]/route.ts — QR/NFC scan tracking
- src/app/api/partner/stats/route.ts — Partner stats
- src/app/api/partner/commissions/route.ts — Commission list
- src/app/api/partner/payout/route.ts — Payout request
- src/app/api/partner/coach/route.ts — AI coach chat
- src/app/api/partner/qr/[code]/route.ts — QR code generation
- src/app/partenariat/page.tsx — Public partner landing
- src/app/partenariat/[canal]/page.tsx — Channel registration form
- src/app/scan/[code]/page.tsx — Scan landing + redirect
- src/app/(dashboard)/partenaire/page.tsx — Partner dashboard
- src/app/(dashboard)/partenaire/coach/page.tsx — AI coach chat UI
- src/app/(dashboard)/partenaire/outils/page.tsx — Partner tools
- src/app/api/locale/route.ts — Locale switching API
- src/i18n/request.ts — next-intl config
- messages/fr.json, en.json + 14 stubs
- sql/partnership.sql — Partnership schema

### Modified files:
- src/lib/constants.ts — Added VIDEO_ENGINES, LTX timeout
- src/lib/fallbacks.ts — LTX as primary, WAN 2.2 fallback
- src/app/api/create/route.ts — Updated to use new fallbacks signature
- src/app/(dashboard)/create/page.tsx — Engine selector UI
- src/components/layout/Sidebar.tsx — Added Production + Partenariat links
- src/middleware.ts — Added public routes for partnership
- src/app/layout.tsx — NextIntlClientProvider wrapper
- next.config.ts — next-intl plugin
