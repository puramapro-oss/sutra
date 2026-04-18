## Goal
SUTRA V3 — CLAUDE.md V3 ULTIMATE full feature set

## Phases
- [x] Phase 1: LTX-2.3 video engine
- [x] Phase 2: Engine selector UI
- [x] Phase 3: Health endpoint
- [x] Phase 4: Production wizard
- [x] Phase 5: Partnership module
- [x] Phase 6: Multi-langue 16 langues
- [x] Phase 7: Build 0 erreur
- [x] Phase 8: V3 SQL migration (40+ tables: points, daily gift, boutique, achievements, lottery, community, viralite, notifications, emails, feedback, coupons)
- [x] Phase 9: Points + Daily Gift + Boutique APIs + Pages
- [x] Phase 10: Community d'Amour (wall, circles, buddy, missions) APIs + Page
- [x] Phase 11: Contest 10 winners (weekly 6%CA, monthly 4%CA) + Lottery tickets
- [x] Phase 12: Email sequences CRON (10 types) + Streak multiplier CRON
- [x] Phase 13: Notification settings IA adaptive + Confetti component
- [x] Phase 14: Build 0 erreur, tsc 0 erreur
- [x] Phase 15: Deploy Vercel + verify live (sutra.purama.dev → 200, /api/status → 200)
- [x] Phase 16: Playwright E2E tests (846 passed, 0 failed, 3 viewports: 1920/768/375)
- [x] Phase 17: P7 MOBILE — Expo iOS+Android (34 screens, 10 Maestro tests, icons, store config 16 langues, EAS workflows)
- [x] Phase 18: /financer wizard 4 etapes + 45 aides seed DB + bandeau pricing + API
- [x] Phase 19: Couche spirituelle (SpiritualLayer, SubconsciousEngine, useAwakening, useEmpowerment, awakening.ts, 30 affirmations DB)
- [x] Phase 20: Pages manquantes (/confidentialite RGPD, /invoices factures, /devenir-influenceur, sidebar Factures+Aide)
- [x] Phase 21: /classement-points page (top 50 users, rank card, levels, streaks)
- [x] Phase 22: Popup conversion (triggers: credits low, 3rd login, pending earnings, 7j cooldown, 1/session)
- [x] Phase 23: Chatbot SAV (deja existant — /help + /api/chatbot complet)
- [x] Phase 24: Daily Gift animation coffre (tremble + glow + streak progress dots)
- [x] Phase 25: ShareableCard composant (story 9:16, 6 platforms, native share, +300pts)
- [x] Phase 26: i18n 16 langues (22 sections/langue, locale switcher settings, API /api/locale)
- [x] Phase 27: QA 21 SIM — Playwright E2E (873 passed, 0 failed, 12 skipped, 3 viewports)
- [x] Phase 28: Lighthouse (landing 84, /pricing 90, /financer 92, accessibility 90-100, SEO 92-100)
- [x] Phase 29: P7 Mobile Expo update — 5 new screens (financer, invoices, classement-points, guide, auto), 39 tsx total, 12 Maestro tests, GitHub Actions workflow, tsc 0, export 961 modules

## KARMA LIGHT (Session 2026-04-18) — APPROCHE B validée
Scope activé (12 features) : NAMA-Muse, Roue du Dharma, Défi Collectif, Tournoi Karma, Jeu Créatif, La Vague, Quête Rare, Lightning Deals, Graines cross-apps, niveaux Sanskrit, parrainage N1/N2/N3 existant, ambassadeurs existant, pricing 9,99€ existant.
Scope exclu (confirmé) : TERRA NOVA IRL, NAMA-VIDA santé, KYC Onfido, Ordonnance Verte, Jackpot Terre, Bloom, Mission Solidaire, Miroir binôme, Shadow Work.

- [x] F1: NAMA-Muse coach créatif (src/lib/nama-muse.ts + /api/ai/chat branché buildMuseSystem)
- [x] F2: Migration SQL v7_karma_light.sql (14 tables, RLS, 15 missions + 1 défi seed)
- [x] F3: /api/karma/seeds + karma-level.ts (Novice→Mahatma) + useSeeds + SeedsBalance
- [x] F4: /api/karma/missions + page /karma/missions (5 catégories, today/week limits)
- [x] F5: /api/karma/games/dharma + page /karma/dharma (wheel SVG 12 segments, animation cubic)
- [x] F6: /api/karma/games/defi + CRON karma-defi + page /karma/defi-collectif
- [x] F7: /api/karma/games/tournoi + CRON karma-tournoi + page /karma/tournoi (7 piliers créatifs)
- [x] F8: /api/karma/games/creatif + /vote + page /karma/jeu-creatif (48h voting)
- [x] F9: /api/karma/games/vague + page /karma/vague (cascade ×2 niveau 1-10, 50→25600 seeds)
- [x] F10: /api/karma/games/quete + page /karma/quete-rare (streak 21j, 21000 seeds completion)
- [x] F11: /api/karma/games/lightning + claim + CRON + page /karma/lightning (10 min flash)
- [x] F12: Page /karma hub (SeedsBalance + 8 cards + transactions) + Sidebar lien KARMA (icône Sprout)
- [x] F13: Tests E2E Playwright karma.spec.ts (19 scénarios × 3 viewports = 57 passed) + tsc 0 + build 0
- [x] F14: Deploy Vercel prod (dpl_7tPHkvCC1UCgp7BqoWqggAzeNJvT READY, alias sutra.purama.dev) + smoke OK (/api/karma/seeds → 401, /api/status → 200, homepage → 200)

## État actuel session fin 2026-04-18
- Build local: tsc 0 erreur, npm run build OK (14 routes KARMA compilées)
- DB VPS: migration v7_karma_light.sql exécutée (14 tables, 15 missions seed, 1 défi courant seed "Lumière intérieure")
- Commits: 12 feat(karma-light) atomiques, tous pushés sur main
- Contexte session 1 > 80% → handoff propre

## Pour la session F13 + F14
1. Lire task_plan.md + progress.md
2. Créer e2e/karma.spec.ts avec 9 scénarios :
   - GET /api/karma/seeds sans auth → 401
   - GET /api/karma/missions sans auth → 401
   - /karma redirect /login si non authentifié
   - /karma/missions redirect /login si non authentifié
   - /karma/dharma redirect /login si non authentifié
   - /karma/defi-collectif redirect /login si non authentifié
   - /karma/tournoi redirect /login si non authentifié
   - /karma/jeu-creatif, /karma/vague, /karma/quete-rare, /karma/lightning redirects
   - Vérif HTML contient "KARMA" sur homepage dashboard après login
3. npm run build → 0 erreur
4. vercel --prod --token $VERCEL_TOKEN --scope puramapro-oss --yes
5. curl sutra.purama.dev → 200
6. curl sutra.purama.dev/karma → 307 redirect /login (OK car protected)
7. Update progress.md + cocher F13 F14
8. Commit final "deploy(karma-light): production live"

## Decisions
- Contest weekly: 10 winners, score-based (parrainages×10 + abos×50 + entries×5)
- Contest monthly: 10 winners, random tirage via lottery_tickets
- Points auto-conversion at milestones (25K→2.50€, 50K→5€, etc.)
- Streak multiplier: x1(D1-6), x2(D7-13), x3(D14-29), x5(D30-59), x7(D60-99), x10(D100+)
- Daily gift: 7 tiers with probability distribution, streak 7+ guarantees minimum -10% coupon

## Files Created (Phase 8-14)
### SQL:
- migrations/v3_features.sql

### APIs:
- src/app/api/points/route.ts
- src/app/api/daily-gift/route.ts
- src/app/api/boutique/route.ts
- src/app/api/achievements/route.ts
- src/app/api/community/wall/route.ts
- src/app/api/community/wall/react/route.ts
- src/app/api/community/circles/route.ts
- src/app/api/community/circles/join/route.ts
- src/app/api/community/buddy/route.ts
- src/app/api/community/buddy/checkin/route.ts
- src/app/api/share/route.ts
- src/app/api/lottery/route.ts
- src/app/api/feedback/route.ts
- src/app/api/cron/email-sequences/route.ts
- src/app/api/cron/streak-update/route.ts

### Pages:
- src/app/(dashboard)/boutique/page.tsx
- src/app/(dashboard)/achievements/page.tsx
- src/app/(dashboard)/community/page.tsx
- src/app/(dashboard)/lottery/page.tsx
- src/app/(dashboard)/settings/notifications/page.tsx
- src/app/contact/page.tsx

### Components:
- src/components/shared/Confetti.tsx

### Modified:
- src/components/layout/Sidebar.tsx (new nav items)
- src/middleware.ts (/contact public)
- src/app/api/cron/contest-weekly/route.ts (10 winners, 6%CA)
- src/app/api/cron/contest-monthly/route.ts (10 winners, 4%CA, lottery)
