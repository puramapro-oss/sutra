# Matrice finale T01 — preuves bornées

Code OVH `86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164` ; SQL séparé `6800a8de49080157b487eec1119d2fb49c194afe`. Les 47 exigences T08 sont réconciliées ici sans modifier leur rapport historique. Les statuts PASS gardent leur portée (simulation, DB jetable ou runtime) ; ils ne prouvent pas une génération réelle.

| Exigence | Statut | Preuve et limites |
|---|---|---|
| R01 — Session absente refusée avant travail | PASS | T08 / simulé : J01 : 401, zéro job ; identité vérifiée injectée |
| R02 — Connexion navigateur OAuth réelle complète | NON TESTÉ | Réel : Identité/session de fixture ; aucun consentement/login fournisseur par T08 |
| R03 — GET authentifiés et redirections de connexion existants | PASS | Runtime exact : authenticated-smoke.json et public-browser-final.json ; login mot de passe et consentement OAuth non exécutés. |
| R04 — Création projet client avec quota autorisé | PASS | T08 / simulé : J01/J02/J03 ; réel create/queue/worker, reçu quota de fixture |
| R05 — Quota refusé ou DB indisponible avant soumission | PASS | T08 / simulé : J03 : 403/503, aucun projet ni appel fournisseur |
| R06 — Budget/autorisation propriétaire Salad et client normal | PASS | T01 réutilisé + T08 : Six tests modes intégrés ; J06 503 SALAD_DISABLED avant job, chemin client J01 |
| R07 — Coût réel, solde fournisseur et budget GPU consommé | NON TESTÉ | Réel : Aucune ressource/génération facturée ; aucun montant inventé |
| R08 — Double clic création et conflit même clé/autre contenu | PASS | T08 / simulé : J02 : 12 requêtes, 1 projet/job, 11 réponses 202, contenu changé 409 |
| R09 — Statut queue vers polling frontend | PASS | T08 / simulé : J02 : awaitGeneration réel -> GET status réel, no-store, même videoId |
| R10 — Génération simulée et checkpoints ordonnés | PASS | T08 / simulé : J01 : script, voix, musique, deux scènes, neuf étapes persistées |
| R11 — Timeout rendu puis reprise ID existant | PASS | T08 / simulé : J01 : 1 soumission + 1 polling ; aucune resynthèse |
| R12 — Perte reçu après soumission de rendu | PASS | T08 / simulé : J10 : reconciliation required, aucune seconde soumission/settlement |
| R13 — Erreur partielle upload puis reprise | PASS | T08 / simulé : J04 : un asset voix synthétisé, deux uploads, autres assets réutilisés |
| R14 — Échec DB après vérification finale | PASS | T08 / simulé : J05 : pas de publication prématurée, reprise sans rendu/vérification supplémentaire |
| R15 — Reprise Suno après timeout avec taskId | PASS | Contrats intégrés simulés : T03/T04 importés ensemble ; taskId durable avant polling, reprise GET seule. test-t03-suno-recovery et music-recovery inclus dans 805 contrats CI. |
| R16 — Montage vers export et média vérifié | PASS | T08 / simulé : J01/J07 : édition scènes/sous-titres/volume, véritable contrat ; mesures média de fixture |
| R17 — Export rejoué et refus validation | PASS | T08 / simulé : J01 replay sans effets ; J07 ancien média conservé, revalidation sans second rendu |
| R18 — Qualité réelle image/audio/sous-titres exporté | NON TESTÉ | Réel continu : Pas de fichier vidéo produit dans cette recette ; preuves FFmpeg T05 segmentées réutilisées |
| R19 — Validation médias locale CPU intégrée | PASS | Médias CPU synthétiques intégrés : npm run test:media PASS au SHA86d ; groupes 12/25/31/3, sans addition aux preuves propriétaires. SRT CPU réel : authenticated-free-media.json. |
| R20 — Isolation utilisateur aux frontières projet/job/export/publication | PASS | T08 / simulé : J06 : utilisateur étranger 404/409, zéro effet ; session fixture, pas preuve RLS |
| R21 — Preuve finale absente et accès révoqué | PASS | T08 / simulé : J09 : codes explicites, aucun POST ; hors course OAuth |
| R22 — OAuth ancien consentement ou revoke concurrent | PASS | Contrats + PostgreSQL réel jetable : T06 version/CAS et révocation ambiguë intégrés ; régressions routes/SQL CI PASS. Course via transport HTTP PostgREST réel NON TESTÉE. |
| R23 — Sécurité stockage/preuve publique | PASS | Contrats intégrés + média privé réel : T02 owner/delete/list/proof intégrés CI ; authentification média réel 401/404, Range206 et hash identique : authenticated-free-media.json. |
| R24 — Planification future sans faux published | PASS | T08 / simulé : J01 : scheduled/202/success=false, vidéo ready ; confirmation GET seulement ensuite |
| R25 — Publication simulée et projections cohérentes | PASS | T08 / simulé : J01 : seul média final exporté, journal/calendrier/historique ; 1 POST |
| R26 — Publication double clic concurrente | PASS | T08 / simulé : J11 : 12 demandes, 1 POST/journal ; projections réparées au replay |
| R27 — Échec partiel multi-réseaux | PASS | T08 / simulé : J08 : retry Instagram seul ; YouTube publié non resoumis |
| R28 — Export modifié après planification | PASS | T08 / simulé : J12 : SUTRA_MEDIA_CHANGED 409 ; intention média initiale conservée |
| R29 — Date passée ne déclenche aucune publication immédiate | PASS | T08 / simulé : J13 : refus SUTRA_ZERNIO_SCHEDULE_MUST_BE_FUTURE |
| R30 — Ordonnanceur autonome/cron OVH et reprise sans requête | BLOQUÉ | Constat T01 : Handoff T01 02h25 UTC : aucun cron/worker autonome ; activation hors périmètre |
| R31 — SSRF/IDOR/CSRF/XSS, gardes déjà intégrées | PASS | Sécurité bornée CI et runtime : CI redteam et contrats PASS ; 58 refus runtime cron/OAuth PASS. Aucun audit exhaustif ni OAuth consenti réel. |
| R32 — Redirections dépendance OTS et sécurité exhaustive | NON TESTÉ | Exigence composée, couverture limitée : Transport OTS corrigé et régressions intégrées PASS ; 0 high/critical, 2 low/5 moderate npm. Sécurité exhaustive non prouvable ; graphe GitNexus tronqué. Aucun défaut reproductible OTS restant identifié. |
| R33 — Transactions/RLS PostgreSQL multi-session existantes | PASS | PostgreSQL réel jetable : CI86d : pipeline12, Salad7, finish T03/CAS T06 13, RLS254 assertions ; migration et backup restore PASS. Ne pas additionner aux lots. |
| R34 — Parcours continu sur DB réelle avec rendu et publication | NON TESTÉ | Réel : Les preuves DB, médias et navigateur sont segmentées ; port DB du parcours simulé |
| R35 — Observabilité états/progrès/erreurs récupérables | PASS | T08 / simulé : J01/J02/J05/J10 : états, checkpoints, last_error et polling vérifiés |
| R36 — Alertes bout en bout et diagnostics exploitation | NON TESTÉ | Réel : Aucune injection panne production ni alerte/monitoring live déclenché |
| R37 — Charge concurrente bornée isolée | PASS | T08 / simulé : J02/J11 : 12 requêtes chacun, aucun réseau ; ne mesure pas débit Postgres/HTTP |
| R38 — Performance réelle/SLA et charge distante | NON TESTÉ | Réel : 459 ms pour fixtures ne constitue pas une mesure de performance applicative |
| R39 — Navigateur/accessibilité de la base, contrôles déjà passés | PASS | Navigateur CI + runtime borné : T08 browser-redteam et T07 production25 PASS sur86d ; 2 vues publiques et 10 rendus connectés live. Interactions connectées bloquées par consentement légal, pas une recette visuelle exhaustive. |
| R40 — Pagination/filtre UI et contraste bouton consentement | PASS | Navigateur fixture intégré : T07 correctifs pagination/filtres/contraste intégrés. 25 assertions navigateur production incluent 4 retours sociaux ; aucun double comptage. |
| R41 — Clavier/lecteur écran et parcours visuel complet T08 | NON TESTÉ | Navigateur manuel : Pas de nouvelle session navigateur T08 ; ne pas confondre tests routes et E2E UI |
| R42 — Absence secrets/requête payante/génération Mac/publication réelle | PASS | T08 / borné : Allowlist runner, fixtures-only, preload offline ; aucune lecture maître/env ni effet distant |
| R43 — RunPod/Shotstack accès non génératif existant | PASS | Authentification runtime non générative : provider-runtime.json : RunPod endpoint health200/contrat valide, Shotstack stage/v1 templates200/contrats. Zéro génération ; RunPod zéro worker prêt. |
| R44 — GPU Salad/RunPod, modèle 24Go, rendu facturé | NON TESTÉ | Réel : Salad désactivé, aucun worker GPU lancé, aucun calcul IA Mac |
| R45 — Publication réelle et consentements sociaux | NON TESTÉ | Réel : Zernio profil possédé mais aucun compte connecté au reçu T01 ; aucun compte connecté par T08 |
| R46 — TS/lint delta T08 et gates produit inchangées | PASS | CI exacte intégrée : npm run check (TypeScript, lint, build) PASS sur86d ; anciens diagnostics branche T03 résolus avec port T04. |
| R47 — Régressions des nouveaux correctifs T02–T07 intégrés | PASS | Intégration exacte + CI : Sept SHA vérifiés, conflits attribués et deltas importés ; CI38508390596 trois jobs PASS, promotion86d et smokes PASS. |

Compléments runtime : affirmations403 corrigé (8 tests SQL + 2 vues), sauvegarde141 tables restaurée, rollback image et ACL testés, DNS/TLS PASS. Refus Server Action malformée reproduit404 ; quatre warnings classés, zéro erreur non classée.

BLOQUÉ utilisateur : consentement légal en attente pour la recette interactive ; Zernio profil PURAMA lié mais aucun compte connecté ; Salad désactivé faute de ressource/budget/qualification. Reprise autonome et cron OVH absents. Aucun calcul GPU Mac, génération facturée, publication réelle ou fallback payant.
