# HANDOFF SUTRA T07 — ordonnanceur UI et annulation durable — 2026-10-15

Branche : `codex/sutra-t07-scheduler-cancel-20261015`.
Base : `d5d49a458e9e630ffbc1a433a7693a8cecd7dad5` (produit T1 `c7a7ebd876d36c521b1c30f6d487b7bb07f000a8`). SHA de livraison : commit qui contient ce fichier, transmis exactement dans le miroir commun T07-SCHEDULER-CANCEL-20261015.md. Aucun push/fusion/déploiement.

## Correctifs livrés

1. Ordonnanceur UI : lecture/activation/pause de la configuration existante, verrou de double clic, GET avant retry après ACK perdu, deadline et erreur visible. Seul `is_active` est écrit ; aucun moteur ajouté, aucune modification des plannings/fuseaux/publications. Préférence et exécution serveur clairement distinguées.
2. Production : reçu UUID/contenu original enregistré avant POST, restauration au reload par utilisateur, suivi/réconciliation, annulation persistée avant envoi ; strict ACK serveur seul confirme. Erreurs/timeout gardent le reçu et libèrent le loader, réponse tardive ignorée. Aucun POST génération après intention d'annulation. Résultat récupéré ≠ média vérifié.
3. Raccord GET fourni par T1 : `GET /api/production?requestId=<UUID>&targetStep=<step>` permet de retrouver jobId/statut/résultat sans créer de tâche.404/400/401/503/timeout/JSON malformé ne certifient pas l'annulation. Après erreur, consultation réessayable ; si jobId récupéré, reprise via GET video/status.

## Huit fichiers produit, propriété T07

- `src/app/(dashboard)/auto/layout.tsx`
- `src/app/(dashboard)/auto/page.tsx`
- `src/app/(dashboard)/production/page.tsx`
- `src/hooks/useProductionGeneration.ts`
- `src/hooks/useAutoScheduler.ts`
- `src/components/auto/AutoSchedulerControl.tsx`
- `src/components/production/ProductionRequestStatus.tsx`
- `src/lib/production-intent-client.ts`

QA : `qa/t07-scheduler-cancel-20261015/**`. Journaux BATON/task_plan/ERRORS ajoutés sans modifier leurs entrées précédentes. SHA256 dans source-manifest.json.

## Contrat T1 confirmé et dépendance d'intégration

ACK T1 18:07/18:27/18:28 lu dans T01-FINAL-INTEGRATION-20261015.md. Route T1 de réconciliation SHA256 `9e0d5b5bc953f35327a3648867333ee1a16a10ef97b0a0a02a5989fdd891d5a1`, tests backend annoncés T1 29nouveaux/57avec régressions. **Intégrer ce GET avec le frontend** ; il n'est ni copié ni édité ici. Sur ancien backend, lecture non disponible reste inconnue ; aucune création automatique de remplacement. Les tests UI utilisent le contrat simulé, pas une preuve de la route/DB intégrée. T1 conserve backend, config, infrastructure et gate finale ; T08 recette le SHA exact.

## Résultats et preuves

- **PASS** final52/52 Chromium optimisé375×900 et1440×900 : succès, erreur, reprise, réponse perdue/tardive, UUID stable, annulation stricte, double clic, GET404/503/401/400, lookup invalide/timeout, reload, stockage inaccessible, absence crédits/GPU. Zéro requête externe, mutation inattendue, erreur runtime/hydratation. Login et4consentements d'identité synthétique passés.
- **PASS réutilisé** ordonnanceur et régressions antérieures46/46 du build optimisé précédent ; ne pas sommer ces runs recouvrants. SSR final3/3 et helper4/4. TypeScript, lint produit/QA, build final PASS ; lint initial1warning préexistant,0erreur.
- **PASS borné a11y**10scans axe des panneaux,0violation ;4incomplete contraste non certifiants. Clavier/focus et mobile responsive testés, captures affichées.
- **FAIL conservés** baseline4échecs (3défauts+1bancdev), runintermédiaire4échecs, SSR erreur d'état et assertion de banc corrigées. Dernier run dev51PASS/1FAIL garde pour deux hydratations DashboardChrome ; non reproduites dans le build optimisé52PASS, cause précise non établie. Aucun filtre ni faux vert. Typecheck en parallèle de Next dev avait TS6053 de types régénérés ; retest séquentiel PASS.
- Mesure comparable : double clic375px, dev+fixture300ms :2PATCH→1. Build optimisé final : cancel359/363ms, GET réconciliation365/367ms (fixture200ms). Pas de promesse « sans latence » ni SLA distant.
- GitNexus exécuté avant édition et avant commit. Résolution par nom incorrecte, entrées Next UNKNOWN, graphes tronqués et detect_changes CRITICAL avec associations hors SUTRA ; avertissements annoncés, diff exact revu huit fichiers, portée exhaustive UNKNOWN.

Commandes exactes, reproductions, mesures et captures : [README QA](qa/t07-scheduler-cancel-20261015/README.md). Sources/tests/config de test identifiés par empreintes, aucun secret réel.

## Limites restantes

- **BLOQUÉ R30 réel** : moteur serveur autonome désactivé, aucun endpoint de statut runtime/fraîcheur. Contrôle UI de préférence prêt, aucune infrastructure activée.
- **BLOQUÉ avant intégration** : route GET T1 et frontend à réunir, puis tests route+UI et gate du candidat exact. Ne pas certifier le candidat intégré à partir de mocks.
- **NON TESTÉ** annulation réelle DB/fournisseur/remboursement, paid/GPU/publication, production, Safari natif, appareil physique, lecteur d'écran réel. Reçu sessionStorage survit au reload du même onglet, pas à sa fermeture.
- `/create` ne reçoit aucune annulation production non compatible, conformément à T1 ; R74 global reste partiel tant que son propriétaire ne fournit pas ce contrat. Pas de second moteur.

FIN_ECRITURE après commit local et scan de secrets expurgé ; SHA40 et verdict du scan dans le miroir commun. Aucune garantie absolue de zéro bug.

Contrôle livraison : manifeste20empreintes PASS. Scan Gitleaks textuel PASS ; scan binaire exit1 avec deux alertes expurgées localisées dans les sections de patch PNG, triage conservé. Diff-check code/docs/tests PASS ; whitespace des logs bruts conservé. Aucun secret réel ni fichier environnement privé lu.
