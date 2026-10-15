
## T08-HARNESS-01 — FAIL reproductible, propriétaire T01

Date: 2026-10-15T13:10:19.772416+00:00
SHA testé d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2. Fichier réservé T01 non modifié: qa/t01-final-20261015/browser-harness/runtime-guard.mjs, classifyRuntimeErrors.
Repro: dans /Users/matissdornier/purama-worktrees/sutra-t08-acceptance-d21b7b4-20261015, Node24 --test qa/t08-acceptance-d21b7b4-20261015/harness-boundaries.test.mjs. 2PASS/4FAIL/0SKIP, log adjacent. State exact du test: WebKit, preuve native caughtUnloadDiagnostic GET, navigation goto /create→/library, événement unload-fetch /api/production à119ms, pageerror access-control à120ms. Méthode POST/PATCH/DELETE/undefined.
Attendu: erreur conservée unexpected, sans qualification native GET. Observé: qualified1/unexpected0 pour les quatre méthodes. Cause: branche same-origin vérifie URL/temps/nativeControl mais pas fetch.method; contrairement à syntheticOriginProof qui exige GET. Aucun défaut produit/publication réelle affirmé.
Demande: T01 corrige uniquement sa borne après impact, conserve les rouges, reteste native GET/HEAD et vrais CORS/mutations; fournit SHA intégré exact. T08 retestera ces quatre cas et les risques affectés, puis le parcours final une fois. Aucun rebuild global identique demandé. Revue finale suspendue à ce défaut de gate; anciens12FAIL en cours de réconciliation, 91tests directs déjàPASS.
