# T08 — clôture des anciens échecs et recette du candidat disponible

Candidat testé **e09fdaeafbf1ec8554a7b689fe3c44dd696d0140**, confirmé par T01. Aucune importation WIP.

**Verdict : non prête aux essais utilisateur complets.** Les quatre anciens FAIL sont clos par retest. Les nouveaux défauts code ci-dessous et le SHA final manquant empêchent un verdict favorable. Les simulations ne prouvent ni génération GPU ni publication réelle.

47 exigences historiques : {'PASS': 35, 'NON TESTÉ': 9, 'BLOQUÉ': 2, 'FAIL': 1}. Avec six sous-critères/deltas explicites : {'PASS': 37, 'NON TESTÉ': 9, 'BLOQUÉ': 2, 'FAIL': 5}. Les nombres comptent des exigences, pas des tests.

PASS = portée précise prouvée ; FAIL = attendu contredit, source indiquée ; BLOQUÉ = prérequis externe absent ; NON TESTÉ = aucune exécution de la propriété. Aucun FAIL converti en skip. R32 est scindé : OTS PASS dans R53, sécurité exhaustive NON TESTÉE. R41 devient FAIL car un défaut clavier concret est maintenant connu ; le reste manuel reste non testé. R47 distingue ancienne intégration close et nouvel SHA attendu.

| ID | Exigence | Statut | Preuve / limite | Propriétaire |
| --- | --- | --- | --- | --- |
| R01 | Session absente refusée avant travail | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J01 : 401, zéro job ; identité vérifiée injectée | T08 |
| R02 | Connexion navigateur OAuth réelle complète | **NON TESTÉ** | Réel — Identité/session de fixture ; aucun consentement/login fournisseur par T08 | T01/utilisateur |
| R03 | GET authentifiés et redirections de connexion existants | **PASS** | T01 runtime réutilisé — qa/final-delta-20261014/FINAL-MATRIX.md + authenticated-smoke/public-browser-final : GET et redirections seulement ; aucun login personnel exécuté par T08. | T01 |
| R04 | Création projet client avec quota autorisé | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J01/J02/J03 ; réel create/queue/worker, reçu quota de fixture | T08 |
| R05 | Quota refusé ou DB indisponible avant soumission | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J03 : 403/503, aucun projet ni appel fournisseur | T08 |
| R06 | Budget/autorisation propriétaire Salad et client normal | **PASS** | T01 réutilisé + T08 — Six tests modes intégrés ; J06 503 SALAD_DISABLED avant job, chemin client J01 | T01/T02/T03 |
| R07 | Coût réel, solde fournisseur et budget GPU consommé | **NON TESTÉ** | Réel — Aucune ressource/génération facturée ; aucun montant inventé | T01/utilisateur |
| R08 | Double clic création et conflit même clé/autre contenu | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J02 : 12 requêtes, 1 projet/job, 11 réponses 202, contenu changé 409 | T08 |
| R09 | Statut queue vers polling frontend | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J02 : awaitGeneration réel -> GET status réel, no-store, même videoId | T08 |
| R10 | Génération simulée et checkpoints ordonnés | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J01 : script, voix, musique, deux scènes, neuf étapes persistées | T08 |
| R11 | Timeout rendu puis reprise ID existant | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J01 : 1 soumission + 1 polling ; aucune resynthèse | T08 |
| R12 | Perte reçu après soumission de rendu | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J10 : reconciliation required, aucune seconde soumission/settlement | T08 |
| R13 | Erreur partielle upload puis reprise | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J04 : un asset voix synthétisé, deux uploads, autres assets réutilisés | T08 |
| R14 | Échec DB après vérification finale | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J05 : pas de publication prématurée, reprise sans rendu/vérification supplémentaire | T08 |
| R15 | Reprise Suno après timeout avec taskId | **PASS** | T08 retest propriétaire / simulé — suno.json : 19 PASS, taskId durable et reprise GET ; aucune musique réelle. | T04/T03 |
| R16 | Montage vers export et média vérifié | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J01/J07 : édition scènes/sous-titres/volume, véritable contrat ; mesures média de fixture | T08 |
| R17 | Export rejoué et refus validation | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J01 replay sans effets ; J07 ancien média conservé, revalidation sans second rendu | T08 |
| R18 | Qualité réelle image/audio/sous-titres exporté | **NON TESTÉ** | Réel continu distinct du CPU — 37 MP4 CPU synthétiques vérifiés (R48), pas de média IA réel ni parcours DB→rendu→publication continu. | T05/T01 |
| R19 | Validation médias locale CPU intégrée | **PASS** | T05 réutilisé + vérification T08 — t05-proof-verification.json : 37 fichiers hash/taille conformes et 11 producteurs conformes ; 6 modules produit et lockfile identiques au candidat. | T05/T01 |
| R20 | Isolation utilisateur aux frontières projet/job/export/publication | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J06 : utilisateur étranger 404/409, zéro effet ; session fixture, pas preuve RLS | T08 |
| R21 | Preuve finale absente et accès révoqué | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J09 : codes explicites, aucun POST ; hors course OAuth | T08 |
| R22 | OAuth ancien consentement ou revoke concurrent | **PASS** | T08 retest propriétaire / simulé — oauth-races.json : 38 PASS ; oauth.json : 9 PASS. Courses ancien consentement/révocation dans modèle DB ; pas de consentement personnel ni course HTTP PostgREST réelle. | T06 |
| R23 | Sécurité stockage/preuve publique | **PASS** | T08 retest propriétaire / simulé — storage-proof.json : 18 PASS ; isolation stockage et expurgation publique. Aucun appel stockage distant. | T02 |
| R24 | Planification future sans faux published | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J01 : scheduled/202/success=false, vidéo ready ; confirmation GET seulement ensuite | T08 |
| R25 | Publication simulée et projections cohérentes | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J01 : seul média final exporté, journal/calendrier/historique ; 1 POST | T08 |
| R26 | Publication double clic concurrente | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J11 : 12 demandes, 1 POST/journal ; projections réparées au replay | T08 |
| R27 | Échec partiel multi-réseaux | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J08 : retry Instagram seul ; YouTube publié non resoumis | T08 |
| R28 | Export modifié après planification | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J12 : SUTRA_MEDIA_CHANGED 409 ; intention média initiale conservée | T08 |
| R29 | Date passée ne déclenche aucune publication immédiate | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J13 : refus SUTRA_ZERNIO_SCHEDULE_MUST_BE_FUTURE | T08 |
| R30 | Ordonnanceur autonome/cron OVH et reprise sans requête | **BLOQUÉ** | Configuration inactive / T01 — T01 : ordonnanceur autonome non activé ; préparation observer en cours hors candidat. Aucun changement de configuration/production autorisé à T08. | T01 |
| R31 | SSRF/IDOR/CSRF/XSS, gardes déjà intégrées | **PASS** | Sécurité bornée réutilisée — CI38508390596 sur 86d04c8 et source produit inchangée jusqu’à e09 (provenance.json) ; contrôles bornés SSRF/IDOR/CSRF/XSS. Ne couvre pas les nouveaux R49/R51 ni une sécurité exhaustive. | T02/T01 |
| R32 | Redirections dépendance OTS et sécurité exhaustive | **NON TESTÉ** | Exigence composée : exhaustivité non démontrable — Défaut OTS historique clos par 16 PASS (R53). Le terme sécurité exhaustive demeure NON TESTÉ ; aucun test rouge supprimé/ignoré. Graphe tronqué. | T02 |
| R33 | Transactions/RLS PostgreSQL multi-session existantes | **PASS** | PostgreSQL jetable CI réutilisé — CI38508390596 : pipeline12/Salad7/finish-CAS13/RLS254 ; SQL canonique inchangé hors ACL affirmations. Nouveau défaut intégrité checkpoint/null distinct R50, proposition T03 non intégrée. | T01/T03 |
| R34 | Parcours continu sur DB réelle avec rendu et publication | **NON TESTÉ** | Réel — Les preuves DB, médias et navigateur sont segmentées ; port DB du parcours simulé | T01 |
| R35 | Observabilité états/progrès/erreurs récupérables | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J01/J02/J05/J10 : états, checkpoints, last_error et polling vérifiés | T08 |
| R36 | Alertes bout en bout et diagnostics exploitation | **NON TESTÉ** | Réel — Aucune injection panne production ni alerte/monitoring live déclenché | T01 |
| R37 | Charge concurrente bornée isolée | **PASS** | T08 / simulé — journey.json (13 PASS sur e09) — J02/J11 : 12 requêtes chacun, aucun réseau ; ne mesure pas débit Postgres/HTTP | T08 |
| R38 | Performance réelle/SLA et charge distante | **NON TESTÉ** | Performance distante — Latences de fixtures et bibliothèque locale ne mesurent ni SLA ni charge distante. | T01 |
| R39 | Navigateur/accessibilité de la base, contrôles déjà passés | **PASS** | Navigateur borné — browser.json et browser/after/results.json : 25 assertions PASS en dev isolé. Deux captures examinées ; aucune validation générale du parcours visuel/accessibilité. | T07/T01 |
| R40 | Pagination/filtre UI et contraste bouton consentement | **PASS** | T08 retest navigateur propriétaire — browser/after/results.json : 25 PASS ; pagination/filtres/retry/double clic, contraste cookie, retours sociaux 409/503 ; 375/1440px. Pas le modal légal R41. | T07 |
| R41 | Clavier/lecteur écran et parcours visuel complet T08 | **FAIL** | Défaut auteur sur candidat ; reste manuel NON TESTÉ — T07-FRONTEND-JOURNEY snapshot : modal légal laisse sortir le focus, /mentions404 et contrastes sur e09 ; correctif local T07 non intégré. Lecteur écran et parcours manuel intégral NON TESTÉS. | T07/T01 |
| R42 | Absence secrets/requête payante/génération Mac/publication réelle | **PASS** | T08 / borné — journey.json (13 PASS sur e09) — Allowlist runner, fixtures-only, preload offline ; aucune lecture maître/env ni effet distant | T08 |
| R43 | RunPod/Shotstack accès non génératif existant | **PASS** | Preuve non générative datée réutilisée — T01 qa/final-delta-20261014/provider-runtime.json : health RunPod200, templates Shotstack stage/v1 200. Aucun nouveau probe T08 ; T04 seul valide le delta fournisseur. Aucun succès GPU induit. | T01 |
| R44 | GPU Salad/RunPod, modèle 24Go, rendu facturé | **NON TESTÉ** | Réel — Salad désactivé, aucun worker GPU lancé, aucun calcul IA Mac | T01/utilisateur |
| R45 | Publication réelle et consentements sociaux | **NON TESTÉ** | Réel — Zernio profil possédé mais aucun compte connecté au reçu T01 ; aucun compte connecté par T08 | T01/utilisateur |
| R46 | TS/lint delta T08 et gates produit inchangées | **PASS** | Qualité du delta et gate inchangée — quality-final.json : TypeScript ciblé, ESLint des trois fichiers de tests et syntaxe Python PASS. CI38508390596 TypeScript/lint/build réutilisés, aucun delta src/scripts/dépendances entre 86d04c8 et e09 ; aucun build global relancé. | T08/T01 |
| R47 | Régressions des nouveaux correctifs T02–T07 intégrés | **BLOQUÉ** | Nouveau candidat externe T01 attendu — Sept lots historiques intégrés (ancienne attente close). T01 14:10 confirme nouvel SHA seulement après gel T03/T06/T07 ; e09 encore seul candidat intégré. Retest des nouveaux correctifs sur SHA final non réalisable avant livraison. | T01/T08 |
| R48 | Exports CPU synthétiques image/audio/sous-titres vérifiables | **PASS** | T05 réutilisé, hashes T08 — 37 MP4, hashes/tailles PASS ; 11 producteurs dont 6 modules produit identiques. 49 scénarios distincts auteur après retest ciblé ; rouge historique conservé. t05-proof-verification.json. | T05 |
| R49 | Réponse production expurgée en panne RPC | **FAIL** | Reproduction T08 indépendante sur e09 — production-error.json : 3 PASS/1 FAIL, marqueur synthétique renvoyé dans HTTP503. Copie byte-identique auteur56c0ca82 ; correctif T03 non intégré. | T03 (signalement T02) |
| R50 | Intégrité résultat durable/checkpoint sous reprise et ACK perdu | **FAIL** | Reproduction propriétaire sur e09 — T03 snapshot : null traité comme succès et skip musique contradictoire ; 10 FAIL/1 PASS worker, SQL canonique7 PASS/5 FAIL. Corrections/proposition SQL en attente T01. | T03/T01 SQL |
| R51 | Publication refuse compte lié à un ancien profil ou révocation pending | **FAIL** | Reproduction propriétaire sur e09 — T06 snapshot : 14 FAIL/4 PASS, create/replay/retry acceptés avec binding absent/réaffecté ou provenance manquante ; aucun POST réel. | T06 |
| R52 | Lecteur : états honnêtes et commandes selon média vérifié | **FAIL** | Reproduction propriétaire sur e09 — T07 snapshot : failed sans média affiché génération ; commandes sans effet et lien absent. Correctif réservé T07, pas encore candidat. | T07 |
| R53 | Transport OTS refuse les redirections dangereuses | **PASS** | T08 retest propriétaire / simulé — ots.json : 16 PASS/0 FAIL/0 SKIP ; ancien défaut précis clos, pas une certification générale. | T02 |
