# Verification finale post-deploiement — etat prioritaire 2026-10-13

- [x] LOCKS/handoffs/processus/branches/WIP inspectes ; deux auxiliaires libres affectes uniquement aux preuves manquantes.
- [x] Deux defauts publics origine Auth/CSRF reproduits, corriges et couverts par sept regressions.
- [x] CI exacte f770e272 run38330861913 entierement verte ; candidat isole valide.
- [x] Promotion OVH exacte avec snapshot exclusif, runtime/schema inchanges ;28 origine +10 GET +120 SQL PASS.
- [x] Navigateur public desktop/mobile affiche et inspecte ;0 erreur JS et0 debordement.
- [x] Cron/OAuth negatifs et medias publics valides ; preuve inchangee conservee.
- [x] Logs, DB, six empreintes backup, restauration precedente et nouveau snapshot rollback verifies ; DNS/TLS valides.
- [x] Handoff final et preuves prepares ; aucun appel fournisseur payant.
- [ ] Unique blocage externe : adresse d'un compte SUTRA dedie QA pour recette connectee, creation projet, pipeline gratuit, medias prives et SRT. Ne pas creer Authuser global ni emprunter un compte reel.

Les sections suivantes sont historiques ; elles ne remplacent pas ce verdict et cette limite de recette live.

# SUTRA T01 — état final du 2026-10-13

- [x] Secret SMARANA fourni par l’utilisateur ; CI 9b0c2c9 relancée.
- [x] Trois courses de navigation E2E corrigées dans 3591818 ; aucun test désactivé.
- [x] Régression de droits serveur révélée en production, rollback effectué, corrections minimales aaa94f2 et 3e5596e ; droits clients inchangés.
- [x] CI complète du commit `3e5596ea287f36427f687d3f3882d35c3f7c407b` verte ; contrats, médias, sécurité, PostgreSQL, qualité et navigateurs gratuits.
- [x] Sauvegarde cohérente et restauration de 140 tables ; huit migrations x2 sur copie privée ; migrations de production atomiques.
- [x] Candidat Linux exact validé et promu ; contrôles live : 120 SQL + 35 Supabase + 10 GET HTTP/HTTPS PASS.
- [x] Cloudflare DNS-only vers OVH, TLS valide ; snapshot de rollback et Vercel conservés.
- [x] Handoff et preuves finales enregistrés ; 53 worktrees et cinq SHA protégés préservés.

Aucun blocage externe ni action manuelle indispensable pour ce déploiement. Fournisseurs payants et parcours utilisateur authentifié live hors preuve. La branche S5 historique non validée reste exclue ; voir handoff. Les états ci-dessous sont des archives antérieures, remplacées par ce bilan.

---

## État courant 2026-10-13 — prime sur les cases historiques ci-dessous

- [x] Secret SMARANA disponible, CI3591818 complète verte (38320118213).
- [x] Backup/restore136 tables,6 migrations atomiques production, cutover bucket privé.
- [x] DNS Cloudflare sutra →OVH, certificat Let’s Encrypt et5 GET HTTPS PASS.
- [x] Smoke Supabase détecte403 jobs ; rollback applicatif automatique vérifié healthy.
- [x] Régression des privilèges reproduite ; migration corrective minimale et test sans ACL par défaut.
- [x] Défaut identique sur25 tables v3 utilisées : correction serveur bornée et preuve de non-élargissement des droits clients.
- [ ] CI du correctif étendu, sauvegarde fraîche, deux migrations correctives puis déploiement et smoke final.

---

## Reprise CI du 2026-10-13

- [x] Secret GitHub disponible ; CI9b0c2c9 relancée (run38313595126 tentative2).
- [x] Sauvegarde/restore OVH frais :136 tables,6 migrations deux fois, lot atomique validé en copie privée.
- [x] Corriger les3 assertions de navigation prématurées : legacy local1022 PASS,25 SKIP,0 FAIL,0 flaky ; lint ciblé PASS.
- [ ] Obtenir la CI complète verte sur le correctif ; production inchangée.

## Clôture du delta OVH autorisé

- [x] Médias privés durables, contrôles propriétaire et permissions Storage ; gates gratuites fraîches dans HANDOFF-SUTRA-T01-20261012.md.
- [x] Backup cohérent OVH,136 tables restaurées et6 migrations deux fois en copie privée PostgreSQL15.8.
- [x] Image Linux du commit44cdcd53e52633a149cef98f73aa1980ff1a8c25 : cinq GET et FFmpeg PASS, réseau désactivé ; première faute de chemin de sonde corrigée et conservée dans les preuves.
- [x] Rollback applicatif automatique après échec de déploiement/smoke :17 tests Python et6 cas JavaScript isolés. Aucune modification applicative après la gate complète.
- [ ] Blocage externe : SMARANA_READ_TOKEN readonly absent ; CI38312619963 échoue au setup. Unique action manuelle : ajouter le secret GitHub ciblé, sans le partager en conversation.
- [ ] Après CI verte seulement : migrations/cutover de production, remplacement, DNS/TLS, smoke HTTPS. Aucun déploiement ni bascule réalisés ; public Vercel402, ancien OVH healthy.

## Jalon T01 courant — autorisation production, 2026-10-12

- [x] Ownership/WIP/branches/processus/LOCKS réinspectés ;53 entrées étrangères préservées ; sept lots acceptés conservés.
- [x] Références médias privées durables, autorisation propriétaire, capability journal stable, renouvellement des signatures ; tests interutilisateurs et révocations.
- [x] Gates locales gratuites : contrats473/7SKIP, médias34, PostgreSQL13+12+164, typecheck/lint/build197, redteam14, navigateur217/axe165, legacy1022/25SKIP.
- [x] Sauvegarde cohérente et restore136 tables sur copie privée OVH PostgreSQL15.8 ; six migrations testées deux fois.
- [ ] Construire et tester le candidat Linux sans réseau, sans modifier le service actuel.
- [ ] CI distante : SMARANA_READ_TOKEN readonly absent ; action manuelle unique au handoff.
- [ ] Après gates critiques : production SQL, bucket privé, remplacement progressif, DNS/TLS et smoke réels avec rollback.

Source courante : HANDOFF-SUTRA-T01-20261012.md, BATON.md, qa/production-20261012/MATRIX.md. Les cases historiques ci-dessous ne certifient pas la production actuelle.

---

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


## 2026-10-12 — SUTRA T01 CHEF (périmètre courant)

Les instructions historiques ci-dessus restent des archives. Le dernier mandat autorise commit et push sur l'unique branche T01, aucun déploiement ni migration de production.

- [x] Inspection politiques (`POLICY_OK`), deux LOCKS, handoffs, branches/worktrees/processus/WIP ; 47 worktrees étrangers présents préservés.
- [x] Réception des sept livraisons propriétaires et de leurs preuves, deltas revus contre PR3. Matrice complète : `qa/integration-20261012/MATRIX.md`.
- [x] Réconciliation LTX durable, FFmpeg/Shotstack/export, downloader/probe, journal et permissions SQL ; cinq références protégées conservées.
- [x] Raccords UI jobs202/export éditeur et correctifs a11y ; aucune source S5 fusionnée aveuglément.
- [x] Gates contrats427/7 SKIP, média33, SQL13+9+49, qualité typecheck/lint/build, Python9 ; legacy1022 PASS agrégés/25 SKIP. Navigateur203 PASS agrégés/155 audits axe sans violation ; commandes et historique des reprises dans le handoff.
- [x] Recette OVH et rollback préparés et testés sans SSH ; déploiement non exécuté.
- [ ] CI distante du commit poussé : résultat à lire, secret lecture seule SMARANA requis.
- [ ] Release : schéma distant/Docker/OVH/fournisseurs non qualifiés ; limites produit S5 et script/voix explicites dans la matrice.

Statut : intégration locale livrée, release non certifiée. Ne pas rejouer les PASS inchangés. Handoff final : `HANDOFF-SUTRA-T01-20261012.md`.


<!-- Livraison 8e62dde1b3f913bed9fd327ac721e7207f72d7ea -->

## 2026-10-13 — T04 audit fournisseurs, mandat borné

- [x] Politiques/LOCKS/WIP/branche intégrée vérifiés ; POLICY_OK ; worktree T04 isolé depuis48f2d5e,589732c ancêtre.
- [x] Source maître opaque, comparaison Mac/OVH, sondes GET gratuites avec preuves expurgées ; aucune copie de secret. Réserve SSH maître documentée.
- [x] RunPod/Shotstack/Suno/Zernio et OAuth/permissions/state/expiration/révocation audités ; propriétaires respectés, aucune connexion.
- [x] Corrections locales Suno et diagnostic Shotstack ; trois fichiers de tests fournisseurs ; garde anti-preview limitée.
- [x] 483contratsPASS/7SKIP ; TS/lint/build197pagesPASS ; Suno contre-tests T08 désormais2PASS ; quatre OAuthFAIL conservés. Commandes/hashes : qa/provider-final-audit-20261013.
- [ ] Action compte RunPod/Shotstack et format des six variables maître ; droits réels non qualifiés.
- [ ] Décision fournisseur et nouvel adaptateur Suno ; raccord OAuth actuel avec profil/session/organisation/scopes, après décision des propriétaires.
- [ ] Consentements des comptes sociaux choisis par l'utilisateur, seulement après correction OAuth.

Handoff : HANDOFF-SUTRA-T04-20261012.md, complément du13octobre. Pas de merge/deploy/migration/publication/génération.

- [x] T04 contrôle secrets opaque/Gitleaks, graphe isolé et revue staged HIGH bornée ; preuves et manifest archivés pour transmission du SHA après commit.


<!-- Livraison 47e49ee94381ed1e8a378f22efd66676b68e032f -->
# 2026-10-13 — T05 complément fournisseur livré localement

- [x] Politiques/LOCKS/WIP et intégration48f2d5e vérifiés ; worktree T05 isolé, aucun écrasement.
- [x] Régression Shotstack stage/production reproduite, clé propre sélectionnée avant média/HTTP, sept cas ajoutés.
- [x] 89 tests ciblés ; contrats488PASS/7SKIP ; TypeScript, lint0erreur/111warnings et build197pages hors réseau PASS. Commandes et empreintes : `qa/t05/providers-20261013/manifest.json`.
- [x] Preuves T04 master/Mac/OVH, T08 contrats distants et T06 consentements réutilisées sans sonde en doublon ; FAIL distincts des PASS.
- [x] Handoff T05 actualisé, aucune génération/rendu payant, publication, migration, fusion ou déploiement.
- [ ] T01/T04 : intégrer le delta et aligner le diagnostic administratif Shotstack ; corriger les raccords Suno/Zernio et les problèmes de sécurité identifiés par T08/T02.
- [ ] Utilisateur : clés valides RunPod/Shotstack et contrat d'accès Suno ; consentements sociaux après correction seulement.

Les plans ci-dessous sont des archives. SHA de livraison = commit contenant ce jalon ; reçu de push dans le pointeur T05 de coordination PURAMA.


## Livraison 312522a
Document propriétaire complet : `qa/final-integration-20261013/312522a-task_plan.md`.


## Livraison 460acd3
Document propriétaire complet : `qa/final-integration-20261013/460acd3-task_plan.md`.


## Livraison 0e38a92
Document propriétaire complet : `qa/final-integration-20261013/0e38a92-task_plan.md`.


<!-- Livraison 5b374994378e3840c4b0dd9bea706b3aa7306f43 -->


## 2026-10-13 — T08 reprise fournisseurs (delta QA)

Base 48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4, branche codex/sutra-t08-provider-audit-20261013, worktree isole. Rapport : [qa/t08/providers-20261013/README.md](qa/t08/providers-20261013/README.md). Produit intact, verrous et WIP etrangers preserves.

- VERIFIED : 6 contre-tests hors reseau, 1 PASS et 5 FAIL conserves (quatre assertions de contrat Zernio, une erreur Suno 2xx reflechie au navigateur). Defauts remis aux proprietaires T04/T06/T02, aucune correction produit T08.
- VERIFIED : typegen, TypeScript et lint T08 exit 0, 111 avertissements herites. T01 480 contrats PASS/7 SKIP et schedule/composition/publication PASS reutilises, 752 fichiers sources/config identiques verifies par hash. Aucun build identique duplique.
- VERIFIED : preuves partagees T04 master normalise, Mac/OVH en lecture seule : RunPod 401, Shotstack 403 quatre combinaisons, Suno legacy public 503 sans auth, Zernio 200/zero compte. Aucun appel fournisseur ou SSH T08.
- BLOQUE : release, raccord OAuth/isolation profil, Suno erreur et contrat, acces fournisseurs. SSH T04 par alias existant reussi ; SSH avec seuls parametres master T01 refuse, distinction conservee. Aucun .env.local cree, aucun secret affiche, aucune generation/publication/deploy/migration/fusion.
- Livraison locale : nouvelles preuves/tests et append documentaire uniquement. Push en attente de garde anti-preview pour cette nouvelle branche : vercel.json reserve a T05 sur son propre delta ; aucune modification de ce fichier par T08. L'autorisation de push precedente ne permet pas de declencher un deploiement interdit.

Matrice du delta : 22 exigences, 8 PASS / 4 FAIL / 7 BLOQUE / 3 NON TESTE. Les preuves du 12 octobre restent historiques et ne sont pas rejouees. Prochaine action proprietaires : corriger les deux classes de defaut et rejouer uniquement redteam, qualifier les credentials et OAuth apres intervention humaine. SHA de livraison remis dans la coordination apres commit.


## 2026-10-13 — T01 reprise finale fournisseurs intégrée et testée

Mandat courant : corrections locales et intégration seulement, aucun push/deploy/migration distante/publication/génération payante/rotation/fermeture. Branche `codex/sutra-final-providers-20261013`, base `48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4`. Livraison = commit contenant ce jalon. Les décisions et compteurs antérieurs sont historiques.

- INTEGRE : deltas T04 8e62dde, T05 47e49ee, T02 312522a, T06 460acd3, T03 0e38a92, T08 5b37499 par chemins revus ; 187 entrées, aucun manque. T07 4993feb documentaire archivé, code déjà intégré. Commits protégés conservés.
- CORRIGE : quatre défauts OAuth Z01–Z04 par propriétaire unique (contrat Zernio, profil autorisé, state/session/compte, tokens gérés par Zernio), cinq connecteurs non qualifiés désactivés ; adaptateur SunoAPI tiers authentifié avec soumission unique et contrat vérifié.
- TESTE : contrats 537 PASS/7 SKIP ; médias 31 PASS + moteur ; PostgreSQL 12 + 254 assertions + 13 contrôles migration locale ; rollback unitaire 17 ; TypeScript/lint/build PASS (111 avertissements historiques) ; redteam 14 ; browser 210/164 audits axe et browser-redteam 210+7/165 audits axe ; legacy 1022/25 SKIP ; UI sociale 28 ; audit dépendances 0 haute/critique (5 modérées/2 faibles conservées). Aucun test requis rouge.
- BLOQUE EXTERNE : RunPod 401 après normalisation, Shotstack 403 sur les quatre couples clé/environnement ; `ZERNIO_PROFILE_BINDINGS` absent puis consentements utilisateurs requis. Ancienne configuration Suno applicative incompatible : activation distante future uniquement.
- NON TESTE : génération réelle, publication réelle, tokens sociaux/rotation/révocation réels, cinq connecteurs désactivés ; limites TikTok/Pinterest du rapport T06 non qualifiées pour activation. Aucune certification de release.
- WIP : 359 fichiers tiers sauvegardés privés et identiques ; T02–T08 propres aux SHAs vérifiés, handoffs conservés et FERMABLE. T01 fermable après commit de ce jalon. Aucun terminal/service existant fermé.

Preuves et commandes exactes : `qa/final-integration-20261013/README.md`, manifest source, matrice de clôture et reçus. Prochaine tâche : seules actions de compte documentées RunPod/Shotstack, attribution Zernio puis consentements ; aucune répétition des PASS inchangés.

Complément utilisateur 23h55 : mise en service OVH SUTRA autorisée après commit/manifeste/gates de ce jalon, sauvegarde/rollback vérifiés et smokes gratuits ; le plafond local précédent est remplacé pour cette étape suivante. Aucune dépense, génération, publication ni rotation. Le déploiement n’est pas encore une preuve de ce commit.


## 2026-10-14 — T01 mise en service OVH finale (autorisation 23h55)

VERIFIED : production `e3b17117256269e281304cd4ab83bc722a6f7894`, https://sutra.purama.dev ; CI 38475022601 trois jobs SUCCESS, artefacts finaux contrôlés. Candidat exact et ancien runtime isolés PASS, sauvegarde fraîche 140 tables restaurées et comparées. Table OAuth absente détectée puis migration existante additive testée deux fois sur copie, appliquée en production sans modification de données existantes. Seule SUNO_API_BASE_URL ajoutée depuis le maître, origines/clefs applicatives préservées.

VERIFIED : smokes publics/internes, 58 contrôles cron/OAuth/auth, 30 médias, 28 origines, 16 schéma, 120 droits SQL, 36 GET Supabase, navigateur 1440/375 et captures examinées, DNS Cloudflare direct OVH/TLSv1.3 valides, logs/santé DB PASS. Aucun rollback nécessaire, aucune génération/depense/publication/rotation. Aucun test requis rouge. WIP tiers 359 fichiers identiques, T02–T08 propres et fermables ; aucun terminal fermé.

BLOQUE EXTERNE : RunPod401, Shotstack403 ; attribution utilisateur/organisation Zernio absente puis consentements requis. NON TESTE : parcours connecté réel projet/pipeline/export (identité de recette requise), génération/publication et tokens sociaux réels. Ne pas qualifier ces fonctions en production sur la seule base des fixtures.

Rapport faisant foi pour ce jalon : `qa/ovh-final-providers-20261014/README.md`. Le commit documentaire de ce jalon ne change pas l'image déployée. Prochaine tâche : seulement les actions de compte et d'identité précisées dans ce rapport ; ne pas rejouer les PASS inchangés. Rollback disponible : `python3 deploy/ovh.py rollback --source-ref e3b17117256269e281304cd4ab83bc722a6f7894` (conserve SQL/données).
