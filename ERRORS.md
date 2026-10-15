# ERRORS.md — sutra

| DATE | BUG | CAUSE | FIX |
|------|-----|-------|-----|
| 2026-09-19 | Mission 10 (reprise crash) : (1) upscale 4K monoprompt tuait ComfyUI sans traceback (SIGKILL jetsam) après sampling OK ; (2) VAE standalone LTXV introuvable au format ComfyUI (KeyError `post_quant_conv.weight` sur `vae/diffusion_pytorch_model.safetensors` Lightricks = format diffusers) ; (3) `/upload/image` ComfyUI rejetait les mp4 (HTTP 400) ; (4) arg adaptateur `127.0.0.1:7860` sans schéma → `TypeError: Failed to parse URL` ; (5) `video_url` e2e renvoyait le fichier ÉTAPE 1 (type=input) au lieu de la sortie 4K | (1) résidents cumulés T5 18 Go + ckpt 24,9 Go + VideoVAE 2,4 Go + tenseurs ≈ 46+ Go / 48 Go utiles pendant LTXVLatentUpsampler ; (2) Lightricks ne publie le VAE qu'en format diffusers ; (3) ComfyUI lit `post.get("image")` — champ form `files` ignoré ; (4) `fetch()` exige un schéma URL ; (5) scan de TOUS les outputs history → le passthrough LoadVideo (fichier input) arrivait en 1er | (1) pipeline 2 étapes dans scripts/comfyui-engine-server.mjs : gén native (prompt 1) PUIS `LoadVideo→VAEEncode→LTXVLatentUpsampler×2→VAEDecodeTiled` (prompt 2, ~5 Go résidents) — mesuré : upscale seul 120 169 ms, e2e 429 486 ms, pic 17,5 Go, 3584×2048 inspecté frames 1/45/89 sans artefact ; (2) extraction des 229 tenseurs `vae.*` depuis le ckpt fp8 → `models/vae/ltxv_vae-0.9.8.safetensors` (2 493 857 212 o) ; (3) champ form renommé `image` (+ `overwrite=true`) ; (4) normalisation `.replace(/^(?![a-z]+:)/i,'http://')` ; (5) `submitAndWait(workflow, 'save')` cible le nœud SaveVideo par id |
| 2026-09-19 | Mission 9 : (1) workflow ComfyUI rejeté 400 sur noise_seed négatif ; (2) shards T5 3+4 corrompus après veille interrompue pendant `curl -C -` ("incomplete metadata, file not fully covered") ; (3) `ffmpeg -vsync` inconnu (ffmpeg 9) ; (4) doc mission 8 : licence poids LTX annoncée Apache-2.0 à tort | (1) `(Math.random()*2**48)\|0` dépasse 2^31 → int32 signé ; (2) le serveur HF ignore parfois Range après coupure → octets dupliqués/manquants sans erreur HTTP ; (3) option retirée en ffmpeg 9 ; (4) Apache-2.0 = licence du CODE repo LTX-Video, les POIDS ≥0.9.6 sont sous LTXV Open Weights License 0.X (usage commercial OK < 10 M$ CA/an) | (1) `Math.floor(Math.random()*2**47)` dans scripts/comfyui-engine-server.mjs ; (2) sonde safetensors par shard avant emploi + suppression + re-téléchargement propre (tailles == API HF exactes) ; (3) `-fps_mode vfr` ; (4) docs/LOCAL-ENGINE-INSTALL.md corrigé : tableau licences séparant code (Apache-2.0) / poids (LTXV Open Weights 0.X), condition < 10 M$ documentée |
| 2026-09-19 | Voix >20 Mo non sauvegardées (re-synthèse ElevenLabs après interruption) ; plan moteur local inexistant (choix modèle/licence/4K non documentés) | checkpoint RPC remplaçait le jsonb (un seul payload = plafond), pas de découpe ; recherche d'installation non faite | migration v10 : checkpoint_video_job MERGE jsonb (||, morceaux successifs cumulés — test 13/13) ; production-pipeline : voix ≤20 Mo bloc unique, >20 Mo découpée en morceaux ~12 Mo voice_b64:{i} + voice_b64_parts, réassemblés à la reprise SANS synthèse (test 5/5 : 24 Mo → 3 morceaux, 1 seule synthèse) ; docs/LOCAL-ENGINE-INSTALL.md : choix vérifié ComfyUI+LTX-Video 13B distilled (Apache-2.0, MPS natif, Wan 2.2 cassé sur Apple Silicon #9255, LTX-2.3 licence duale ≥10M$) + Real-ESRGAN 4x (BSD-3) pour le 4K = upscale PAS génération native (SUPIR exclu non-commercial), ~35 Go disque, licences et benchmark checklist ; Playwright 1022/0 |
| 2026-09-19 | AUTO + EXPORT hors file durable (crash = re-rendu/re-génération complets, retry = second débit) ; voix >5 Mo non checkpointées (re-synthèse ElevenLabs après interruption) ; diagnostic 402 flotte inconnu | Seuls create/production étaient durables ; plafond checkpoint voix trop bas ; DEPLOYMENT_DISABLED Vercel non identifié | lib/export-pipeline.ts + lib/auto-pipeline.ts (steps assembly/plan/assets/saved, fournisseurs injectés, compositing_failed préservé) ; /api/video/export = job export-{videoId}-{requestId OU hash-payload} (retry mêmes réglages = cache, 0 re-rendu) ; /api/auto/generate = job auto-{rowId} (ligne insérée avant, champs plan écrits au persist, 409 si en vol) ; worker dispatche export+auto ; MAX_VOICE_B64 5→20 Mo (PostgREST-safe) ; tests auto-export 4/4 (export re-reprise 100% cache, auto plan jamais replanifié, voix 7 Mo une seule synthèse) ; DIAGNOSTIC 402 lecture seule : x-vercel-error DEPLOYMENT_DISABLED sur sutra+prana+kaia+mana (Vercel edge, facturation team) — auth.purama.dev vivant (401 normal), rien touché ; Playwright 1022/0 |
| 2026-09-19 | Production multi-étapes HORS file durable : crash = régénération de TOUTES les scènes (double génération + double débit), retry client = seconde réservation, aucune annulation ; rapport fichier local sans provenance (modèle/résolutions/temps) | Étapes inline sans checkpoint ni idempotence par requête ; aucun RPC cancel ; stub sans generator/temps | lib/production-pipeline.ts (executeProductionStep : chaque résultat fournisseur checkpointé progress.steps — script/musique/scène:i/voix (buffer b64 ≤5Mo)/assemblage — fournisseurs INJECTABLES pour preuve par compteurs) ; /api/production = tâches durable kind 'production' clé production-{user}-{step}-{requestId} : done → résultat checkpointé renvoyé SANS rappel (idempotence retry), processing → 409, catch → requeue (worker reprend avec checkpoints) ; worker /api/cron/video-worker dispatche production ; migrations/v10 + cancel_video_job (cancelled + release quota ATOMIQUES, jamais re-claimable) ; schema + requestId/targetStep/cancel ; tests : production-queue 5/5 (interruption/reprise compteurs cumulés = 1 par ressource, voix crash-upload non resynthétisée), migration 12/12 (cancel queued/en-vol) ; stub + e2e rapport complet (ffmpeg testsrc2+sine 896×512 natif=final 6.00s A/V 0.000s 171ms, IA réelle NON) ; Playwright 1022/0 (E2E_BASE_URL requis sinon specs frappent prod 402) |
| 2026-09-19 | Avant prod : migration v10 remettait les compteurs du mois à zéro (consommations déjà enregistrées perdues) + reprise possible en double comptage ; parcours moteur local jamais prouvé sur un VRAI fichier | Backfill absent ; seule la grille WAN alimentait le routeur local (896×512 720p 16:9), aucune mesure réelle | migrations/v10 : backfill du mois courant (statut <> failed, mois passés ignorés, ON CONFLICT DO NOTHING = rejouable sans double comptage ni toucher aux réservations vivantes) + create schema sutra si absent ; test-migration-local réécrit en cycle complet seedé (mois courant+passé+failed) : 10/10 dont backfill, re-run, course limite 1 ; scripts/local-engine-stub-server.mjs (vrai mp4 ffmpeg testsrc2+sine, sanitiser nom avec point) + test-local-engine-e2e.mts autonome : generateVideoSmart → fichier réel mesuré ffprobe 896×512, 6.00s, h264+aac, A/V Δ=0.000s, wrapper fetch prouvant ZÉRO hôte externe (y compris en échec strict) ; tsc 0, lint 0 erreur, contrats 6/6 + 50/50, migration 10/10, e2e local 3/3, build ✓ |
| 2026-09-18 | File durable + quota atomique + moteur local (suite audit #8/#9/#10/#14/#17) : create crashee laissait generating + quota lecture-action concurrente + POST rejoues + aucune reprise ; mode local absent | Pas de persistance tache/lease/checkpoint ; checkLimits non atomique ; aucun routage local proprietaire | migrations/v10 (video_jobs + video_quota_counters + RPC reserve/complete/release + claim FOR UPDATE SKIP LOCKED + claim_by_key setof + heartbeat + checkpoint + RLS conditionnel) testee 7/7 sur PG 18.4 local JETABLE ; lib/video-queue.ts (reserveQuota fail-closed, enqueue idempotent, claim, checkpoint) ; lib/video-pipeline.ts (reprise scenes sans regenerer, cost_estimate restaure) ; /api/create = reservation atomique + tache durable + claim cible + checkpoint/scene ; worker /api/cron/video-worker (CRON_SECRET strict, settlement quota, requeue borne 3) ; production/auto/export = reservation atomique + settlement (release sur early-return aussi) ; lib/local-engine.ts (proprietaire UNIQUEMENT, strict=aucun repli payant, auto=repli documente, probe sante) branche via tryLocalRoute ; tests : migration 7/7 rejouable, contrats 50/50 (dont 5 moteur local), E2E 1022/0 |
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


## 2026-10-14 — T07 frontend, défauts vérifiés corrigés localement

- Pagination disparue sous favoris/dossier sans correspondance page1 : reproduit375/1440, bouton sorti de la condition des résultats filtrés ; PASS clavier/page2.
- Six GET identiques all/favorites : normalisation du filtre serveur ; zéro GET, pages/requête en cours préservées ; médiane452→27,5ms dans le banc retardé400ms.
- hasMore/totalCount périmés après échec remplacement : remis à zéro, reprise append conservée ; rouge intermédiaire puis PASS.
- Cookies contraste accepter3,95 et lien light4,23 : couleurs existantes corrigées, min4,85 pour lien et5,89 bouton, six combinaisons thème/largeur PASS.
- Banc : POST consentement synthétique initialement interdit (aucun vrai POST), puis mock explicite ; lint max-lines corrigé par helper de contraste. Tous échecs conservés dans qa/t07-frontend-fixes-20261014, campagne finale21 PASS/0 FAIL,13axe+6contraste.

Aucune preuve génération/publication réelle ni garantie exhaustive ; remise locale T01, voir handoff dédié.


## 2026-10-14 — T02 SECURITY-FIXES (base b7cf848)

CORRIGÉ ET VÉRIFIÉ localement : T02-STORAGE (absence owner delete/list, aucun appelant produit identifié), T02-PROOF (diagnostics internes publics), T02-OTS-REDIRECT (transport request suit URL interne), T02-OTS-EMPTY (calendriers tous échoués mais stamp résolu sans attestation). Reproductions et corrections : qa/t02-security-fixes-20261014/README.md ;55 PASS /1 SKIP, TypeScript/lint verts.

RESTE DOCUMENTÉ :7 alertes npm transitives sans mise à jour majeure sûre ; chemin réseau OTS mitigé. Aucun nouveau blocage externe empêchant la livraison locale. Activation GPU/consentements/live et intégration T01 restent distincts de cette preuve.



## T06 SOCIAL-RECOVERY — 2026-10-14, correctifs locaux verifies

CORRIGE : refus OAuth non consomme ; callback/state obsolete pouvant reactiver un compte revoque ; alias twitter sur erreur X ; erreur inconnue qualifiee de refus ; absence de barriere durable entre DELETE et reconnexion ; timeout/503 levant cette barriere trop tot (revue T01). Reproductions avant/apres et tests exacts : qa/t06-social-recovery-20261014/README.md ; handoff HANDOFF-SUTRA-T06-SOCIAL-RECOVERY-20261014.md. 162 tests distincts PASS apres adaptation explicite de deux fixtures historiques et chargement types Next QA, sans suppression d'assertion de securite.

LIMITE : revoke distant inconnu bloque jusqu'a reconciliation T01, pas de retry automatique. PLANIFICATION OVH NON ACTIVE selon T01 ; PostgREST/consentements/token refresh/publication reels NON TESTES. UI page social perd le corps409/503 avant toast : transmis T07, pas de modification parallele. Aucune garantie absolue ni preuve production nouvelle.


## 2026-10-14 — correctifs démontrés T04, base b7cf848

- SALAD-DRAIN : drain ignorait une admission suspendue dans reserve ; Set des admissions avant await, attendre admissions puis calculs.
- SALAD-NODES : queue vide ne prouvait pas les onze classes/entrées/sorties/poids du bridge ; GET object_info privé avant probe matériel.
- RUNPOD-IDENTITY : coercition ID et sorties malformées ; ID string strict/identique, états et URL/base64 validés, aucune resoumission.
- VOICE-BODY/BODY-DEADLINE : HTTP200 JSON accepté MP3, corps bloqué non borné ; type/tailles/non-vide/deadline intégrant lecture, diagnostics fixes.
- SUNO-RECOVERY : ID invisible jusqu’au résultat ; port optionnel durable onSubmitted await avant GET, reprise current.taskId GET seule, erreur conservant ID ; checkpoints consommateurs T03.
- IMAGES-CLASSIC : absence nofeed/options non garanties ; thumbnail1920×1080 dépassait plafond ; helper existant réutilisé/ratios+feed contrôlés après ACK T01.

Preuves avant/après et 91PASS ciblés : qa/t04-provider-fixes-20261014/README.md. Aucun FAIL résiduel du périmètre testé ; limites réelles et NON TESTÉ conservés dans le handoff, aucune garantie zéro bug.


## T03 durable — 2026-10-14, base e09fdae

- CORRIGÉ LOCAL : résultat null invalide accepté en reprise et skip musique contradictoire accepté après ACK fin perdu ;10 FAIL avant/12 PASS après (un cas positif ajouté), invariant commun worker/queue.
- CORRIGÉ LOCAL T02-FINAL-01 : erreur RPC/transport exposée ; allowlist exacte des codes publics,13 tests PASS sans modifier routes ni fichier T02.
- FAIL CANONIQUE / PROPOSITION LOCALE PASS : done sans résultat, remplacement checkpoint final/stage/scène/résultat payé/identité, claim ciblé épuisé restant processing.6 FAIL avant/13 PASS avec SQL proposé en fixture. T01 seul intègre migration/fixtures et valide ACL ; ne pas annoncer corrigé en production.
- LIMITE OUTILLAGE : GitNexus SQL UNKNOWN, analyse finale tronquée et flux hors SUTRA mal associés. Diff exact revu ; exhaustivité non certifiée. Erreur initiale du harnais p_initial null pour create conservée, corrigée par fixture valide, exclue des défauts produit.
- Détails/reproduction/commandes : qa/t03-durable-reliability-20261014/README.md. Aucun nouveau blocage du port Suno : dépendance intégrée confirmée.


## T06-VALIDATION-01 — 2026-10-14 — CORRIGE LOCAL
Le journal ne confrontait pas le compte stocke au binding Zernio actuel, sa provenance et sa revocation pending. Reproduction14 FAIL ; correction18 PASS,146 regressions/contrats distincts PASS, TS/lint PASS. Un seul fichier produit modifie : src/lib/publication-journal.ts. Preuves qa/t06-social-validation-20261014/README.md.

FAIL EXTERNE DE FIXTURE : parcours T08 historique4 PASS/4 FAIL user=u apres durcissement UUID ; adaptation reservee par T08, integration conjointe T01 et retest du candidat requis. Aucun fichier hors ACK modifie. Absence de consentement personnel distincte d'un defaut logiciel ; publication/rotation/revocation reelles NON TESTEES.


## T07 — FRONTEND-JOURNEY, 2026-10-14

CORRIGÉ/VÉRIFIÉ local : mentions404, consentement sans modal/focus et contrastes3thèmes, requête légale pendante, vidéo failed annoncée en génération, commandes sans fichier, téléchargement natif silencieux après307 privé.61 assertions finales PASS ; reproductions et FAIL de banc préservés : qa/t07-frontend-journey-20261014/README.md. Deadline10s consentement et30s téléchargement, contrôle SHA des octets avant remise. Aucun défaut backend repris en parallèle. Limites : mémoire des gros médias/CORS réel/Safari et production NON TESTÉS ; erreur visible sans rendu de secours. Handoff T07 dédié, réception T01 attendue.

## T01 — consolidation finale 2026-10-15
- CAS planning: ecriture sans precondition pouvait ecraser une edition concurrente; snapshot attendu obligatoire et UPDATE JSONB atomique utilisateur, erreurs428/409, validation serveur. 53contrats +3PG PASS.
- Social reload: accounts ne fournit pas autopilot; GET canonique distinct atomique, inconnu reste indisponible, delai/retry unique. Reproduction5FAIL1PASS; valeurs375/1440 et erreurs/reprise PASS apres.
- Stock-only: resultat vide declenchait IA implicite; echec explicite sans intention facturee.6contrats PASS.
- Shotstack: signal ne couvrait pas corps GET; providerRecord borne et verification annulation. Corps annule refuse; POST tardif conserve identite distante pour reconciliation sans resoumission (comportement preexistant verifie).
