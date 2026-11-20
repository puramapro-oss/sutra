# T08 — matrice finale de la base disponible

Base **b7cf848**, produit **d8691d8**. 47 exigences : 31 PASS, 4 FAIL, 3 BLOQUÉ, 9 NON TESTÉ.

**Les treize nouveaux scénarios T08 passent ; le candidat reste non certifié globalement.** Les 4 FAIL proviennent de handoffs propriétaires récents sur cette base, pas des scénarios T08. Correctifs WIP non intégrés : leur retest est BLOQUÉ en attente du candidat T01. Aucun ancien bilan 48f2d5e utilisé.

PASS signifie uniquement la portée et le type de preuve indiqués. FAIL = attendu contredit sur la base (source indiquée). BLOQUÉ = prérequis manquant. NON TESTÉ = aucune exécution de la propriété demandée. Les preuves réutilisées sont référencées dans provenance.json ; les observations propriétaires dans owner-observations.json.

| ID | Exigence | Verdict | Preuve / limite | Propriétaire |
| --- | --- | --- | --- | --- |
| R01 | Session absente refusée avant travail | **PASS** | T08 / simulé — J01 : 401, zéro job ; identité vérifiée injectée | T08 |
| R02 | Connexion navigateur OAuth réelle complète | **NON TESTÉ** | Réel — Identité/session de fixture ; aucun consentement/login fournisseur par T08 | T01/utilisateur |
| R03 | GET authentifiés et redirections de connexion existants | **PASS** | T01 réutilisé — Reçus authenticated-smoke/public-browser-final sur d8691d8 ; pas une création réelle | T01 |
| R04 | Création projet client avec quota autorisé | **PASS** | T08 / simulé — J01/J02/J03 ; réel create/queue/worker, reçu quota de fixture | T08 |
| R05 | Quota refusé ou DB indisponible avant soumission | **PASS** | T08 / simulé — J03 : 403/503, aucun projet ni appel fournisseur | T08 |
| R06 | Budget/autorisation propriétaire Salad et client normal | **PASS** | T01 réutilisé + T08 — Six tests modes intégrés ; J06 503 SALAD_DISABLED avant job, chemin client J01 | T01/T02/T03 |
| R07 | Coût réel, solde fournisseur et budget GPU consommé | **NON TESTÉ** | Réel — Aucune ressource/génération facturée ; aucun montant inventé | T01/utilisateur |
| R08 | Double clic création et conflit même clé/autre contenu | **PASS** | T08 / simulé — J02 : 12 requêtes, 1 projet/job, 11 réponses 202, contenu changé 409 | T08 |
| R09 | Statut queue vers polling frontend | **PASS** | T08 / simulé — J02 : awaitGeneration réel -> GET status réel, no-store, même videoId | T08 |
| R10 | Génération simulée et checkpoints ordonnés | **PASS** | T08 / simulé — J01 : script, voix, musique, deux scènes, neuf étapes persistées | T08 |
| R11 | Timeout rendu puis reprise ID existant | **PASS** | T08 / simulé — J01 : 1 soumission + 1 polling ; aucune resynthèse | T08 |
| R12 | Perte reçu après soumission de rendu | **PASS** | T08 / simulé — J10 : reconciliation required, aucune seconde soumission/settlement | T08 |
| R13 | Erreur partielle upload puis reprise | **PASS** | T08 / simulé — J04 : un asset voix synthétisé, deux uploads, autres assets réutilisés | T08 |
| R14 | Échec DB après vérification finale | **PASS** | T08 / simulé — J05 : pas de publication prématurée, reprise sans rendu/vérification supplémentaire | T08 |
| R15 | Reprise Suno après timeout avec taskId | **FAIL** | Signalement propriétaire sur base — T04/T01 : generateMusic masque taskId ; protection empêche double génération mais reprise GET bloquée. Contrat T04 et raccord T03 en cours, non intégrés | T04/T03 |
| R16 | Montage vers export et média vérifié | **PASS** | T08 / simulé — J01/J07 : édition scènes/sous-titres/volume, véritable contrat ; mesures média de fixture | T08 |
| R17 | Export rejoué et refus validation | **PASS** | T08 / simulé — J01 replay sans effets ; J07 ancien média conservé, revalidation sans second rendu | T08 |
| R18 | Qualité réelle image/audio/sous-titres exporté | **NON TESTÉ** | Réel continu — Pas de fichier vidéo produit dans cette recette ; preuves FFmpeg T05 segmentées réutilisées | T05/T01 |
| R19 | Validation médias locale CPU intégrée | **PASS** | T01 réutilisé — CI d8691d8 : 59 médias, correctif corrupt-PCM inclus ; pas un GPU/export live | T05/T01 |
| R20 | Isolation utilisateur aux frontières projet/job/export/publication | **PASS** | T08 / simulé — J06 : utilisateur étranger 404/409, zéro effet ; session fixture, pas preuve RLS | T08 |
| R21 | Preuve finale absente et accès révoqué | **PASS** | T08 / simulé — J09 : codes explicites, aucun POST ; hors course OAuth | T08 |
| R22 | OAuth ancien consentement ou revoke concurrent | **FAIL** | Signalement propriétaire sur base — T06 : ancien state réactive compte, callback suspendu écrase revoke ; version/CAS corrigés en WIP, SHA intégré absent | T06 |
| R23 | Sécurité stockage/preuve publique | **FAIL** | Signalement propriétaire sur base — T02 : deux familles, 15 FAIL/3 PASS avant, 28 PASS après en WIP ; livraison/intégration à vérifier, pas reproduit par T08 | T02 |
| R24 | Planification future sans faux published | **PASS** | T08 / simulé — J01 : scheduled/202/success=false, vidéo ready ; confirmation GET seulement ensuite | T08 |
| R25 | Publication simulée et projections cohérentes | **PASS** | T08 / simulé — J01 : seul média final exporté, journal/calendrier/historique ; 1 POST | T08 |
| R26 | Publication double clic concurrente | **PASS** | T08 / simulé — J11 : 12 demandes, 1 POST/journal ; projections réparées au replay | T08 |
| R27 | Échec partiel multi-réseaux | **PASS** | T08 / simulé — J08 : retry Instagram seul ; YouTube publié non resoumis | T08 |
| R28 | Export modifié après planification | **PASS** | T08 / simulé — J12 : SUTRA_MEDIA_CHANGED 409 ; intention média initiale conservée | T08 |
| R29 | Date passée ne déclenche aucune publication immédiate | **PASS** | T08 / simulé — J13 : refus SUTRA_ZERNIO_SCHEDULE_MUST_BE_FUTURE | T08 |
| R30 | Ordonnanceur autonome/cron OVH et reprise sans requête | **BLOQUÉ** | Constat T01 — Handoff T01 02h25 UTC : aucun cron/worker autonome ; activation hors périmètre | T01 |
| R31 | SSRF/IDOR/CSRF/XSS, gardes déjà intégrées | **PASS** | T01 réutilisé, borné — CI 666 contrats/14 redteam et 58 refus runtime ; ne couvre pas nouvelles observations T02/T06 | T02/T01 |
| R32 | Redirections dépendance OTS et sécurité exhaustive | **BLOQUÉ** | Investigations propriétaire — T02 : chaîne request/OTS, reproduction transport en cours ; pas de certification générale sur ancienne gate | T02 |
| R33 | Transactions/RLS PostgreSQL multi-session existantes | **PASS** | T01 réutilisé — CI exact d8691d8 : 12 tests pipeline + 7 Salad sur DB jetable ; aucun SQL exécuté ici | T01/T03 |
| R34 | Parcours continu sur DB réelle avec rendu et publication | **NON TESTÉ** | Réel — Les preuves DB, médias et navigateur sont segmentées ; port DB du parcours simulé | T01 |
| R35 | Observabilité états/progrès/erreurs récupérables | **PASS** | T08 / simulé — J01/J02/J05/J10 : états, checkpoints, last_error et polling vérifiés | T08 |
| R36 | Alertes bout en bout et diagnostics exploitation | **NON TESTÉ** | Réel — Aucune injection panne production ni alerte/monitoring live déclenché | T01 |
| R37 | Charge concurrente bornée isolée | **PASS** | T08 / simulé — J02/J11 : 12 requêtes chacun, aucun réseau ; ne mesure pas débit Postgres/HTTP | T08 |
| R38 | Performance réelle/SLA et charge distante | **NON TESTÉ** | Réel — 459 ms pour fixtures ne constitue pas une mesure de performance applicative | T01 |
| R39 | Navigateur/accessibilité de la base, contrôles déjà passés | **PASS** | T01 réutilisé, borné — 210+7 contrôles et 165 axe CI, ancien timeout conservé puis retry même SHA PASS | T07/T01 |
| R40 | Pagination/filtre UI et contraste bouton consentement | **FAIL** | Signalement propriétaire sur base — T07 : pagination masquée, 6 GET identiques sur filtres, axe 3,95:1 ; correction WIP hors tests T08 | T07 |
| R41 | Clavier/lecteur écran et parcours visuel complet T08 | **NON TESTÉ** | Navigateur manuel — Pas de nouvelle session navigateur T08 ; ne pas confondre tests routes et E2E UI | T07/T01 |
| R42 | Absence secrets/requête payante/génération Mac/publication réelle | **PASS** | T08 / borné — Allowlist runner, fixtures-only, preload offline ; aucune lecture maître/env ni effet distant | T08 |
| R43 | RunPod/Shotstack accès non génératif existant | **PASS** | T01 réutilisé — health 200, templates stage/v1 200 ; preuve de lecture/auth uniquement | T01 |
| R44 | GPU Salad/RunPod, modèle 24Go, rendu facturé | **NON TESTÉ** | Réel — Salad désactivé, aucun worker GPU lancé, aucun calcul IA Mac | T01/utilisateur |
| R45 | Publication réelle et consentements sociaux | **NON TESTÉ** | Réel — Zernio profil possédé mais aucun compte connecté au reçu T01 ; aucun compte connecté par T08 | T01/utilisateur |
| R46 | TS/lint delta T08 et gates produit inchangées | **PASS** | T08 + T01 réutilisé — TS/lint ciblés nouveaux PASS ; CI d8691d8 build/TS/lint PASS, 111 warnings hérités | T08/T01 |
| R47 | Régressions des nouveaux correctifs T02–T07 intégrés | **BLOQUÉ** | Candidat attendu — T01 HEAD b7cf848 ; prochains SHA non intégrés. SMOKE-T01.md définit retest unique du delta | T01/T08 |

Le seul défaut corrigé dans le périmètre T08 concerne la sérialisation JSON de la nouvelle fixture RPC (README). Aucun produit des autres terminaux édité. GPU et publications réelles restent explicitement NON TESTÉS. Prochaine action : T01 livre son SHA intégré puis recette bornée définie dans SMOKE-T01.md.
