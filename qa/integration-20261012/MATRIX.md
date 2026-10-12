# Matrice finale SUTRA — T01, 2026-10-12

Base protégée PR3 `7088a0a`, intégration dans le seul worktree T01. Les commits propriétaires restent sur leurs branches : intégration de deltas contrôlés, sans fusion de snapshots S5 ni remplacement de WIP.

| Lot | Livraison acceptée | Disposition finale |
| --- | --- | --- |
| T01 CI/dépendances/intégration | `19ea35f` + présent commit | CI Node24, dépendances figées, gates gratuites isolées, raccords contrats, preuves et recette OVH |
| T02 sécurité | `d4626a426ad1f3f29e670fb1a19c65298d2f7809` | Auth/OAuth/admin/RLS/stockage/downloader ; droits du journal corrigés après test réel avec default grants |
| T03 pipeline | code `289eaa41c8a57fde60d0709e98550ee3d81208ef`, handoff `fc308f1913fa61d1c94b8e29aac18032da465731` | Quota, identité stable, claim, jobs, checkpoints, persistance vérifiée ; reste propriétaire du contrat durable export |
| T04 IA | code `e60d2f5ee305bbe2b342177f98a74b8c585c09da`, handoff `2fcc74251c861a45b1c17f4e0282ca3042ef6582` | Adaptateurs LTX V2/fallbacks adaptés à PR3 ; état ambigu sans resoumission payante ; S5 non fusionné |
| T05 média | code `6fd2f8576761887a7a2d8ac8a3214c486aa69dcd`, handoff `db9d9f909f5d646eb67b867436446f727337204c` | FFmpeg/Shotstack, contrat complet, validation réelle ; `media-inspection.ts` distinct du probe protégé PR3 |
| T06 social/autonomie | code `9906e2da01ac33e9069c75be9cbc1876bfe40c8a`, handoff `0be9a90e1994284705d34214d6b3dd2f6d7076bb` | Journal par destination, claim CAS, révocation, retry partiel ; calendrier PR2 et DST conservés |
| T07 UX/UI | code `96faec6197c5c0fa5a1ddbe09b72f946895e1637`, handoff `cce91505cb93de39ed5a0a85d420b3d9626d840e` | Parcours authentifiés isolés, responsive/axe ; client 202 raccordé à la réception finale ; éditeur sources/volumes/a11y |
| T08 QA | `d3fcedf96b96c857670f82210454c1761eee49ec` | Sources S5 conservées `.s5-source`, rapports historiques inchangés ; runner courant branché sur les gates intégrées |

## Réconciliation des conflits et doublons

- PR1 : contrats vidéo présents dans l'ascendance, conservés et élargis ; aucune copie S5 ne les remplace.
- PR2 : calcul de prochaine occurrence/timezone/DST conservé, T06 ajoute les cas fold/gap/datelining et identités contradictoires.
- Correctif `05d164d` : `media-probe.ts` et `verifyVideoBytes` restent l'autorité sur les vrais octets ; le probe T05 est renommé `media-inspection.ts`. Le média final doit satisfaire qualité, durée, audio requis et hash avant persistance/publication.
- PR3 : quota/claim/checkpoints et journaux d'intention LTX/Shotstack conservés ; absence d'identifiant après intention soumise = réconciliation, jamais fallback payé automatique. Ancien fingerprint LTX accepté uniquement pour poursuivre un job identifié.
- T03/T05 export : `executeExportJob` durable reçoit le compositeur final ; le checkpoint sauvegardé ne dispense pas de relire/vérifier les octets et le hash du contrat. Qualité non autorisée et sources manquantes refusées. Volume vocal inclus dans les deux moteurs et dans le hash.
- T02/T05 downloader : un téléchargement sécurisé partagé, limites et DNS/SSRF, JSON fournisseur borné ; aucun downloader permissif S5 recopié.
- T03/T06 tests : assertions de queue et publication réunies dans les tests de régression, aucun choix aveugle « ours/theirs ».
- T02/T06 SQL : default privileges réalistes révélant DELETE/TRUNCATE hérités sur le journal ; REVOKE ALL puis SELECT/INSERT/UPDATE explicites. 49 contrôles RLS locaux passent.
- T04 `fallbacks.ts` / `wan.ts` : conflits d'application résolus en conservant les callers PR3 et les adaptateurs T04. Marqueurs de conflit absents ; typecheck, tests et build intégrés.
- Doublons historiques S1/S4/S5 : aucun cherry-pick global ; uniquement les livraisons datées ci-dessus et les raccords nécessaires.

## T08 : disposition des 46 cas historiques

Les 25 PASS/21 FAIL de S5 ne sont pas ajoutés aux compteurs intégrés. La table indique les preuves actuelles équivalentes ou les différences de périmètre, sans prétendre avoir rejoué le harnais S5 incompatible.

| Cas historiques | Preuve/disposition actuelle |
| --- | --- |
| 01–03, 05–09 | `test-pipeline-submit`, `test-pipeline-interruptions`, `test-production-queue`, `test-pipeline-postgres` : quota/claim, rollback, concurrence et reprise ; SQL réel jetable distinct des doubles DB |
| 10 | Routes create/production/export renvoient une erreur bornée ; `test-release-regressions`, `test-security-routes`, `test-integration` couvrent erreurs/redaction et statut privé |
| 11–13 | Contrôles ownership/export, `persistPipelineVideo` refuse une écriture non confirmée ; `test-auto-export-queue`, `test-pipeline-interruptions`, `test-export-integration`. Contrat `versionId` S5 absent : aucun PASS pour une fonction de versions non livrée |
| 04, 14–18 | Approbation budgétaire hybride S5 et gestion/restauration de versions non présentes dans PR3 : NON INTÉGRÉES, aucune certification de ces fonctionnalités. Le bouton de restauration indique son indisponibilité |
| 19–28 | `test-t06-social-autonomy`, `test-t06-social-routes`, `test-social-publication` et tests SQL journal : approbation CAS, révocation, erreurs lecture/finalisation et retry ; charge S5 8/32/64 historique, non promue en preuve de charge réelle |
| 29–31 | Auth cron, credentials synthétiques, DNS/SSRF/abort du downloader dans les tests sécurité/fournisseurs |
| 32–35, 40 | Logger/cron-run S5 absents de cette base : aucune équivalence inventée ; journaux durables PR3/T06 testés séparément. Pas de promesse de corrélation/SLA S5 |
| 36 | `test-auto-schedule.mjs` couvre timezone/DST et une occurrence par jour local |
| 37–39 | Garde réseau/environnement reprise de T08, parcours locaux bloquant l'egress ; middleware Origin/content-type couvert par `test-integration.mts` |
| B01 | Login invalide puis valide couvert par parcours Chromium intégré avec GoTrue simulé |
| B02 | Gate budgétaire hybride S5 absente. Création manuelle, approbation et polling 202 de production testés sur le contrat PR3 courant |
| B03 | Sources d'éditeur, export, volumes, absence de boucle testés ; l'ancien scénario complet XSS/retry S5 n'est pas déclaré rejoué à l'identique |
| A11Y login/create/editor | Axe dans le navigateur intégré ; éditeur sur les 5 onglets à 320 et 1280 px. Preuve locale, pas une certification WCAG complète |

## Limites produit et release

Restauration/versionnement des exports S5 et approbation hybride S5 non intégrés. Modifier le texte du script dans l'éditeur ne régénère pas la voix dans le contrat export PR3 ; aucune preuve de régénération vocale n'est revendiquée. Les 25 SKIP Playwright historiques restent explicites : 6 media-mode derrière auth, 6 escalade non implémentée, 13 exclusions de viewport/API en double.

Les scripts `test-connect.mjs` et `test-storage-video-proofs.mjs` exigent des secrets et mutent des services réels : non exécutés. Quatre cas INSEE live, deux cas DB distante et un ancrage OTS réseau restent SKIP. Les tests de wrappers T06 sont déjà inclus dans les gates et ne sont pas comptés deux fois.

Aucun appel fournisseur payant, aucune migration distante, aucun déploiement. Le schéma distant, Docker/Linux, les moteurs GPU et les fournisseurs/connecteurs réels restent à qualifier. L'intégration locale ne signifie pas « toutes les fonctionnalités historiques S5 sont livrées ».

## Résultats navigateur intégrés

203 contrôles distincts validés par union de la suite complète (202 PASS avant une erreur de parsing URL du nouveau test) et de la reprise profil ciblée (5 PASS). 155 audits axe sans violation, aucune erreur navigateur. `evidence/browser-aggregate.json` conserve les sources et la distinction avec une suite complète fraîche. Aucune modification produit entre ces deux exécutions.
